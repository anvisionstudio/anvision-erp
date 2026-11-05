"use client";
import { useId, useMemo, useState, useTransition, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Loader2, Plus, Printer, Trash2 } from "lucide-react";

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
export function ConfirmButton({ action, children, message = "確定要執行嗎？", className = "btn-danger btn-sm", label }: { action: () => Promise<void>; children: ReactNode; message?: string; className?: string; label?: string }) {
  const [pending, start] = useTransition();
  const iconOnly = children === "✕";
  return (
    <button
      type="button"
      className={iconOnly ? `${className} btn-icon` : className}
      disabled={pending}
      aria-busy={pending}
      aria-label={iconOnly ? label ?? "刪除" : label}
      title={iconOnly ? label ?? "刪除" : undefined}
      onClick={() => confirm(message) && start(() => action())}
    >
      {pending ? <Spinner /> : iconOnly ? <Trash2 className="h-4 w-4" aria-hidden /> : children}
    </button>
  );
}

export function PrintButton() {
  return (
    <button type="button" className="btn-secondary" onClick={() => window.print()}>
      <Printer className="h-4 w-4" aria-hidden />列印 / PDF
    </button>
  );
}

type Item = { description: string; quantity: number; unitPrice: number; itemId?: string | null };
const fmt = (n: number) => "NT$ " + Math.round(n).toLocaleString("zh-TW");

/**
 * 報價單 / 請款單 / 採購單共用的行項目編輯器。
 * 手機：每個項目一張卡片（欄位上下排列、標籤可見）；桌面：表格式欄位排列。
 */
export function LineItems({
  initial,
  initialTaxRate = 0.05,
  catalog,
}: {
  initial?: Item[];
  initialTaxRate?: number;
  catalog?: { id: string; label: string; cost: number }[];
}) {
  const uid = useId();
  const [items, setItems] = useState<Item[]>(initial?.length ? initial : [{ description: "", quantity: 1, unitPrice: 0 }]);
  const [taxRate, setTaxRate] = useState(initialTaxRate);
  const t = useMemo(() => {
    const subtotal = Math.round(items.reduce((s, i) => s + (Number(i.quantity) || 0) * (Number(i.unitPrice) || 0), 0));
    const tax = Math.round(subtotal * taxRate);
    return { subtotal, tax, total: subtotal + tax };
  }, [items, taxRate]);
  const set = (idx: number, patch: Partial<Item>) => setItems((xs) => xs.map((x, i) => (i === idx ? { ...x, ...patch } : x)));
  const cols = catalog ? "md:grid-cols-[12rem_minmax(0,1fr)_6rem_8rem_8rem_2.5rem]" : "md:grid-cols-[minmax(0,1fr)_6rem_8rem_8rem_2.5rem]";
  const lbl = "label md:sr-only";

  return (
    <fieldset>
      <legend className="sr-only">項目明細</legend>
      <input type="hidden" name="items" value={JSON.stringify(items)} />
      <input type="hidden" name="taxRate" value={taxRate} />
      <div className={`hidden gap-3 border-b border-line pb-2 text-xs font-medium text-ink-muted md:grid ${cols}`} aria-hidden>
        {catalog && <span>庫存品項</span>}<span>項目說明</span><span className="text-right">數量</span><span className="text-right">單價</span><span className="text-right">金額</span><span />
      </div>
      <ol className="space-y-3 md:space-y-0">
        {items.map((it, idx) => (
          <li key={idx} className={`grid grid-cols-2 gap-3 rounded-lg border border-line p-3 md:items-center md:rounded-none md:border-0 md:border-b md:px-0 md:py-2 ${cols}`}>
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
            <label className="col-span-2 md:col-span-1">
              <span className={lbl}>項目說明 {idx + 1}</span>
              <input className="input" value={it.description} placeholder="例如：品牌識別設計" onChange={(e) => set(idx, { description: e.target.value })} aria-label={`項目 ${idx + 1} 說明`} />
            </label>
            <label>
              <span className={lbl}>數量</span>
              <input className="input text-right" type="number" inputMode="decimal" step="any" value={it.quantity} onChange={(e) => set(idx, { quantity: Number(e.target.value) })} aria-label={`項目 ${idx + 1} 數量`} />
            </label>
            <label>
              <span className={lbl}>單價</span>
              <input className="input text-right" type="number" inputMode="decimal" step="any" value={it.unitPrice} onChange={(e) => set(idx, { unitPrice: Number(e.target.value) })} aria-label={`項目 ${idx + 1} 單價`} />
            </label>
            <div className="flex items-center justify-between md:justify-end">
              <span className="text-sm text-ink-muted md:sr-only">金額</span>
              <span className="num font-medium">{fmt((it.quantity || 0) * (it.unitPrice || 0))}</span>
            </div>
            <div className="flex justify-end">
              <button type="button" className="btn-icon btn-secondary text-ink-muted hover:text-danger" onClick={() => setItems((xs) => xs.filter((_, i) => i !== idx))} aria-label={`刪除項目 ${idx + 1}`} title="刪除項目">
                <Trash2 className="h-4 w-4" aria-hidden />
              </button>
            </div>
          </li>
        ))}
      </ol>
      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <button type="button" className="btn-secondary self-start" onClick={() => setItems((xs) => [...xs, { description: "", quantity: 1, unitPrice: 0 }])}>
          <Plus className="h-4 w-4" aria-hidden />新增項目
        </button>
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
