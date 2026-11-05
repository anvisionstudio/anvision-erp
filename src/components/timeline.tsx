"use client";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition, type KeyboardEvent as RKeyboardEvent, type PointerEvent as RPointerEvent } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight, CalendarOff, Check, ChevronDown, ChevronLeft, ChevronRight, ExternalLink, History, Plus, Search, X } from "lucide-react";
import type { SignAction } from "@/lib/perm";

/**
 * Notion 風格時間軸。
 * - 專案 → 任務 → 子項目（多層），可展開 / 收合，展開後可直接「＋ 新子項目」
 * - 長條：拖曳移動、拖曳左右邊緣調整起訖；鍵盤 ←/→ 移動、Shift+←/→ 調整截止日、Enter 開啟
 * - 勾選框 = 簽核：送審 / 撤回 / 核准 / 退回 / 重新開啟，每次動作都記錄簽核人與時間
 * - 名稱欄固定、圖表於容器內水平捲動；畫面外的長條以 ← / → 提示並可一鍵跳過去
 */
export type TimelineItem = {
  id: string;
  kind: "project" | "task";
  parentId: string | null;
  projectId: string;
  depth: number;
  childCount: number;
  label: string;
  sub?: string | null;
  start?: string | null;
  end?: string | null;
  tone: "gray" | "blue" | "amber" | "green" | "red" | "primary";
  href: string;
  editable: boolean;
  done?: boolean;
  status: string;
  priority: { label: string; tone: string } | null;
  signActions: SignAction[];
  approvals: { action: string; note: string | null; at: string; by: string }[];
  canAddChild: boolean;
};
type Zoom = "week" | "month" | "quarter";
type Mover = (id: string, start: string, end: string) => Promise<void>;
type Signer = (id: string, action: SignAction, note?: string) => Promise<void>;
type Adder = (parent: { projectId: string; parentId?: string | null }, title: string) => Promise<string>;

