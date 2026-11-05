"use client";
import { useEffect, useMemo, useRef, useState, useTransition, type PointerEvent as RPointerEvent, type KeyboardEvent as RKeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronDown, ChevronRight, CalendarClock, LocateFixed } from "lucide-react";

/**
 * Notion 風格時間軸（甘特圖）。
 * - 拖曳長條移動；拖曳左右邊緣調整開始 / 截止日（以「天」為單位）
 * - 鍵盤：聚焦長條後 ←/→ 移動一天、Shift+←/→ 調整截止日、Enter 開啟
 * - 名稱欄固定在左側，圖表在容器內水平捲動（整頁不會橫向捲動）
 */
export type TimelineItem = {
  id: string;
  kind: "project" | "task";
  parentId?: string | null;
  label: string;
  sub?: string | null;
  start?: string | null; // YYYY-MM-DD
  end?: string | null;
  tone: "gray" | "blue" | "amber" | "green" | "red" | "primary";
  href: string;
  editable: boolean;
  done?: boolean;
};
type Zoom = "week" | "month" | "quarter";
type Mover = (id: string, start: string, end: string) => Promise<void>;

const DAY = 864e5;
const DAY_W: Record<Zoom, number> = { week: 40, month: 16, quarter: 6 };
const ZOOM_LABEL: Record<Zoom, string> = { week: "週", month: "月", quarter: "季" };
const ROW_H = 44; // 觸控目標 ≥ 44px
const WEEKDAY = ["日", "一", "二", "三", "四", "五", "六"];
const toDay = (s: string) => Math.floor(Date.parse(s.slice(0, 10) + "T00:00:00Z") / DAY);
const toISO = (d: number) => new Date(d * DAY).toISOString().slice(0, 10);
const BAR: Record<TimelineItem["tone"], string> = {
  gray: "bg-slate-200 text-ink ring-slate-300",
  blue: "bg-blue-100 text-blue-900 ring-blue-300",
  amber: "bg-amber-100 text-amber-900 ring-amber-300",
  green: "bg-emerald-100 text-emerald-900 ring-emerald-300",
  red: "bg-red-100 text-red-900 ring-red-300",
  primary: "bg-primary text-primary-on ring-primary",
};

