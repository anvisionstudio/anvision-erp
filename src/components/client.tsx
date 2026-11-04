"use client";
import { useMemo, useState, useTransition, type ReactNode } from "react";
import { useFormStatus } from "react-dom";

export function SubmitButton({ children, className = "btn-primary" }: { children: ReactNode; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending}>
      {pending ? "處理中…" : children}
    </button>
  );
}

/** 需要確認的動作按鈕（刪除、作廢等） */
export function ConfirmButton({ action, children, message = "確定要執行嗎？", className = "btn-danger btn-sm" }: { action: () => Promise<void>; children: ReactNode; message?: string; className?: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      className={className}
      disabled={pending}
      onClick={() => confirm(message) && start(() => action())}
    >
      {pending ? "…" : children}
    </button>
  );
}

export function PrintButton() {
  return (
    <button type="button" className="btn-secondary" onClick={() => window.print()}>
      列印 / PDF
    </button>
  );
}

type Item = { description: string; quantity: number; unitPrice: number; itemId?: string | null };

/** 報價單 / 請款單 / 採購單共用的行項目編輯器 */
export function LineItems({
  initial,
  initialTaxRate = 0.05,
  catalog,
}: {
  initial?: Item[];
  initialTaxRate?: number;
  catalog?: { id: string; label: string; cost: number }[];
}) {
  const [items, setItems] = useState<Item[]>(initial?.length ? initial : [{ description: "", quantity: 1, unitPrice: 0 }]);
  const [taxRate, setTaxRate] = useState(initialTaxRate);
  const t = useMemo(() => {
    const subtotal = Math.round(items.reduce((s, i) => s + (Number(i.quantity) || 0) * (Number(i.unitPrice) || 0), 0));
    const tax = Math.round(subtotal * taxRate);
    return { subtotal, tax, total: subtotal + tax };
  }, [items, taxRate]);
  const set = (idx: number, patch: Partial<Item>) => setItems((xs) => xs.map((x, i) => (i === idx ? { ...x, ...patch } : x)));
  const fmt = (n: number) => "NT$ " + n.toLocaleString("zh-TW");

  return (
    <div>
      <input type="hidden" name="items" value={JSON.stringify(items)} />
      <input type="hidden" name="taxRate" value={taxRate} />
      <div className="overflow-x-auto">
        <table className="tbl">
          <thead>
            <tr>
              {catalog && <th className="w-48">庫存品項</th>}
              <th>項目說明</th>
              <th className="w-24 text-right">數量</th>
              <th className="w-32 text-right">單價</th>
              <th className="w-32 text-right">金額</th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {items.map((it, idx) => (
              <tr key={idx}>
                {catalog && (
                  <td>
                    <select
                      className="input"
                      value={it.itemId ?? ""}
                      onChange={(e) => {
                        const c = catalog.find((x) => x.id === e.target.value);
                        set(idx, { itemId: e.target.value || null, ...(c ? { description: c.label, unitPrice: c.cost } : {}) });
                      }}
                    >
                      <option value="">（非庫存）</option>
                      {catalog.map((c) => (
                        <option key={c.id} value={c.id}>{c.label}</option>
                      ))}
                    </select>
                  </td>
                )}
                <td>
                  <input className="input" value={it.description} placeholder="例如：品牌識別設計" onChange={(e) => set(idx, { description: e.target.value })} />
                </td>
                <td>
                  <input className="input text-right" type="number" step="any" value={it.quantity} onChange={(e) => set(idx, { quantity: Number(e.target.value) })} />
                </td>
                <td>
                  <input className="input text-right" type="number" step="any" value={it.unitPrice} onChange={(e) => set(idx, { unitPrice: Number(e.target.value) })} />
                </td>
                <td className="num">{fmt(Math.round((it.quantity || 0) * (it.unitPrice || 0)))}</td>
                <td>
                  <button type="button" className="text-slate-400 hover:text-red-600" onClick={() => setItems((xs) => xs.filter((_, i) => i !== idx))} aria-label="刪除">
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <button type="button" className="btn-secondary btn-sm" onClick={() => setItems((xs) => [...xs, { description: "", quantity: 1, unitPrice: 0 }])}>
          ＋ 新增項目
        </button>
        <div className="w-64 space-y-1 text-sm">
          <div className="flex justify-between"><span className="text-slate-500">小計（未稅）</span><span className="tabular-nums">{fmt(t.subtotal)}</span></div>
          <div className="flex items-center justify-between">
            <span className="text-slate-500">
              營業稅
              <select className="ml-2 rounded border border-slate-300 px-1 py-0.5 text-xs" value={taxRate} onChange={(e) => setTaxRate(Number(e.target.value))}>
                <option value={0.05}>5%</option>
                <option value={0}>免稅 / 0%</option>
              </select>
            </span>
            <span className="tabular-nums">{fmt(t.tax)}</span>
          </div>
          <div className="flex justify-between border-t border-slate-200 pt-1 font-semibold"><span>總計</span><span className="tabular-nums">{fmt(t.total)}</span></div>
        </div>
      </div>
    </div>
  );
}

/** 手動傳票分錄編輯器 */
export function JournalLines({ accounts }: { accounts: { id: string; label: string }[] }) {
  const blank = { accountId: "", debit: 0, credit: 0, memo: "" };
  const [lines, setLines] = useState([{ ...blank }, { ...blank }]);
  const dr = lines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
  const cr = lines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
  const balanced = Math.abs(dr - cr) < 0.005 && dr > 0;
  const set = (i: number, p: Partial<typeof blank>) => setLines((xs) => xs.map((x, j) => (j === i ? { ...x, ...p } : x)));
  return (
    <div>
      <input type="hidden" name="lines" value={JSON.stringify(lines)} />
      <table className="tbl">
        <thead><tr><th>會計科目</th><th className="w-32 text-right">借方</th><th className="w-32 text-right">貸方</th><th>摘要</th><th className="w-8" /></tr></thead>
        <tbody>
          {lines.map((l, i) => (
            <tr key={i}>
              <td>
                <select className="input" value={l.accountId} onChange={(e) => set(i, { accountId: e.target.value })}>
                  <option value="">選擇科目</option>
                  {accounts.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
                </select>
              </td>
              <td><input className="input text-right" type="number" step="any" value={l.debit} onChange={(e) => set(i, { debit: Number(e.target.value) })} /></td>
              <td><input className="input text-right" type="number" step="any" value={l.credit} onChange={(e) => set(i, { credit: Number(e.target.value) })} /></td>
              <td><input className="input" value={l.memo} onChange={(e) => set(i, { memo: e.target.value })} /></td>
              <td><button type="button" className="text-slate-400 hover:text-red-600" onClick={() => setLines((xs) => xs.filter((_, j) => j !== i))}>✕</button></td>
            </tr>
          ))}
          <tr className="font-medium">
            <td className="text-right text-slate-500">合計</td>
            <td className="num">{dr.toLocaleString()}</td>
            <td className="num">{cr.toLocaleString()}</td>
            <td colSpan={2} className={balanced ? "text-emerald-600" : "text-red-600"}>{balanced ? "✓ 借貸平衡" : "借貸尚未平衡"}</td>
          </tr>
        </tbody>
      </table>
      <button type="button" className="btn-secondary btn-sm mt-2" onClick={() => setLines((xs) => [...xs, { ...blank }])}>＋ 新增分錄</button>
    </div>
  );
}
