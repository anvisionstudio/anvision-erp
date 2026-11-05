"use client";
import { useId, useMemo, useState, useTransition, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { ArrowDown, ArrowUp, ListTree, Loader2, Plus, Printer, Trash2 } from "lucide-react";

function Spinner() {
  return <Loader2 className="h-4 w-4 animate-spin" aria-hidden />;
}

export function SubmitButton({ children, className = "btn-primary" }: { children: ReactNode; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending} aria-busy={pending}>
      {pending ? <><Spinner />處理中…</> : children}
    </button>
  );
}

/** 需要確認的動作按鈕（刪除、作廢等）。內容為「✕」時顯示垃圾桶圖示並附無障礙名稱 */
export function ConfirmButton({ action, children, message = "確定要執行嗎？", className = "btn-danger btn-sm", label }: { action: () => Promise<unknown>; children: ReactNode; message?: string; className?: string; label?: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const iconOnly = children === "✕";
  const run = () => start(async () => {
    setError(null);
    try {
      const r = await action();
      if (r && typeof r === "object" && "error" in r && (r as { error?: string }).error) setError((r as { error: string }).error);
    } catch {
      setError("操作失敗，請重新整理後再試");
    }
  });
  return (
    <span className="relative inline-flex">
      <button
        type="button"
        className={iconOnly ? `${className} btn-icon` : className}
        disabled={pending}
        aria-busy={pending}
        aria-label={iconOnly ? label ?? "刪除" : label}
        title={iconOnly ? label ?? "刪除" : undefined}
        onClick={() => confirm(message) && run()}
      >
        {pending ? <Spinner /> : iconOnly ? <Trash2 className="h-4 w-4" aria-hidden /> : children}
      </button>
      {error && (
        <span role="alert" className="absolute right-0 top-full z-dropdown mt-1 w-max max-w-[18rem] rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-left text-xs font-normal text-danger shadow-md">
          {error}
          <button type="button" className="ml-2 underline" onClick={() => setError(null)}>關閉</button>
        </span>
      )}
    </span>
  );
}

export function PrintButton() {
  return (
    <button type="button" className="btn-secondary" onClick={() => window.print()}>
      <Printer className="h-4 w-4" aria-hidden />列印 / PDF
    </button>
  );
}

type Item = { description: string; quantity: number; unitPrice: number; itemId?: string | null; unit?: string | null; isGroup?: boolean };
const fmt = (n: number) => "NT$ " + Math.round(n).toLocaleString("zh-TW");
const UNITS = ["式", "篇", "支", "則", "場", "張", "份", "頁", "個", "組", "次", "月", "小時"];

/**
 * 報價單 / 請款單 / 採購單共用的行項目編輯器。
 * 手機：每個項目一張卡片（欄位上下排列、標籤可見）；桌面：表格式欄位排列。
 * withUnits：顯示「單位」與「分類標題」（報價單 / 請款單版面使用）。
 */
export function LineItems({
  initial,
  initialTaxRate = 0.05,
  catalog,
  withUnits = false,
}: {
  initial?: Item[];
  initialTaxRate?: number;
  catalog?: { id: string; label: string; cost: number }[];
  withUnits?: boolean;
}) {
  const uid = useId();
  const [items, setItems] = useState<Item[]>(initial?.length ? initial.map((i) => ({ ...i })) : [{ description: "", quantity: 1, unitPrice: 0, unit: withUnits ? "式" : null }]);
  const [taxRate, setTaxRate] = useState(initialTaxRate);
  const t = useMemo(() => {
    const subtotal = Math.round(items.reduce((s, i) => s + (i.isGroup ? 0 : (Number(i.quantity) || 0) * (Number(i.unitPrice) || 0)), 0));
    const tax = Math.round(subtotal * taxRate);
    return { subtotal, tax, total: subtotal + tax };
  }, [items, taxRate]);
  const set = (idx: number, patch: Partial<Item>) => setItems((xs) => xs.map((x, i) => (i === idx ? { ...x, ...patch } : x)));
  const move = (idx: number, dir: -1 | 1) =>
    setItems((xs) => {
      const j = idx + dir;
      if (j < 0 || j >= xs.length) return xs;
      const ys = [...xs];
      [ys[idx], ys[j]] = [ys[j], ys[idx]];
      return ys;
    });
  const cols = catalog
    ? "md:grid-cols-[12rem_minmax(0,1fr)_6rem_8rem_8rem_auto]"
    : withUnits
      ? "md:grid-cols-[minmax(0,1fr)_5rem_5.5rem_7.5rem_7.5rem_auto]"
      : "md:grid-cols-[minmax(0,1fr)_6rem_8rem_8rem_auto]";
  const lbl = "label md:sr-only";
  let n = 0;
  const tools = (idx: number, name: string) => (
    <div className="flex justify-end gap-1">
      <button type="button" className="btn-icon btn-secondary text-ink-muted" onClick={() => move(idx, -1)} disabled={idx === 0} aria-label={`上移${name}`} title="上移"><ArrowUp className="h-4 w-4" aria-hidden /></button>
      <button type="button" className="btn-icon btn-secondary text-ink-muted" onClick={() => move(idx, 1)} disabled={idx === items.length - 1} aria-label={`下移${name}`} title="下移"><ArrowDown className="h-4 w-4" aria-hidden /></button>
      <button type="button" className="btn-icon btn-secondary text-ink-muted hover:text-danger" onClick={() => setItems((xs) => xs.filter((_, i) => i !== idx))} aria-label={`刪除${name}`} title="刪除"><Trash2 className="h-4 w-4" aria-hidden /></button>
    </div>
  );

  return (
    <fieldset>
      <legend className="sr-only">項目明細</legend>
      <input type="hidden" name="items" value={JSON.stringify(items)} />
      <input type="hidden" name="taxRate" value={taxRate} />
      <datalist id={`${uid}-units`}>{UNITS.map((u) => <option key={u} value={u} />)}</datalist>
      <div className={`hidden gap-3 border-b border-line pb-2 text-xs font-medium text-ink-muted md:grid ${cols}`} aria-hidden>
        {catalog && <span>庫存品項</span>}<span>項目說明</span><span className="text-right">數量</span>{withUnits && <span>單位</span>}<span className="text-right">單價</span><span className="text-right">金額</span><span className="w-[6.75rem]" />
      </div>
      <ol className="space-y-3 md:space-y-0">
        {items.map((it, idx) => {
          if (it.isGroup) {
            return (
              <li key={idx} className="flex flex-col gap-2 rounded-lg border border-line bg-surface-muted p-3 sm:flex-row sm:items-center md:rounded-none md:border-0 md:border-b md:px-2 md:py-2">
                <label className="min-w-0 flex-1">
                  <span className="label">分類標題</span>
                  <input className="input font-medium" value={it.description} placeholder="例如：社群行銷服務-文案" onChange={(e) => set(idx, { description: e.target.value })} />
                </label>
                {tools(idx, "分類")}
              </li>
            );
          }
          n++;
          const no = n;
          return (
            <li key={idx} className={`grid grid-cols-2 gap-3 rounded-lg border border-line p-3 md:items-center md:rounded-none md:border-0 md:border-b md:px-0 md:py-2 ${withUnits ? "sm:grid-cols-3" : ""} ${cols}`}>
              {catalog && (
                <label className="col-span-2 md:col-span-1">
                  <span className={lbl}>庫存品項</span>
                  <select
                    className="input"
                    value={it.itemId ?? ""}
                    onChange={(e) => {
                      const c = catalog.find((x) => x.id === e.target.value);
                      set(idx, { itemId: e.target.value || null, ...(c ? { description: c.label, unitPrice: c.cost } : {}) });
                    }}
                  >
                    <option value="">（非庫存）</option>
                    {catalog.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </select>
                </label>
              )}
              <label className={`col-span-2 md:col-span-1 ${withUnits ? "sm:col-span-3" : ""}`}>
                <span className={lbl}>項目說明 {no}</span>
                <input className="input" value={it.description} placeholder="例如：貼文｜社群貼文文案" onChange={(e) => set(idx, { description: e.target.value })} aria-label={`項目 ${no} 說明`} />
              </label>
              <label>
                <span className={lbl}>數量</span>
                <input className="input text-right" type="number" inputMode="decimal" step="any" value={it.quantity} onChange={(e) => set(idx, { quantity: Number(e.target.value) })} aria-label={`項目 ${no} 數量`} />
              </label>
              {withUnits && (
                <label>
                  <span className={lbl}>單位</span>
                  <input className="input" list={`${uid}-units`} value={it.unit ?? ""} placeholder="式" onChange={(e) => set(idx, { unit: e.target.value })} aria-label={`項目 ${no} 單位`} />
                </label>
              )}
              <label>
                <span className={lbl}>單價</span>
                <input className="input text-right" type="number" inputMode="decimal" step="any" value={it.unitPrice} onChange={(e) => set(idx, { unitPrice: Number(e.target.value) })} aria-label={`項目 ${no} 單價`} />
              </label>
              <div className={`flex items-center justify-between md:justify-end ${withUnits ? "sm:col-span-2 md:col-span-1" : ""}`}>
                <span className="text-sm text-ink-muted md:sr-only">金額</span>
                <span className="num font-medium">{fmt((it.quantity || 0) * (it.unitPrice || 0))}</span>
              </div>
              <div className={withUnits ? "col-span-2 sm:col-span-1" : ""}>{tools(idx, `項目 ${no}`)}</div>
            </li>
          );
        })}
      </ol>
      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-secondary" onClick={() => setItems((xs) => [...xs, { description: "", quantity: 1, unitPrice: 0, unit: withUnits ? "式" : null }])}>
            <Plus className="h-4 w-4" aria-hidden />新增項目
          </button>
          {withUnits && (
            <button type="button" className="btn-secondary" onClick={() => setItems((xs) => [...xs, { description: "", quantity: 0, unitPrice: 0, isGroup: true }])}>
              <ListTree className="h-4 w-4" aria-hidden />新增分類
            </button>
          )}
        </div>
        <dl className="w-full space-y-1.5 text-sm sm:w-72">
          <div className="flex justify-between"><dt className="text-ink-muted">小計（未稅）</dt><dd className="num">{fmt(t.subtotal)}</dd></div>
          <div className="flex items-center justify-between gap-2">
            <dt className="flex items-center gap-2 text-ink-muted">
              <label htmlFor={`${uid}-tax`}>營業稅</label>
              <select id={`${uid}-tax`} className="input w-auto py-1" value={taxRate} onChange={(e) => setTaxRate(Number(e.target.value))}>
                <option value={0.05}>5%</option>
                <option value={0}>免稅 / 0%</option>
              </select>
            </dt>
            <dd className="num">{fmt(t.tax)}</dd>
          </div>
          <div className="flex justify-between border-t border-line pt-2 text-base font-semibold"><dt>總計</dt><dd className="num">{fmt(t.total)}</dd></div>
        </dl>
      </div>
    </fieldset>
  );
}

/** 手動傳票分錄編輯器（手機為卡片，桌面為表格式排列） */
export function JournalLines({ accounts }: { accounts: { id: string; label: string }[] }) {
  const blank = { accountId: "", debit: 0, credit: 0, memo: "" };
  const [lines, setLines] = useState([{ ...blank }, { ...blank }]);
  const dr = lines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
  const cr = lines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
  const balanced = Math.abs(dr - cr) < 0.005 && dr > 0;
  const set = (i: number, p: Partial<typeof blank>) => setLines((xs) => xs.map((x, j) => (j === i ? { ...x, ...p } : x)));
  const cols = "md:grid-cols-[minmax(0,1.4fr)_8rem_8rem_minmax(0,1fr)_2.5rem]";
  const lbl = "label md:sr-only";
  return (
    <fieldset>
      <legend className="sr-only">傳票分錄</legend>
      <input type="hidden" name="lines" value={JSON.stringify(lines)} />
      <div className={`hidden gap-3 border-b border-line pb-2 text-xs font-medium text-ink-muted md:grid ${cols}`} aria-hidden>
        <span>會計科目</span><span className="text-right">借方</span><span className="text-right">貸方</span><span>摘要</span><span />
      </div>
      <ol className="space-y-3 md:space-y-0">
        {lines.map((l, i) => (
          <li key={i} className={`grid grid-cols-2 gap-3 rounded-lg border border-line p-3 md:items-center md:rounded-none md:border-0 md:border-b md:px-0 md:py-2 ${cols}`}>
            <label className="col-span-2 md:col-span-1">
              <span className={lbl}>會計科目（第 {i + 1} 行）</span>
              <select className="input" value={l.accountId} onChange={(e) => set(i, { accountId: e.target.value })} aria-label={`第 ${i + 1} 行會計科目`}>
                <option value="">選擇科目</option>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
              </select>
            </label>
            <label><span className={lbl}>借方</span><input className="input text-right" type="number" inputMode="decimal" step="any" value={l.debit} onChange={(e) => set(i, { debit: Number(e.target.value) })} aria-label={`第 ${i + 1} 行借方`} /></label>
            <label><span className={lbl}>貸方</span><input className="input text-right" type="number" inputMode="decimal" step="any" value={l.credit} onChange={(e) => set(i, { credit: Number(e.target.value) })} aria-label={`第 ${i + 1} 行貸方`} /></label>
            <label className="col-span-2 md:col-span-1"><span className={lbl}>摘要</span><input className="input" value={l.memo} onChange={(e) => set(i, { memo: e.target.value })} aria-label={`第 ${i + 1} 行摘要`} /></label>
            <div className="col-span-2 flex justify-end md:col-span-1">
              <button type="button" className="btn-icon btn-secondary text-ink-muted hover:text-danger" onClick={() => setLines((xs) => xs.filter((_, j) => j !== i))} aria-label={`刪除第 ${i + 1} 行`} title="刪除分錄">
                <Trash2 className="h-4 w-4" aria-hidden />
              </button>
            </div>
          </li>
        ))}
      </ol>
      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button type="button" className="btn-secondary self-start" onClick={() => setLines((xs) => [...xs, { ...blank }])}><Plus className="h-4 w-4" aria-hidden />新增分錄</button>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          <span>借 <span className="num">{dr.toLocaleString()}</span></span>
          <span>貸 <span className="num">{cr.toLocaleString()}</span></span>
          <span role="status" className={`font-medium ${balanced ? "text-success" : "text-danger"}`}>{balanced ? "借貸平衡" : "借貸尚未平衡"}</span>
        </div>
      </div>
    </fieldset>
  );
}

/** 表單送出前跳確認視窗（例如合併、批次刪除） */
export function ConfirmSubmit({ children, message, className = "btn-danger" }: { children: ReactNode; message: string; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending} aria-busy={pending} onClick={(e) => { if (!confirm(message)) e.preventDefault(); }}>
      {pending ? <><Spinner />處理中…</> : children}
    </button>
  );
}