export function Timeline({
  items: initial, moveTask, moveProject, defaultZoom = "month", emptyText = "沒有可顯示的項目",
}: {
  items: TimelineItem[]; moveTask?: Mover; moveProject?: Mover; defaultZoom?: Zoom; emptyText?: string;
}) {
  const router = useRouter();
  const [items, setItems] = useState(initial);
  useEffect(() => setItems(initial), [initial]);
  const [zoom, setZoom] = useState<Zoom>(defaultZoom);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [drag, setDrag] = useState<{ id: string; mode: "move" | "start" | "end"; x0: number; delta: number } | null>(null);
  const [announce, setAnnounce] = useState("");
  const [, start] = useTransition();
  const scroller = useRef<HTMLDivElement>(null);
  const today = Math.floor(Date.now() / DAY);
  const dw = DAY_W[zoom];

  // 顯示範圍：涵蓋所有項目，並至少包含今天前後
  const [from, to] = useMemo(() => {
    let lo = today - 14, hi = today + 60;
    for (const i of items) {
      if (i.start) lo = Math.min(lo, toDay(i.start) - 7);
      if (i.end) hi = Math.max(hi, toDay(i.end) + 14);
    }
    const pad = zoom === "quarter" ? 30 : 7;
    return [lo - pad, hi + pad];
  }, [items, today, zoom]);
  const days = to - from + 1;
  const width = days * dw;

  // 開啟時捲動到今天
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollLeft = Math.max(0, (today - from) * dw - el.clientWidth / 3);
  }, [zoom, from, dw, today]);

  const visible = items.filter((i) => !(i.parentId && collapsed.has(i.parentId)));
  const hasChildren = useMemo(() => new Set(items.filter((i) => i.parentId).map((i) => i.parentId!)), [items]);

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

  const commit = (i: TimelineItem, s: number, e: number) => {
    const fn = i.kind === "task" ? moveTask : moveProject;
    if (!fn) return;
    const prev = items;
    setItems((xs) => xs.map((x) => (x.id === i.id ? { ...x, start: toISO(s), end: toISO(e) } : x)));
    setAnnounce(`${i.label}：${toISO(s)} 至 ${toISO(e)}`);
    start(async () => {
      try {
        await fn(i.id, toISO(s), toISO(e));
        router.refresh();
      } catch (err) {
        setItems(prev);
        alert((err as Error).message || "更新失敗");
      }
    });
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
    if (moved && r && drag.delta !== 0) commit(i, r.s, r.e);
    else if (!moved) router.push(i.href);
  };
  const onKey = (e: RKeyboardEvent<HTMLElement>, i: TimelineItem) => {
    if (!i.editable || (e.key !== "ArrowLeft" && e.key !== "ArrowRight")) return;
    const r = range(i);
    if (!r) return;
    e.preventDefault();
    const d = e.key === "ArrowLeft" ? -1 : 1;
    if (e.shiftKey) commit(i, r.s, Math.max(r.s, r.e + d));
    else commit(i, r.s + d, r.e + d);
  };

  // 表頭：月份列 + 日 / 週列
  const months: { label: string; left: number; width: number }[] = [];
  const ticks: { label: string; sub?: string; left: number; weekend?: boolean; today?: boolean }[] = [];
  for (let d = from; d <= to; d++) {
    const date = new Date(d * DAY);
    const dom = date.getUTCDate(), dow = date.getUTCDay();
    if (dom === 1 || d === from) {
      const next = Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1) / DAY;
      months.push({ label: `${date.getUTCFullYear()}年${date.getUTCMonth() + 1}月`, left: (d - from) * dw, width: (Math.min(next, to + 1) - d) * dw });
    }
    if (zoom === "week") ticks.push({ label: String(dom), sub: WEEKDAY[dow], left: (d - from) * dw, weekend: dow === 0 || dow === 6, today: d === today });
    else if (zoom === "month" && dow === 1) ticks.push({ label: `${date.getUTCMonth() + 1}/${dom}`, left: (d - from) * dw, today: false });
  }
  const weekends = zoom === "quarter" ? [] : Array.from({ length: days }, (_, k) => from + k).filter((d) => [0, 6].includes(new Date(d * DAY).getUTCDay()));

  const scrollToday = () => {
    const el = scroller.current;
    if (el) el.scrollTo({ left: Math.max(0, (today - from) * dw - el.clientWidth / 3), behavior: "smooth" });
  };

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-3 py-2">
        <div role="group" aria-label="時間刻度" className="inline-flex rounded-md ring-1 ring-line">
          {(Object.keys(DAY_W) as Zoom[]).map((z) => (
            <button key={z} type="button" onClick={() => setZoom(z)} aria-pressed={zoom === z}
              className={`min-h-touch px-4 text-sm first:rounded-l-md last:rounded-r-md md:min-h-[2.25rem] ${zoom === z ? "bg-primary text-primary-on" : "bg-surface text-ink-muted hover:text-ink"}`}>
              {ZOOM_LABEL[z]}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden text-xs text-ink-muted lg:inline">拖曳長條移動、拖曳邊緣調整日期；鍵盤 ←/→ 移動、Shift+←/→ 調整截止日</span>
          <button type="button" className="btn-secondary btn-sm" onClick={scrollToday}><LocateFixed className="h-4 w-4" aria-hidden />今天</button>
        </div>
      </div>
      <p className="sr-only" aria-live="polite">{announce}</p>
      {visible.length === 0 ? (
        <div className="px-4 py-10 text-center text-sm text-ink-muted">{emptyText}</div>
      ) : (
        <div ref={scroller} className="relative max-h-[70dvh] overflow-auto" tabIndex={0} role="region" aria-label="時間軸">
          <div className="relative" style={{ width: `calc(var(--tl-label) + ${width}px)`, ["--tl-label" as string]: "clamp(9rem, 28vw, 16rem)" }}>
            {/* 表頭 */}
            <div className="sticky top-0 z-sticky flex border-b border-line bg-surface">
              <div className="sticky left-0 z-sticky w-[var(--tl-label)] shrink-0 border-r border-line bg-surface px-3 py-2 text-xs font-medium text-ink-muted">名稱</div>
              <div className="relative h-12 shrink-0" style={{ width }}>
                {months.map((m) => (
                  <div key={m.left} className="absolute top-0 h-6 truncate border-l border-line px-1.5 text-xs font-medium leading-6 text-ink" style={{ left: m.left, width: m.width }}>{m.label}</div>
                ))}
                {ticks.map((t) => (
                  <div key={t.left} className={`absolute top-6 h-6 text-center text-xs leading-6 ${t.today ? "font-semibold text-primary" : t.weekend ? "text-ink-subtle" : "text-ink-muted"}`} style={{ left: t.left, width: zoom === "week" ? dw : 40 }}>
                    {t.label}{t.sub && <span className="ml-0.5 text-[0.75rem]">{t.sub}</span>}
                  </div>
                ))}
              </div>
            </div>
            {/* 背景：週末、今天 */}
            <div className="pointer-events-none absolute bottom-0 top-12" style={{ left: "var(--tl-label)", width }} aria-hidden>
              {weekends.map((d) => <div key={d} className="absolute inset-y-0 bg-surface-muted" style={{ left: (d - from) * dw, width: dw }} />)}
              <div className="absolute inset-y-0 w-0.5 bg-danger/70" style={{ left: (today - from) * dw + dw / 2 }} />
            </div>
            {/* 列 */}
            <ul className="relative">
              {visible.map((i) => {
                const r = range(i);
                const isParent = hasChildren.has(i.id);
                const open = !collapsed.has(i.id);
                const left = r ? (r.s - from) * dw : 0;
                const w = r ? (r.e - r.s + 1) * dw : 0;
                const dates = r ? `${toISO(r.s)} – ${toISO(r.e)}` : "未排程";
                return (
                  <li key={i.id} className="flex border-b border-line/70" style={{ height: ROW_H }}>
                    <div className={`sticky left-0 z-[5] flex w-[var(--tl-label)] shrink-0 items-center gap-1 border-r border-line bg-surface pr-2 ${i.kind === "task" && i.parentId ? "pl-7" : "pl-1"}`}>
                      {isParent ? (
                        <button type="button" className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded text-ink-muted hover:bg-surface-muted md:h-9 md:w-9" aria-expanded={open}
                          aria-label={`${open ? "收合" : "展開"} ${i.label}`} onClick={() => setCollapsed((c) => { const n = new Set(c); if (n.has(i.id)) n.delete(i.id); else n.add(i.id); return n; })}>
                          {open ? <ChevronDown className="h-4 w-4" aria-hidden /> : <ChevronRight className="h-4 w-4" aria-hidden />}
                        </button>
                      ) : i.kind === "project" ? <span className="w-11 shrink-0 md:w-9" /> : null}
                      <Link href={i.href} className={`flex h-full min-w-0 flex-1 items-center text-sm hover:underline ${i.kind === "project" ? "font-medium" : ""} ${i.done ? "text-ink-muted line-through" : "text-ink"}`} title={i.label}>
                        <span className="truncate">{i.label}{i.sub && <span className="ml-1 text-xs font-normal text-ink-muted">{i.sub}</span>}</span>
                      </Link>
                    </div>
                    <div className="relative shrink-0" style={{ width }}>
                      {r ? (
                        <a
                          href={i.href}
                          onClick={(e) => e.preventDefault()}
                          draggable={false}
                          onDragStart={(e) => e.preventDefault()}
                          onPointerDown={(e) => onPointerDown(e, i)}
                          onPointerMove={onPointerMove}
                          onPointerUp={(e) => onPointerUp(e, i)}
                          onPointerCancel={() => setDrag(null)}
                          onKeyDown={(e) => { if (e.key === "Enter") router.push(i.href); else onKey(e, i); }}
                          aria-label={`${i.label}，${dates}${i.editable ? "，可用左右鍵調整" : ""}`}
                          title={`${i.label}\n${dates}`}
                          className={`absolute top-2 flex h-7 select-none items-center overflow-hidden rounded-md px-2 text-xs font-medium ring-1 ring-inset transition-shadow duration-150 hover:shadow-md ${BAR[i.tone]} ${i.editable ? "cursor-grab touch-none active:cursor-grabbing" : ""} ${drag?.id === i.id ? "shadow-lg ring-2" : ""}`}
                          style={{ left, width: Math.max(w, dw) }}
                        >
                          {i.editable && <span className="absolute inset-y-0 left-0 w-2 cursor-ew-resize" aria-hidden />}
                          <span className="truncate">{w >= 60 ? i.label : ""}</span>
                          {i.editable && <span className="absolute inset-y-0 right-0 w-2 cursor-ew-resize" aria-hidden />}
                        </a>
                      ) : (
                        <Link href={i.href} className="absolute top-2.5 inline-flex h-6 items-center gap-1 rounded-full bg-surface px-2 text-xs text-ink-muted ring-1 ring-line hover:text-ink"
                          style={{ left: (today - from) * dw + 8 }}>
                          <CalendarClock className="h-3.5 w-3.5" aria-hidden />未排程
                        </Link>
                      )}
                      {r && w < 60 && <span className="pointer-events-none absolute top-3 whitespace-nowrap text-xs text-ink-muted" style={{ left: left + Math.max(w, dw) + 6 }}>{i.label}</span>}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
