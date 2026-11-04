import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { twd, date, num, isoDate } from "@/lib/format";
import { profitAndLoss, balanceSheet, accountBalances, arAging, projectProfit } from "@/lib/reports";
import { ACC, ACCOUNT_TYPE_LABEL, resolveAccount } from "@/lib/ledger";
import { PageHeader, Card, Tabs, Stat, Badge, Empty } from "@/components/ui";
import { PrintButton } from "@/components/client";

const TABS = [["pl", "損益表"], ["bs", "資產負債表"], ["tb", "試算表"], ["ar", "應收帳齡"], ["projects", "專案損益"], ["vat", "營業稅"]];

function Row({ label, value, bold, indent }: { label: string; value: number; bold?: boolean; indent?: boolean }) {
  return (
    <div className={`flex justify-between py-1.5 text-sm ${bold ? "border-t border-slate-200 font-semibold" : ""} ${indent ? "pl-4" : ""}`}>
      <span>{label}</span><span className="tabular-nums">{twd(value)}</span>
    </div>
  );
}

export default async function Reports({ searchParams }: { searchParams: Promise<{ tab?: string; from?: string; to?: string; year?: string }> }) {
  await requireUser("finance");
  const sp = await searchParams;
  const tab = sp.tab ?? "pl";
  const now = new Date();
  const from = sp.from ? new Date(sp.from) : new Date(now.getFullYear(), 0, 1);
  const to = sp.to ? new Date(sp.to + "T23:59:59") : now;
  const range = (
    <form className="no-print mb-4 flex flex-wrap items-center gap-2">
      <input type="hidden" name="tab" value={tab} />
      {tab !== "bs" && <><input type="date" name="from" defaultValue={isoDate(from)} className="input w-40" /><span className="text-slate-400">至</span></>}
      <input type="date" name="to" defaultValue={isoDate(to)} className="input w-40" />
      <button className="btn-secondary">更新</button>
    </form>
  );

  return (
    <>
      <PageHeader title="財務報表" actions={<PrintButton />} />
      <Tabs active={tab} tabs={TABS.map(([k, l]) => ({ key: k, label: l, href: `/reports?tab=${k}` }))} />

      {tab === "pl" && await (async () => {
        const pl = await profitAndLoss(from, to);
        const cost = pl.expense.filter((r) => r.code.startsWith("5"));
        const opex = pl.expense.filter((r) => !r.code.startsWith("5"));
        const gross = pl.totalRevenue - cost.reduce((s, r) => s + r.balance, 0);
        return (<>
          {range}
          <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
            <Stat label="營業收入" value={twd(pl.totalRevenue)} />
            <Stat label="毛利" value={twd(gross)} hint={pl.totalRevenue ? `毛利率 ${Math.round((gross / pl.totalRevenue) * 100)}%` : undefined} />
            <Stat label="費用合計" value={twd(pl.totalExpense)} />
            <Stat label="本期淨利" value={twd(pl.net)} tone={pl.net >= 0 ? "good" : "bad"} />
          </div>
          <Card title={`損益表　${date(from)} – ${date(to)}`}>
            <div className="max-w-xl">
              <div className="text-xs font-medium text-slate-500">營業收入</div>
              {pl.revenue.map((r) => <Row key={r.id} label={`${r.code} ${r.name}`} value={r.balance} indent />)}
              <Row label="收入合計" value={pl.totalRevenue} bold />
              <div className="mt-4 text-xs font-medium text-slate-500">營業成本</div>
              {cost.map((r) => <Row key={r.id} label={`${r.code} ${r.name}`} value={r.balance} indent />)}
              <Row label="營業毛利" value={gross} bold />
              <div className="mt-4 text-xs font-medium text-slate-500">營業費用</div>
              {opex.map((r) => <Row key={r.id} label={`${r.code} ${r.name}`} value={r.balance} indent />)}
              <Row label="費用合計" value={opex.reduce((s, r) => s + r.balance, 0)} bold />
              <div className="mt-4 border-t-2 border-slate-800"><Row label="本期淨利（稅前）" value={pl.net} bold /></div>
            </div>
          </Card>
        </>);
      })()}

      {tab === "bs" && await (async () => {
        const bs = await balanceSheet(to);
        const balanced = Math.abs(bs.totalAssets - bs.totalLiabilities - bs.totalEquity) < 1;
        return (<>
          {range}
          <div className="grid gap-6 lg:grid-cols-2">
            <Card title={`資產　截至 ${date(to)}`}>
              {bs.assets.map((r) => <Row key={r.id} label={`${r.code} ${r.name}`} value={r.balance} />)}
              <Row label="資產總計" value={bs.totalAssets} bold />
            </Card>
            <Card title="負債及權益">
              {bs.liabilities.map((r) => <Row key={r.id} label={`${r.code} ${r.name}`} value={r.balance} />)}
              <Row label="負債合計" value={bs.totalLiabilities} bold />
              <div className="mt-4" />
              {bs.equity.map((r) => <Row key={r.id} label={`${r.code} ${r.name}`} value={r.balance} />)}
              <Row label="本期損益" value={bs.earnings} />
              <Row label="權益合計" value={bs.totalEquity} bold />
              <div className="mt-2 border-t-2 border-slate-800"><Row label="負債及權益總計" value={bs.totalLiabilities + bs.totalEquity} bold /></div>
              <div className={`mt-2 text-xs ${balanced ? "text-emerald-600" : "text-red-600"}`}>{balanced ? "✓ 資產 = 負債 + 權益" : "⚠ 帳務不平衡，請檢查傳票"}</div>
            </Card>
          </div>
        </>);
      })()}

      {tab === "tb" && await (async () => {
        const rows = (await accountBalances(from, to)).filter((r) => r.debit || r.credit);
        const d = rows.reduce((s, r) => s + r.debit, 0), c = rows.reduce((s, r) => s + r.credit, 0);
        return (<>
          {range}
          <Card title={`試算表　${date(from)} – ${date(to)}`} pad={false}>
            <table className="tbl">
              <thead><tr><th>代碼</th><th>科目</th><th>類別</th><th className="text-right">借方</th><th className="text-right">貸方</th></tr></thead>
              <tbody>
                {rows.map((r) => <tr key={r.id}><td className="font-mono">{r.code}</td><td><Link className="link" href={`/accounting?account=${r.id}`}>{r.name}</Link></td><td>{ACCOUNT_TYPE_LABEL[r.type]}</td><td className="num">{num(r.debit)}</td><td className="num">{num(r.credit)}</td></tr>)}
                <tr className="font-semibold"><td colSpan={3}>合計 {Math.abs(d - c) < 0.01 ? "✓" : "⚠ 不平衡"}</td><td className="num">{num(d)}</td><td className="num">{num(c)}</td></tr>
              </tbody>
            </table>
          </Card>
        </>);
      })()}

      {tab === "ar" && await (async () => {
        const ar = await arAging(now);
        const L: Record<string, string> = { current: "未到期", d30: "逾期 1–30 天", d60: "逾期 31–60 天", d90: "逾期 60 天以上" };
        return (<>
          <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
            {Object.entries(ar.buckets).map(([k, v]) => <Stat key={k} label={L[k]} value={twd(v)} tone={k !== "current" && v > 0 ? "bad" : undefined} />)}
          </div>
          <Card title={`應收帳款明細　合計 ${twd(ar.total)}`} pad={false}>
            {ar.rows.length === 0 ? <Empty>沒有未收帳款</Empty> : (
              <table className="tbl">
                <thead><tr><th>請款單</th><th>客戶</th><th>開立日</th><th>到期日</th><th>帳齡</th><th className="text-right">總額</th><th className="text-right">未收</th></tr></thead>
                <tbody>{ar.rows.map((r) => (
                  <tr key={r.inv.id}><td><Link className="link" href={`/invoices/${r.inv.id}`}>{r.inv.number}</Link></td><td>{r.inv.client.name}</td><td>{date(r.inv.issueDate)}</td><td>{date(r.inv.dueDate)}</td>
                    <td><Badge label={L[r.bucket]} tone={r.bucket === "current" ? "gray" : r.bucket === "d30" ? "amber" : "red"} /></td><td className="num">{twd(r.total)}</td><td className="num font-medium">{twd(r.balance)}</td></tr>
                ))}</tbody>
              </table>
            )}
          </Card>
        </>);
      })()}

      {tab === "projects" && await (async () => {
        const rows = await projectProfit();
        return (
          <Card title="專案損益（已請款收入 − 直接費用 − 人工成本）" pad={false}>
            {rows.length === 0 ? <Empty /> : (
              <table className="tbl">
                <thead><tr><th>專案</th><th>狀態</th><th className="text-right">合約</th><th className="text-right">已請款</th><th className="text-right">直接費用</th><th className="text-right">工時</th><th className="text-right">人工成本</th><th className="text-right">毛利</th><th className="text-right">毛利率</th></tr></thead>
                <tbody>{rows.map((r) => (
                  <tr key={r.project.id}>
                    <td><Link className="link" href={`/projects/${r.project.id}?tab=finance`}>{r.project.name}</Link><div className="text-xs text-slate-500">{r.project.client?.name}</div></td>
                    <td><Badge status={r.project.status} /></td>
                    <td className="num">{twd(r.project.budget)}</td><td className="num">{twd(r.invoiced)}</td><td className="num">{twd(r.expenses)}</td>
                    <td className="num">{num(r.hours, 1)}</td><td className="num">{twd(r.labor)}</td>
                    <td className={`num font-medium ${r.profit < 0 ? "text-red-600" : ""}`}>{twd(r.profit)}</td>
                    <td className="num">{r.invoiced ? `${Math.round(r.margin * 100)}%` : "—"}</td>
                  </tr>
                ))}</tbody>
              </table>
            )}
          </Card>
        );
      })()}

      {tab === "vat" && await (async () => {
        const year = Number(sp.year ?? now.getFullYear());
        const [out, inp] = await Promise.all([ACC.OUTPUT_VAT, ACC.INPUT_VAT].map((code) => resolveAccount(db, code)));
        const periods = await Promise.all([0, 2, 4, 6, 8, 10].map(async (m) => {
          const s = new Date(year, m, 1), e = new Date(year, m + 2, 1);
          const sum = async (id: string | undefined, field: "debit" | "credit") => {
            if (!id) return 0;
            const r = await db.journalLine.aggregate({ _sum: { [field]: true }, where: { accountId: id, entry: { date: { gte: s, lt: e } } } });
            return (r._sum as Record<string, number | null>)[field] ?? 0;
          };
          const output = await sum(out?.id, "credit"), input = await sum(inp?.id, "debit");
          return { label: `${m + 1}–${m + 2} 月`, output, input, payable: output - input };
        }));
        type Vat = { period: string; output: number | null; input: number | null; inputInternal: number | null; estimated: number | null; diff: number | null; paid: number | null; carry: number | null; note: string | null };
        const raw = (await db.setting.findUnique({ where: { key: "import.vat" } }))?.value;
        const filed: Vat[] = raw ? (JSON.parse(raw) as Vat[]).filter((v) => v.period.startsWith(String(year))) : [];
        const n = (v: number | null) => (v === null ? "—" : twd(v));
        return (<>
          <form className="no-print mb-4 flex gap-2"><input type="hidden" name="tab" value="vat" /><input type="number" name="year" defaultValue={year} className="input w-28" /><button className="btn-secondary">年度</button></form>
          {filed.length > 0 && (
            <Card title={`${year} 年營業稅申報（Excel 發票資料）`} pad={false} className="mb-6">
              <table className="tbl">
                <thead><tr><th>期別</th><th className="text-right">銷項稅額</th><th className="text-right">進項稅額</th><th className="text-right">進項稅額-內帳</th><th className="text-right">預計應納</th><th className="text-right">與會計師差異</th><th className="text-right">實繳</th><th className="text-right">留底</th></tr></thead>
                <tbody>{filed.map((v) => (
                  <tr key={v.period}><td>{v.period}{v.note && <div className="text-xs text-slate-400">{v.note}</div>}</td><td className="num">{n(v.output)}</td><td className="num">{n(v.input)}</td><td className="num">{n(v.inputInternal)}</td><td className="num">{n(v.estimated)}</td><td className="num">{n(v.diff)}</td><td className="num font-medium">{n(v.paid)}</td><td className="num">{n(v.carry)}</td></tr>
                ))}</tbody>
              </table>
            </Card>
          )}
          <Card title={`${year} 年營業稅（帳上參考，依傳票日期）`} pad={false}>
            <table className="tbl">
              <thead><tr><th>期別</th><th className="text-right">銷項稅額（貸方）</th><th className="text-right">進項稅額（借方）</th><th className="text-right">差額</th></tr></thead>
              <tbody>{periods.map((p) => (
                <tr key={p.label}><td>{p.label}</td><td className="num">{twd(p.output)}</td><td className="num">{twd(p.input)}</td><td className={`num font-medium ${p.payable < 0 ? "text-emerald-600" : ""}`}>{twd(p.payable)}</td></tr>
              ))}</tbody>
            </table>
            <p className="p-4 text-xs text-slate-400">依傳票入帳日期彙總「銷項稅額」貸方與「進項稅額」借方（不含繳稅沖轉），與實際申報期別可能不同；申報請以上方 Excel 發票資料或會計師為準。</p>
          </Card>
        </>);
      })()}
    </>
  );
}
