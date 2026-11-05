import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { twd, date } from "@/lib/format";
import { generatePayroll, savePayroll, payPayroll } from "@/app/actions/hr";
import { PageHeader, Card, Empty, Badge, Stat, Chip } from "@/components/ui";
import { ConfirmButton, SubmitButton } from "@/components/client";

export default async function Payroll({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  await requireUser("hr");
  const now = new Date();
  const { period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}` } = await searchParams;
  const rows = await db.payroll.findMany({ where: { period }, include: { employee: true }, orderBy: { employee: { name: "asc" } } });
  const periods = await db.payroll.findMany({ distinct: ["period"], select: { period: true }, orderBy: { period: "desc" }, take: 12 });
  const sum = (k: "baseSalary" | "allowance" | "deduction" | "netPay") => rows.reduce((s, r) => s + r[k], 0);
  return (
    <>
      <PageHeader title="薪資" sub={`${period} 月份`}
        actions={<>
          <form className="flex gap-2"><input type="month" aria-label="薪資月份" name="period" defaultValue={period} className="input" /><button className="btn-secondary">切換</button></form>
          <form action={generatePayroll}><input type="hidden" name="period" value={period} /><SubmitButton className="btn-primary">產生 {period} 薪資草稿</SubmitButton></form>
        </>} />
      {periods.length > 0 && <div className="no-print mb-4 flex flex-wrap gap-2 text-xs">{periods.map((p) => <Chip key={p.period} href={`/hr/payroll?period=${p.period}`} active={p.period === period}>{p.period}</Chip>)}</div>}
      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="應發合計" value={twd(sum("baseSalary") + sum("allowance"))} />
        <Stat label="代扣合計" value={twd(sum("deduction"))} />
        <Stat label="實發合計" value={twd(sum("netPay"))} />
        <Stat label="已發放" value={`${rows.filter((r) => r.status === "PAID").length} / ${rows.length}`} />
      </div>
      <Card pad={false}>
        {rows.length === 0 ? <Empty>尚未產生本月薪資，請按右上角「產生薪資草稿」</Empty> : (
          <table className="tbl">
            <thead><tr><th>員工</th><th className="text-right">本薪</th><th className="text-right">加給 / 獎金</th><th className="text-right">代扣（勞健保等）</th><th className="text-right">實發</th><th>狀態</th><th /></tr></thead>
            <tbody>{rows.map((r) => r.status === "PAID" ? (
              <tr key={r.id}><td>{r.employee.name}</td><td className="num">{twd(r.baseSalary)}</td><td className="num">{twd(r.allowance)}</td><td className="num">{twd(r.deduction)}</td><td className="num font-medium">{twd(r.netPay)}</td><td><Badge status="PAID" /><div className="text-xs text-ink-muted">{date(r.paidDate)}</div></td><td /></tr>
            ) : (
              <tr key={r.id}>
                <td>{r.employee.name}</td>
                <td colSpan={4}>
                  <form action={savePayroll} className="grid grid-cols-4 items-center gap-2">
                    <input type="hidden" name="id" value={r.id} />
                    <input name="baseSalary" type="number" inputMode="numeric" aria-label={`${r.employee.name} 本薪`} defaultValue={r.baseSalary} className="input min-w-[6rem] text-right" />
                    <input name="allowance" type="number" inputMode="numeric" aria-label={`${r.employee.name} 加給 / 獎金`} defaultValue={r.allowance} className="input min-w-[6rem] text-right" />
                    <input name="deduction" type="number" inputMode="numeric" aria-label={`${r.employee.name} 代扣`} defaultValue={r.deduction} className="input min-w-[6rem] text-right" />
                    <div className="flex items-center justify-end gap-2"><span className="tabular-nums font-medium">{twd(r.netPay)}</span><button className="btn-secondary btn-sm">更新</button></div>
                  </form>
                </td>
                <td><Badge status="DRAFT" /></td>
                <td className="text-right"><ConfirmButton action={payPayroll.bind(null, r.id)} message={`確認發放 ${r.employee.name} 薪資 ${twd(r.netPay)}？將自動產生薪資傳票。`} className="btn-primary btn-sm">發放</ConfirmButton></td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </Card>
      <p className="mt-3 text-xs text-ink-muted">代扣預設以月薪 × 3.6% 概估勞健保自付額，請依實際投保級距調整後再發放。</p>
    </>
  );
}
