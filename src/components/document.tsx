import { Fragment, type ReactNode } from "react";
import { twd, num, date, totals } from "@/lib/format";
import { getCompany } from "@/lib/settings";

type Party = { name: string; taxId?: string | null; contact?: string | null; address?: string | null; phone?: string | null; email?: string | null };

/** 可列印的單據（報價單 / 請款單 / 採購單） */
export async function DocumentView({
  kind, number, party, partyLabel, meta, items, taxRate, notes, footer, showBank,
}: {
  kind: string; number: string; party: Party; partyLabel: string;
  meta: [string, ReactNode][]; items: { description: string; quantity: number; unitPrice: number }[];
  taxRate: number; notes?: string | null; footer?: ReactNode; showBank?: boolean;
}) {
  const co = await getCompany();
  const t = totals(items, taxRate);
  return (
    <div className="card p-4 sm:p-8 print:p-0">
      <div className="flex flex-wrap justify-between gap-6 border-b border-line pb-6">
        <div>
          <div className="text-lg font-bold text-brand-900">{co.name}</div>
          <div className="mt-1 space-y-0.5 text-xs text-ink-muted">
            {co.taxId && <div>統一編號 {co.taxId}</div>}
            {co.address && <div>{co.address}</div>}
            {(co.phone || co.email) && <div>{co.phone} {co.email}</div>}
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-semibold tracking-widest text-ink">{kind}</div>
          <div className="mt-1 font-mono text-sm text-ink-muted">{number}</div>
        </div>
      </div>
      <div className="grid gap-6 py-6 md:grid-cols-2">
        <div>
          <div className="label">{partyLabel}</div>
          <div className="font-medium">{party.name}</div>
          <div className="space-y-0.5 text-sm text-ink-muted">
            {party.taxId && <div>統編 {party.taxId}</div>}
            {party.contact && <div>聯絡人 {party.contact}</div>}
            {party.address && <div>{party.address}</div>}
            {(party.phone || party.email) && <div>{party.phone} {party.email}</div>}
          </div>
        </div>
        <dl className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 self-start text-sm md:justify-self-end">
          {meta.map(([k, v]) => (<Fragment key={k}><dt className="text-ink-muted">{k}</dt><dd className="break-words text-right">{v}</dd></Fragment>))}
        </dl>
      </div>
      <div className="-mx-4 overflow-x-auto sm:mx-0" tabIndex={0} role="region" aria-label="項目明細">
      <table className="tbl">
        <thead><tr><th className="w-10">#</th><th>項目</th><th className="text-right">數量</th><th className="text-right">單價</th><th className="text-right">金額</th></tr></thead>
        <tbody>
          {items.map((i, idx) => (
            <tr key={idx}><td className="text-ink-muted">{idx + 1}</td><td>{i.description}</td><td className="num">{num(i.quantity, i.quantity % 1 ? 2 : 0)}</td><td className="num">{twd(i.unitPrice)}</td><td className="num">{twd(i.quantity * i.unitPrice)}</td></tr>
          ))}
        </tbody>
      </table>
      </div>
      <div className="mt-4 flex justify-end">
        <div className="w-full space-y-1 text-sm sm:w-72">
          <div className="flex justify-between"><span className="text-ink-muted">小計（未稅）</span><span className="tabular-nums">{twd(t.subtotal)}</span></div>
          <div className="flex justify-between"><span className="text-ink-muted">營業稅 {Math.round(taxRate * 100)}%</span><span className="tabular-nums">{twd(t.tax)}</span></div>
          <div className="flex justify-between border-t border-line pt-2 text-base font-semibold"><span>總計</span><span className="tabular-nums">{twd(t.total)}</span></div>
          {footer}
        </div>
      </div>
      {(notes || (showBank && co.bank)) && (
        <div className="mt-8 space-y-3 border-t border-line pt-4 text-sm text-ink-muted">
          {showBank && co.bank && <div><span className="label">匯款資訊</span><div className="whitespace-pre-line">{co.bank}</div></div>}
          {notes && <div><span className="label">備註</span><div className="whitespace-pre-line">{notes}</div></div>}
        </div>
      )}
      <div className="mt-10 hidden grid-cols-2 gap-10 text-sm text-ink-muted print:grid">
        <div className="border-t border-line pt-2">{co.name} 簽章</div>
        <div className="border-t border-line pt-2">{party.name} 簽章</div>
      </div>
      <div className="mt-6 text-right text-xs text-ink-muted print:block">列印日期 {date(new Date())}</div>
    </div>
  );
}