const DAY = 864e5;
const DAY_W: Record<Zoom, number> = { week: 40, month: 16, quarter: 6 };
const ZOOM_LABEL: Record<Zoom, string> = { week: "週", month: "月", quarter: "季" };
const ROW_H = 44;
const WEEKDAY = ["日", "一", "二", "三", "四", "五", "六"];
const toDay = (s: string) => Math.floor(Date.parse(s.slice(0, 10) + "T00:00:00Z") / DAY);
const toISO = (d: number) => new Date(d * DAY).toISOString().slice(0, 10);
const slash = (s: string) => s.replaceAll("-", "/");
const BAR: Record<TimelineItem["tone"], string> = {
  gray: "bg-slate-100 ring-slate-300",
  blue: "bg-blue-50 ring-blue-300",
  amber: "bg-amber-50 ring-amber-300",
  green: "bg-emerald-50 ring-emerald-300",
  red: "bg-red-50 ring-red-300",
  primary: "bg-primary/15 ring-primary/40",
};
const TAG: Record<string, string> = {
  red: "bg-red-100 text-red-800", green: "bg-emerald-100 text-emerald-800", amber: "bg-amber-100 text-amber-900", blue: "bg-blue-100 text-blue-800", gray: "bg-slate-100 text-ink-muted",
};
const STATUS_LABEL: Record<string, string> = { TODO: "待辦", DOING: "進行中", REVIEW: "審核中", DONE: "已核准完成" };
const SIGN_LABEL: Record<string, string> = { SUBMIT: "送審", WITHDRAW: "撤回送審", APPROVE: "核准", REJECT: "退回", REOPEN: "重新開啟" };
const SIGN_STYLE: Record<string, string> = { APPROVE: "btn-primary", SUBMIT: "btn-primary", REJECT: "btn-danger", WITHDRAW: "btn-secondary", REOPEN: "btn-secondary" };
const fmtTime = (iso: string) => new Date(iso).toLocaleString("zh-TW", { timeZone: "Asia/Taipei", hour12: false, month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
const STORE = "erp-timeline-open-state";

export function Timeline({
  items: initial, moveTask, moveProject, signTask, addSubItem, defaultZoom = "month", emptyText = "沒有可顯示的項目", createHref,
}: {
  items: TimelineItem[]; moveTask?: Mover; moveProject?: Mover; signTask?: Signer; addSubItem?: Adder;
  defaultZoom?: Zoom; emptyText?: string; createHref?: string;
}) {
  const router = useRouter();
  const [items, setItems] = useState(initial);
  useEffect(() => setItems(initial), [initial]);
  const [zoom, setZoom] = useState<Zoom>(defaultZoom);
  const [query, setQuery] = useState("");
  // 展開狀態：專案預設展開（記錄收合的 "c:id"），任務預設收合（記錄展開的 "e:id"）
  const [openState, setOpenState] = useState<Set<string> | null>(null);
  const [drag, setDrag] = useState<{ id: string; mode: "move" | "start" | "end"; x0: number; delta: number } | null>(null);
  const [announce, setAnnounce] = useState("");
  const [signFor, setSignFor] = useState<{ id: string; rect: DOMRect } | null>(null);
  const [adding, setAdding] = useState<string | null>(null);
  const [showUndated, setShowUndated] = useState(false);
  const [view, setView] = useState({ left: 0, width: 800 });
  const [pending, start] = useTransition();
  const scroller = useRef<HTMLDivElement>(null);
  const today = Math.floor(Date.now() / DAY);
  const dw = DAY_W[zoom];

  useEffect(() => {
    let saved: string[] | null = null;
    try { saved = JSON.parse(localStorage.getItem(STORE) ?? "null"); } catch { /* 無法使用 localStorage 時用預設值 */ }
    if (saved) return setOpenState(new Set(saved));
    const projects = initial.filter((i) => i.kind === "project");
    setOpenState(new Set(projects.length > 8 ? projects.map((p) => `c:${p.id}`) : []));
  }, [initial]);
  const isOpen = useCallback((i: TimelineItem) => (i.kind === "project" ? !openState?.has(`c:${i.id}`) : !!openState?.has(`e:${i.id}`)), [openState]);
  const toggle = (i: TimelineItem) => setOpenState((c) => {
    const n = new Set(c ?? []);
    const key = i.kind === "project" ? `c:${i.id}` : `e:${i.id}`;
    if (n.has(key)) n.delete(key); else n.add(key);
    try { localStorage.setItem(STORE, JSON.stringify([...n])); } catch { /* 忽略 */ }
    return n;
  });

  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  // 搜尋：保留符合項目及其上層
  const matchIds = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    const keep = new Set<string>();
    for (const i of items) {
      if (`${i.label} ${i.sub ?? ""}`.toLowerCase().includes(q)) {
        let cur: TimelineItem | undefined = i;
        while (cur) { keep.add(cur.id); cur = cur.parentId ? byId.get(cur.parentId) : undefined; }
      }
    }
    return keep;
  }, [query, items, byId]);
  const hidden = (i: TimelineItem) => {
    if (matchIds && !matchIds.has(i.id)) return true;
    if (matchIds) return false;
    let p = i.parentId ? byId.get(i.parentId) : undefined;
    while (p) { if (!isOpen(p)) return true; p = p.parentId ? byId.get(p.parentId) : undefined; }
    return false;
  };
  const visible = items.filter((i) => !hidden(i));
  const undated = items.filter((i) => !i.start && !i.end);

  const [from, to] = useMemo(() => {
    let lo = today - 21, hi = today + 70;
    for (const i of items) {
      if (i.start) lo = Math.min(lo, toDay(i.start) - 7);
      if (i.end) hi = Math.max(hi, toDay(i.end) + 21);
    }
    return [lo - 7, hi + 7];
  }, [items, today]);
  const days = to - from + 1;
  const width = days * dw;

  const onScroll = useCallback(() => {
    const el = scroller.current;
    if (el) setView({ left: el.scrollLeft, width: el.clientWidth - labelWidth(el) });
  }, []);
  const scrollToDay = useCallback((d: number, smooth = true) => {
    const el = scroller.current;
    if (el) el.scrollTo({ left: Math.max(0, (d - from) * dw - (el.clientWidth - labelWidth(el)) / 3), behavior: smooth ? "smooth" : "auto" });
  }, [from, dw]);
  useEffect(() => { scrollToDay(today, false); onScroll(); }, [zoom, scrollToDay, today, onScroll]);

  const range = (i: TimelineItem) => {
    if (!i.start && !i.end) return null;
    let s = toDay(i.start ?? i.end!), e = toDay(i.end ?? i.start!);
    if (drag?.id === i.id) {
      if (drag.mode !== "end") s += drag.delta;
      if (drag.mode !== "start") e += drag.delta;
      if (drag.mode === "start") s = Math.min(s, e);
      if (drag.mode === "end") e = Math.max(e, s);
    }
    return { s, e };
  };

  const run = (fn: () => Promise<unknown>, rollback?: () => void) =>
    start(async () => {
      try { await fn(); router.refresh(); }
      catch (err) { rollback?.(); alert((err as Error).message || "操作失敗"); }
    });

  const commitDates = (i: TimelineItem, s: number, e: number) => {
    const fn = i.kind === "task" ? moveTask : moveProject;
    if (!fn) return;
    const prev = items;
    setItems((xs) => xs.map((x) => (x.id === i.id ? { ...x, start: toISO(s), end: toISO(e) } : x)));
    setAnnounce(`${i.label}：${toISO(s)} 至 ${toISO(e)}`);
    run(() => fn(i.id, toISO(s), toISO(e)), () => setItems(prev));
  };

  const onPointerDown = (e: RPointerEvent<HTMLElement>, i: TimelineItem) => {
    if (!i.editable || e.button !== 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const edge = Math.min(10, rect.width / 4);
    const mode = e.clientX - rect.left < edge ? "start" : rect.right - e.clientX < edge ? "end" : "move";
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag({ id: i.id, mode, x0: e.clientX, delta: 0 });
  };
  const onPointerMove = (e: RPointerEvent<HTMLElement>) => {
    if (!drag) return;
    const delta = Math.round((e.clientX - drag.x0) / dw);
    if (delta !== drag.delta) setDrag({ ...drag, delta });
  };
  const onPointerUp = (e: RPointerEvent<HTMLElement>, i: TimelineItem) => {
    if (!drag) return;
    const moved = Math.abs(e.clientX - drag.x0) > 3;
    const r = range(i);
    setDrag(null);
    if (moved && r && drag.delta !== 0) commitDates(i, r.s, r.e);
    else if (!moved) router.push(i.href);
  };
  const onBarKey = (e: RKeyboardEvent<HTMLElement>, i: TimelineItem) => {
    if (e.key === "Enter") return router.push(i.href);
    if (!i.editable || (e.key !== "ArrowLeft" && e.key !== "ArrowRight")) return;
    const r = range(i);
    if (!r) return;
    e.preventDefault();
    const d = e.key === "ArrowLeft" ? -1 : 1;
    if (e.shiftKey) commitDates(i, r.s, Math.max(r.s, r.e + d));
    else commitDates(i, r.s + d, r.e + d);
  };

  // 表頭
  const months: { label: string; left: number; width: number }[] = [];
  const ticks: { label: string; sub?: string; left: number; weekend?: boolean }[] = [];
  for (let d = from; d <= to; d++) {
    const date = new Date(d * DAY);
    const dom = date.getUTCDate(), dow = date.getUTCDay();
    if (dom === 1 || d === from) {
      const next = Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1) / DAY;
      months.push({ label: `${date.getUTCFullYear()}年${date.getUTCMonth() + 1}月`, left: (d - from) * dw, width: (Math.min(next, to + 1) - d) * dw });
    }
    if (d === today) continue;
    if (zoom === "week") ticks.push({ label: String(dom), sub: WEEKDAY[dow], left: (d - from) * dw, weekend: dow === 0 || dow === 6 });
    else if (zoom === "month" && dow === 1) ticks.push({ label: String(dom), left: (d - from) * dw });
    else if (zoom === "quarter" && dom === 15) ticks.push({ label: "15", left: (d - from) * dw });
  }
  const weekends = zoom === "quarter" ? [] : Array.from({ length: days }, (_, k) => from + k).filter((d) => [0, 6].includes(new Date(d * DAY).getUTCDay()));
  const todayDate = new Date(today * DAY);
  const page = (dir: -1 | 1) => scroller.current?.scrollBy({ left: dir * (view.width * 0.8), behavior: "smooth" });
  const signItem = signFor ? byId.get(signFor.id) : undefined;

  const renderRow = (i: TimelineItem) => {
                  const r = range(i);
                  const open = isOpen(i);
                  const left = r ? (r.s - from) * dw : 0;
                  const w = r ? (r.e - r.s + 1) * dw : 0;
                  const dates = r ? `${toISO(r.s)} – ${toISO(r.e)}` : "未排程";
                  const offLeft = r && left + w < view.left + 8;
                  const offRight = r && left > view.left + view.width - 8;
                  const isTask = i.kind === "task";
                  // 長條起點在畫面左側外時，名稱卡片貼齊可視範圍左緣（Notion 行為）
                  const chipLeft = r ? Math.max(left, Math.min(view.left + 6, left + w - 48)) : 0;
                  return (
                    <li key={i.id} className="flex border-b border-line/70" style={{ height: ROW_H }}>
                      <div className="sticky left-0 z-[5] flex w-[var(--tl-label)] shrink-0 items-center gap-0.5 border-r border-line bg-surface pr-2" style={{ paddingLeft: 4 + i.depth * 18 }}>
                        {i.childCount > 0 || (i.canAddChild && addSubItem) ? (
                          <button type="button" className="inline-flex h-11 w-9 shrink-0 items-center justify-center rounded text-ink-muted hover:bg-surface-muted md:h-9 md:w-7" aria-expanded={open}
                            aria-label={`${open ? "收合" : "展開"}「${i.label}」${i.childCount ? `（${i.childCount} 個子項目）` : ""}`} onClick={() => toggle(i)}>
                            {open ? <ChevronDown className="h-4 w-4" aria-hidden /> : <ChevronRight className="h-4 w-4" aria-hidden />}
                          </button>
                        ) : <span className="w-9 shrink-0 md:w-7" />}
                        <Link href={i.href} className={`flex h-full min-w-0 flex-1 items-center gap-1 text-sm hover:underline ${i.kind === "project" ? "font-semibold" : ""} ${i.done ? "text-ink-muted line-through" : "text-ink"}`} title={i.label}>
                          <span className="truncate">{i.label}</span>
                          {i.childCount > 0 && !open && <span className="shrink-0 text-xs font-normal text-ink-muted">({i.childCount})</span>}
                        </Link>
                      </div>
                      <div className="relative shrink-0" style={{ width }}>
                        {r ? (
                          <>
                            <div
                              role="button"
                              tabIndex={0}
                              draggable={false}
                              onDragStart={(e) => e.preventDefault()}
                              onPointerDown={(e) => onPointerDown(e, i)}
                              onPointerMove={onPointerMove}
                              onPointerUp={(e) => onPointerUp(e, i)}
                              onPointerCancel={() => setDrag(null)}
                              onKeyDown={(e) => onBarKey(e, i)}
                              aria-label={`${i.label}，${dates}${i.editable ? "，可用左右鍵調整日期，Enter 開啟" : "，Enter 開啟"}`}
                              title={`${i.label}\n${dates}`}
                              className={`absolute top-1.5 h-8 select-none rounded-md ring-1 ring-inset transition-shadow duration-150 hover:shadow-md ${BAR[i.tone]} ${i.editable ? "cursor-grab touch-none active:cursor-grabbing" : "cursor-pointer"} ${drag?.id === i.id ? "shadow-lg ring-2" : ""}`}
                              style={{ left, width: Math.max(w, dw) }}
                            >
                              {i.editable && <span className="absolute inset-y-0 left-0 w-2 cursor-ew-resize rounded-l-md hover:bg-ink/10" aria-hidden />}
                              {i.editable && <span className="absolute inset-y-0 right-0 w-2 cursor-ew-resize rounded-r-md hover:bg-ink/10" aria-hidden />}
                            </div>
                            {/* 卡片：勾選（簽核）、名稱、優先度、日期（Notion 樣式，超出長條時延伸到右側） */}
                            {!offLeft && <div className="pointer-events-none absolute top-1.5 flex h-8 items-center gap-1.5 whitespace-nowrap pl-1.5" style={{ left: chipLeft }}>
                              {isTask && (
                                <button
                                  type="button"
                                  className="group pointer-events-auto -mx-2.5 inline-flex h-11 w-11 shrink-0 items-center justify-center md:mx-0 md:h-6 md:w-6"
                                  aria-label={`簽核「${i.label}」：目前${STATUS_LABEL[i.status] ?? i.status}`}
                                  aria-haspopup="dialog"
                                  onPointerDown={(e) => e.stopPropagation()}
                                  onClick={(e) => setSignFor({ id: i.id, rect: e.currentTarget.getBoundingClientRect() })}
                                >
                                  <span className={`inline-flex h-6 w-6 items-center justify-center rounded border-2 transition-colors ${i.status === "DONE" ? "border-success bg-success text-white" : i.status === "REVIEW" ? "border-accent bg-accent-soft text-accent" : "border-ink-subtle bg-surface group-hover:border-primary"}`} aria-hidden>
                                    {i.status === "DONE" ? <Check className="h-4 w-4" /> : i.status === "REVIEW" ? <span className="h-2 w-2 rounded-full bg-accent" /> : null}
                                  </span>
                                </button>
                              )}
                              <span className={`text-sm font-medium ${i.kind === "project" ? "text-primary" : "text-ink"} ${i.done ? "line-through opacity-70" : ""}`}>{i.label}</span>
                              {i.priority && <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${TAG[i.priority.tone] ?? TAG.gray}`}>{i.priority.label}</span>}
                              {r && <span className="text-xs text-ink-muted">{slash(toISO(r.e))}</span>}
                              {i.approvals[0] && <span className="text-xs text-ink-muted">・{i.approvals[0].by} {SIGN_LABEL[i.approvals[0].action] ?? ""}</span>}
                            </div>}
                            {offLeft && (
                              <button type="button" className="group absolute top-0 z-[4] inline-flex h-11 w-11 items-center justify-center md:top-2.5 md:h-6 md:w-8" style={{ left: view.left + 2 }}
                                onClick={() => scrollToDay(r.s)} aria-label={`捲動到「${i.label}」`}><span className="inline-flex h-6 items-center rounded bg-surface px-1.5 text-ink-muted shadow ring-1 ring-line group-hover:text-ink" aria-hidden><ArrowLeft className="h-3.5 w-3.5" /></span></button>
                            )}
                            {offRight && (
                              <button type="button" className="group absolute top-0 z-[4] inline-flex h-11 w-11 items-center justify-center md:top-2.5 md:h-6 md:w-8" style={{ left: view.left + view.width - 46 }}
                                onClick={() => scrollToDay(r.s)} aria-label={`捲動到「${i.label}」`}><span className="inline-flex h-6 items-center rounded bg-surface px-1.5 text-ink-muted shadow ring-1 ring-line group-hover:text-ink" aria-hidden><ArrowRight className="h-3.5 w-3.5" /></span></button>
                            )}
                          </>
                        ) : (
                          <Link href={i.href} className="absolute top-2.5 inline-flex h-6 items-center gap-1 rounded-full bg-surface px-2 text-xs text-ink-muted ring-1 ring-line hover:text-ink" style={{ left: view.left + 8 }}>
                            <CalendarOff className="h-3.5 w-3.5" aria-hidden />未排程
                          </Link>
                        )}
                      </div>
                    </li>
                  );
  };

  return (
    <div className="card overflow-hidden">
      {/* 工具列 */}
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2">
        <label className="relative min-w-0 flex-1 sm:max-w-xs">
          <span className="sr-only">搜尋時間軸</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" aria-hidden />
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜尋專案、任務或成員" className="input pl-9" />
        </label>
        <div className="relative">
          <button type="button" className="btn-secondary btn-sm" aria-expanded={showUndated} onClick={() => setShowUndated((v) => !v)} disabled={!undated.length}>
            <CalendarOff className="h-4 w-4" aria-hidden />無日期（{undated.length} 個）
          </button>
          {showUndated && undated.length > 0 && (
            <div className="absolute left-0 top-full z-overlay mt-1 max-h-72 w-72 overflow-auto rounded-md border border-line bg-surface p-1 shadow-lg">
              {undated.map((i) => (
                <Link key={i.id} href={i.href} className="flex min-h-touch items-center justify-between gap-2 rounded px-2 text-sm hover:bg-surface-muted md:min-h-[2.25rem]">
                  <span className="truncate">{i.label}</span><span className="shrink-0 text-xs text-ink-muted">{i.kind === "project" ? "專案" : i.sub}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1 text-sm text-ink-muted">
            <span className="sr-only">時間刻度</span>
            <select value={zoom} onChange={(e) => setZoom(e.target.value as Zoom)} className="input w-auto py-1">
              {(Object.keys(DAY_W) as Zoom[]).map((z) => <option key={z} value={z}>{ZOOM_LABEL[z]}</option>)}
            </select>
          </label>
          <div className="inline-flex items-center">
            <button type="button" className="btn-icon btn-secondary rounded-r-none" onClick={() => page(-1)} aria-label="往前"><ChevronLeft className="h-4 w-4" aria-hidden /></button>
            <button type="button" className="btn-secondary rounded-none border-x-0" onClick={() => scrollToDay(today)}>今天</button>
            <button type="button" className="btn-icon btn-secondary rounded-l-none" onClick={() => page(1)} aria-label="往後"><ChevronRight className="h-4 w-4" aria-hidden /></button>
          </div>
          {createHref && <Link href={createHref} className="btn-primary"><Plus className="h-4 w-4" aria-hidden />新建</Link>}
        </div>
      </div>
      <p className="sr-only" aria-live="polite">{announce}{pending ? "儲存中…" : ""}</p>

      {visible.length === 0 ? (
        <div className="px-4 py-10 text-center text-sm text-ink-muted">{query ? "沒有符合搜尋的項目" : emptyText}</div>
      ) : (
        <div ref={scroller} onScroll={onScroll} className="relative max-h-[72dvh] overflow-auto" tabIndex={0} role="region" aria-label="時間軸" style={{ ["--tl-label" as string]: "clamp(10rem, 30vw, 20rem)" }}>
          <div className="relative" style={{ width: `calc(var(--tl-label) + ${width}px)` }}>
            {/* 表頭 */}
            <div className="sticky top-0 z-sticky flex border-b border-line bg-surface">
              <div className="sticky left-0 z-sticky flex w-[var(--tl-label)] shrink-0 items-end border-r border-line bg-surface px-3 pb-2 text-xs font-medium text-ink-muted">專案 / 任務</div>
              <div className="relative h-14 shrink-0" style={{ width }}>
                {months.map((m) => (
                  <div key={m.left} className="absolute top-1 h-6 truncate px-1.5 text-sm font-medium leading-6 text-ink" style={{ left: m.left, width: m.width }}>{m.label}</div>
                ))}
                {ticks.map((t) => (
                  <div key={t.left} className={`absolute top-8 h-5 text-center text-xs leading-5 ${t.weekend ? "text-ink-subtle" : "text-ink-muted"}`} style={{ left: t.left - (zoom === "week" ? 0 : 12), width: zoom === "week" ? dw : 24 }}>
                    {t.label}{t.sub && <span className="ml-0.5">{t.sub}</span>}
                  </div>
                ))}
                <div className="absolute top-7 flex h-6 min-w-6 -translate-x-1/2 items-center justify-center rounded-full bg-danger px-1.5 text-xs font-semibold text-white" style={{ left: (today - from) * dw + dw / 2 }} title={`今天 ${todayDate.getUTCMonth() + 1}/${todayDate.getUTCDate()}`}>
                  {todayDate.getUTCDate()}
                </div>
              </div>
            </div>
            {/* 背景 */}
            <div className="pointer-events-none absolute bottom-0 top-14" style={{ left: "var(--tl-label)", width }} aria-hidden>
              {weekends.map((d) => <div key={d} className="absolute inset-y-0 bg-surface-muted" style={{ left: (d - from) * dw, width: dw }} />)}
              <div className="absolute inset-y-0 w-0.5 bg-danger/70" style={{ left: (today - from) * dw + dw / 2 }} />
            </div>
            {/* 列 */}
            <ul className="relative">
              {visible.map((i) => renderRow(i)).flatMap((row, idx) => {
                // 在每個「展開且可新增」的項目最後一個子孫之後插入「＋ 新子項目」列
                const out = [row];
                for (const anc of addRowsAfter(visible, idx, isOpen, matchIds, !!addSubItem)) {
                  out.push(
                    <li key={`add-${anc.id}`} className="flex border-b border-line/70" style={{ height: ROW_H }}>
                      <div className="sticky left-0 z-[5] flex w-[var(--tl-label)] shrink-0 items-center border-r border-line bg-surface pr-2" style={{ paddingLeft: 4 + (anc.depth + 1) * 18 + 4 }}>
                        {adding === anc.id ? (
                          <form className="flex w-full items-center gap-1" onSubmit={(e) => {
                            e.preventDefault();
                            const title = String(new FormData(e.currentTarget).get("title") ?? "").trim();
                            if (!title) return;
                            setAdding(null);
                            run(() => addSubItem!({ projectId: anc.projectId, parentId: anc.kind === "task" ? anc.id : null }, title));
                          }}>
                            <input name="title" autoFocus className="input h-9 min-h-0 py-1 text-sm" placeholder={`在「${anc.label}」下新增…`} aria-label={`在「${anc.label}」下新增子項目`}
                              onKeyDown={(e) => { if (e.key === "Escape") setAdding(null); }} />
                            <button type="button" className="btn-icon btn-secondary" aria-label="取消" onClick={() => setAdding(null)}><X className="h-4 w-4" aria-hidden /></button>
                          </form>
                        ) : (
                          <button type="button" className="inline-flex min-h-touch items-center gap-1.5 rounded px-2 text-sm text-ink-muted hover:bg-surface-muted hover:text-ink md:min-h-[2.25rem]" onClick={() => setAdding(anc.id)}>
                            <Plus className="h-4 w-4" aria-hidden />新子項目
                          </button>
                        )}
                      </div>
                      <div className="shrink-0" style={{ width }} />
                    </li>,
                  );
                }
                return out;
              })}
            </ul>
          </div>
        </div>
      )}
      {signItem && signFor && signTask && (
        <SignPanel item={signItem} anchor={signFor.rect} pending={pending} onClose={() => setSignFor(null)}
          onSign={(action, note) => {
            const prev = items;
            const to = { SUBMIT: "REVIEW", WITHDRAW: "DOING", APPROVE: "DONE", REJECT: "DOING", REOPEN: "DOING" }[action];
            setItems((xs) => xs.map((x) => (x.id === signItem.id ? { ...x, status: to, done: to === "DONE", approvals: [{ action, note: note ?? null, at: new Date().toISOString(), by: "我" }, ...x.approvals] } : x)));
            setAnnounce(`已${SIGN_LABEL[action]}「${signItem.label}」`);
            setSignFor(null);
            run(() => signTask(signItem.id, action, note), () => setItems(prev));
          }} />
      )}
    </div>
  );
}

function labelWidth(el: HTMLElement) {
  const label = el.querySelector<HTMLElement>("[class*='w-[var(--tl-label)]']");
  return label?.offsetWidth ?? 200;
}

/** 第 idx 列之後要插入哪些「＋ 新子項目」列（該列是某些展開項目的最後一個可見子孫時） */
function addRowsAfter(list: TimelineItem[], idx: number, isOpen: (i: TimelineItem) => boolean, matchIds: Set<string> | null, enabled: boolean) {
  if (!enabled || matchIds) return [];
  const cur = list[idx];
  const next = list[idx + 1];
  const ancestors: TimelineItem[] = [];
  // 自己（展開且可新增，且下一列不是自己的子孫）+ 往上每一層
  const byId = new Map(list.map((x) => [x.id, x]));
  const isDesc = (x: TimelineItem | undefined, anc: TimelineItem) => {
    let p = x?.parentId ? byId.get(x.parentId) : undefined;
    while (p) { if (p.id === anc.id) return true; p = p.parentId ? byId.get(p.parentId) : undefined; }
    return false;
  };
  let a: TimelineItem | undefined = cur;
  while (a) {
    if (isOpen(a) && a.canAddChild && !isDesc(next, a) && (a === cur ? true : isDesc(cur, a))) ancestors.push(a);
    a = a.parentId ? byId.get(a.parentId) : undefined;
  }
  return ancestors;
}

/** 簽核面板：可執行的動作、意見、最近簽核紀錄 */
function SignPanel({ item, anchor, pending, onClose, onSign }: {
  item: TimelineItem; anchor: DOMRect; pending: boolean; onClose: () => void; onSign: (a: SignAction, note?: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>("button, textarea")?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    const onDown = (e: PointerEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onDown);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("pointerdown", onDown); };
  }, [onClose]);
  const W = 320;
  const left = Math.max(8, Math.min(anchor.left, window.innerWidth - W - 8));
  const below = anchor.bottom + 8 + 360 < window.innerHeight;
  const style = { left, width: Math.min(W, window.innerWidth - 16), ...(below ? { top: anchor.bottom + 6 } : { bottom: window.innerHeight - anchor.top + 6 }) };
  return createPortal(
    <div ref={ref} role="dialog" aria-modal="false" aria-label={`簽核「${item.label}」`} className="fixed z-nav rounded-lg border border-line bg-surface p-4 shadow-xl" style={style}>
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate font-medium">{item.label}</div>
          <div className="text-xs text-ink-muted">目前：{STATUS_LABEL[item.status] ?? item.status}・負責人 {item.sub}</div>
        </div>
        <button type="button" className="btn-icon btn-secondary" onClick={onClose} aria-label="關閉"><X className="h-4 w-4" aria-hidden /></button>
      </div>
      {item.signActions.length > 0 ? (
        <>
          <label className="block">
            <span className="label">簽核意見{item.signActions.includes("REJECT") ? "（退回時必填）" : "（選填）"}</span>
            <textarea value={note} onChange={(e) => { setNote(e.target.value); setErr(""); }} rows={2} maxLength={1000} className="input" />
          </label>
          {err && <p role="alert" className="mt-1 text-xs text-danger">{err}</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            {item.signActions.map((a) => (
              <button key={a} type="button" disabled={pending} className={`${SIGN_STYLE[a]} btn-sm`}
                onClick={() => { if (a === "REJECT" && !note.trim()) { setErr("退回時請填寫原因"); return; } onSign(a, note.trim() || undefined); }}>
                {SIGN_LABEL[a]}
              </button>
            ))}
          </div>
        </>
      ) : (
        <p className="text-sm text-ink-muted">您目前沒有可執行的簽核動作（負責人可送審，專案經理可核准 / 退回）。</p>
      )}
      <div className="mt-4 border-t border-line pt-3">
        <div className="mb-1.5 flex items-center gap-1 text-xs font-medium text-ink-muted"><History className="h-3.5 w-3.5" aria-hidden />簽核紀錄</div>
        {item.approvals.length === 0 ? <p className="text-xs text-ink-muted">尚無簽核紀錄</p> : (
          <ol className="space-y-1.5 text-xs">
            {item.approvals.map((a, k) => (
              <li key={k}><span className="font-medium text-ink">{a.by}</span> {SIGN_LABEL[a.action] ?? a.action}<span className="ml-1 text-ink-muted">{fmtTime(a.at)}</span>{a.note && <div className="text-ink-muted">「{a.note}」</div>}</li>
            ))}
          </ol>
        )}
        <Link href={item.href} className="link mt-2 inline-flex items-center gap-1 text-xs">完整紀錄<ExternalLink className="h-3 w-3" aria-hidden /></Link>
      </div>
    </div>,
    document.body,
  );
}
