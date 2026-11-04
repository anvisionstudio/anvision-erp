import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { twd, date, isoDate, num } from "@/lib/format";
import { saveEmployee } from "@/app/actions/hr";
import { PageHeader, Card, Empty, Field, Select, Badge, statusOptions } from "@/components/ui";
import { SubmitButton } from "@/components/client";

export default async function Employees({ searchParams }: { searchParams: Promise<{ edit?: string; new?: string }> }) {
  await requireUser("hr");
  const sp = await searchParams;
  const year = new Date().getFullYear();
  const [emps, users] = await Promise.all([
    db.employee.findMany({ include: { user: true, leaves: { where: { status: "APPROVED", type: "特休", startDate: { gte: new Date(year, 0, 1) } } } }, orderBy: [{ status: "asc" }, { name: "asc" }] }),
    db.user.findMany({ orderBy: { name: "asc" } }),
  ]);
  const e = sp.edit ? emps.find((x) => x.id === sp.edit) : undefined;
  return (
    <>
      <PageHeader title="員工" sub={`在職 ${emps.filter((x) => x.status === "ACTIVE").length} 人`} actions={<Link href="/hr/employees?new=1" className="btn-primary">＋ 新增員工</Link>} />
      {(sp.new || e) && (
        <Card title={e ? `編輯 ${e.name}` : "新增員工"} className="mb-6">
          <form action={saveEmployee} className="grid gap-4 md:grid-cols-4">
            {e && <input type="hidden" name="id" value={e.id} />}
            <Field label="姓名 *"><input name="name" required defaultValue={e?.name} className="input" /></Field>
            <Field label="職稱"><input name="title" defaultValue={e?.title ?? ""} className="input" /></Field>
            <Field label="部門"><input name="department" defaultValue={e?.department ?? ""} className="input" placeholder="設計 / 行銷 / 行政" /></Field>
            <Field label="到職日"><input type="date" name="hireDate" defaultValue={isoDate(e?.hireDate)} className="input" /></Field>
            <Field label="Email"><input name="email" defaultValue={e?.email ?? ""} className="input" /></Field>
            <Field label="電話"><input name="phone" defaultValue={e?.phone ?? ""} className="input" /></Field>
            <Field label="月薪"><input type="number" name="salary" defaultValue={e?.salary ?? 0} className="input" /></Field>
            <Field label="時薪成本（專案成本用）"><input type="number" name="hourlyCost" defaultValue={e?.hourlyCost ?? 0} className="input" /></Field>
            <Field label="年度特休天數"><input type="number" step="0.5" name="annualLeave" defaultValue={e?.annualLeave ?? 7} className="input" /></Field>
            <Field label="系統帳號"><Select name="userId" placeholder="（未連結）" defaultValue={e?.userId} options={users.map((u) => ({ value: u.id, label: `${u.name} ${u.email}` }))} /></Field>
            <Field label="狀態"><Select name="status" defaultValue={e?.status ?? "ACTIVE"} options={statusOptions(["ACTIVE", "LEFT"]).map((o) => (o.value === "ACTIVE" ? { ...o, label: "在職" } : o))} /></Field>
            <div className="flex items-end gap-2"><SubmitButton>儲存</SubmitButton><Link href="/hr/employees" className="btn-secondary">取消</Link></div>
          </form>
        </Card>
      )}
      <Card pad={false}>
        {emps.length === 0 ? <Empty /> : (
          <table className="tbl">
            <thead><tr><th>姓名</th><th>職稱 / 部門</th><th>到職日</th><th>系統帳號</th><th className="text-right">月薪</th><th className="text-right">時薪成本</th><th className="text-right">特休（已用/總）</th><th>狀態</th><th /></tr></thead>
            <tbody>{emps.map((x) => (
              <tr key={x.id}>
                <td className="font-medium">{x.name}</td><td>{x.title}<div className="text-xs text-slate-500">{x.department}</div></td>
                <td>{date(x.hireDate)}</td><td className="text-xs">{x.user?.email ?? <span className="text-slate-400">—</span>}</td>
                <td className="num">{twd(x.salary)}</td><td className="num">{twd(x.hourlyCost)}</td>
                <td className="num">{num(x.leaves.reduce((s, l) => s + l.days, 0), 1)} / {num(x.annualLeave, 1)}</td>
                <td><Badge label={x.status === "ACTIVE" ? "在職" : "離職"} tone={x.status === "ACTIVE" ? "green" : "gray"} /></td>
                <td className="text-right"><Link className="btn-secondary btn-sm" href={`/hr/employees?edit=${x.id}`}>編輯</Link></td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </Card>
    </>
  );
}
