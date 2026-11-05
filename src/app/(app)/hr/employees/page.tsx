import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { twd, date, isoDate, num } from "@/lib/format";
import { saveEmployee, savePositions } from "@/app/actions/hr";
import { getPositions, EMPLOY_TYPE, DEPT_TONE } from "@/lib/positions";
import { FilterBar } from "@/components/filters";
import { PageHeader, Card, Empty, Field, Select, Badge, statusOptions } from "@/components/ui";
import { SubmitButton } from "@/components/client";

export default async function Employees({ searchParams }: { searchParams: Promise<{ edit?: string; new?: string; pos?: string; dept?: string; type?: string; status?: string }> }) {
  await requireUser("hr");
  const sp = await searchParams;
  const year = new Date().getFullYear();
  const [all, users, positions] = await Promise.all([
    db.employee.findMany({ include: { user: true, leaves: { where: { status: "APPROVED", type: "特休", startDate: { gte: new Date(year, 0, 1) } } } }, orderBy: [{ status: "asc" }, { name: "asc" }] }),
    db.user.findMany({ orderBy: { name: "asc" } }),
    getPositions(),
  ]);
  const posOf = (t: string | null) => positions.find((p) => p.name === t);
  const depts = [...new Set(positions.map((p) => p.dept))];
  const emps = all.filter((x) =>
    (!sp.pos || x.title === sp.pos) && (!sp.dept || (x.department ?? posOf(x.title)?.dept) === sp.dept) &&
    (!sp.type || (posOf(x.title)?.type ?? "FULL") === sp.type) && (!sp.status || x.status === sp.status));
  const e = sp.edit ? all.find((x) => x.id === sp.edit) : undefined;
  const titleOptions = [...positions.map((p) => ({ value: p.name, label: `${p.name}（${p.dept}${p.type === "CONTRACT" ? "・外包" : ""}）` })),
    ...(e?.title && !posOf(e.title) ? [{ value: e.title, label: `${e.title}（舊職稱）` }] : [])];
  return (
    <>
      <PageHeader title="員工" sub={`在職 ${all.filter((x) => x.status === "ACTIVE").length} 人・${depts.map((d) => `${d} ${all.filter((x) => x.status === "ACTIVE" && (x.department ?? posOf(x.title)?.dept) === d).length}`).join("・")}`} actions={<Link href="/hr/employees?new=1" className="btn-primary">＋ 新增員工</Link>} />
      {(sp.new || e) && (
        <Card title={e ? `編輯 ${e.name}` : "新增員工"} className="mb-6">
          <form action={saveEmployee} className="grid gap-4 md:grid-cols-4">
            {e && <input type="hidden" name="id" value={e.id} />}
            <Field label="姓名 *"><input name="name" required defaultValue={e?.name} className="input" /></Field>
            <Field label="職位"><Select name="title" placeholder="選擇職位" defaultValue={e?.title} options={titleOptions} /></Field>
            <Field label="部門" help="留空會依職位自動帶入"><input name="department" defaultValue={e?.department ?? ""} className="input" placeholder="依職位自動帶入" list="depts" /><datalist id="depts">{depts.map((d) => <option key={d} value={d} />)}</datalist></Field>
            <Field label="到職日"><input type="date" name="hireDate" defaultValue={isoDate(e?.hireDate)} className="input" /></Field>
            <Field label="Email"><input type="email" autoComplete="email" name="email" defaultValue={e?.email ?? ""} className="input" /></Field>
            <Field label="電話"><input type="tel" inputMode="tel" autoComplete="tel" name="phone" defaultValue={e?.phone ?? ""} className="input" /></Field>
            <Field label="月薪"><input type="number" name="salary" defaultValue={e?.salary ?? 0} className="input" /></Field>
            <Field label="時薪成本（專案成本用）"><input type="number" name="hourlyCost" defaultValue={e?.hourlyCost ?? 0} className="input" /></Field>
            <Field label="年度特休天數"><input type="number" step="0.5" name="annualLeave" defaultValue={e?.annualLeave ?? 7} className="input" /></Field>
            <Field label="系統帳號"><Select name="userId" placeholder="（未連結）" defaultValue={e?.userId} options={users.map((u) => ({ value: u.id, label: `${u.name} ${u.email}` }))} /></Field>
            <Field label="狀態"><Select name="status" defaultValue={e?.status ?? "ACTIVE"} options={statusOptions(["ACTIVE", "LEFT"]).map((o) => (o.value === "ACTIVE" ? { ...o, label: "在職" } : o))} /></Field>
            <div className="flex items-end gap-2"><SubmitButton>儲存</SubmitButton><Link href="/hr/employees" className="btn-secondary">取消</Link></div>
          </form>
        </Card>
      )}
      <FilterBar path="/hr/employees" values={{ pos: sp.pos, dept: sp.dept, type: sp.type, status: sp.status }} fields={[
        { type: "select", name: "pos", label: "職位", options: positions.map((p) => ({ value: p.name, label: p.name })) },
        { type: "select", name: "dept", label: "部門", options: depts.map((d) => ({ value: d, label: d })) },
        { type: "select", name: "type", label: "聘用", options: [{ value: "FULL", label: "正職" }, { value: "CONTRACT", label: "外包" }] },
        { type: "select", name: "status", label: "狀態", options: [{ value: "ACTIVE", label: "在職" }, { value: "LEFT", label: "離職" }] },
      ]} />
      <Card pad={false} className="mb-6">
        {emps.length === 0 ? <Empty /> : (
          <table className="tbl">
            <thead><tr><th>姓名</th><th>職位 / 部門</th><th>到職日</th><th>系統帳號</th><th className="text-right">月薪</th><th className="text-right">時薪成本</th><th className="text-right">特休（已用/總）</th><th>狀態</th><th /></tr></thead>
            <tbody>{emps.map((x) => (
              <tr key={x.id}>
                <td className="font-medium">{x.name}</td><td>
                  {(() => { const p = posOf(x.title); const d = x.department ?? p?.dept; return (<>
                    <div className="flex flex-wrap items-center gap-1.5">{x.title ?? <span className="text-ink-muted">未設定</span>}{p?.type === "CONTRACT" && <Badge label="外包" tone="amber" dot={false} />}</div>
                    {d && <div className="mt-1"><Badge label={d} tone={DEPT_TONE[d] ?? "gray"} /></div>}
                  </>); })()}
                </td>
                <td>{date(x.hireDate)}</td><td className="text-xs">{x.user?.email ?? <span className="text-ink-muted">—</span>}</td>
                <td className="num">{twd(x.salary)}</td><td className="num">{twd(x.hourlyCost)}</td>
                <td className="num">{num(x.leaves.reduce((s, l) => s + l.days, 0), 1)} / {num(x.annualLeave, 1)}</td>
                <td><Badge label={x.status === "ACTIVE" ? "在職" : "離職"} tone={x.status === "ACTIVE" ? "green" : "gray"} /></td>
                <td className="text-right"><Link className="btn-secondary btn-sm" href={`/hr/employees?edit=${x.id}`}>編輯</Link></td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </Card>

      <Card title="職位管理">
        <form action={savePositions} className="space-y-3">
          <p className="text-sm text-ink-muted">員工表單的「職位」選單來自這裡。外包職位會在名單上標示「外包」。</p>
          <div className="hidden grid-cols-[1fr_1fr_8rem_5rem] gap-2 text-xs font-medium text-ink-muted sm:grid" aria-hidden><span>職位</span><span>部門</span><span>聘用</span><span>刪除</span></div>
          {[...positions, { name: "", dept: "", type: "FULL" as const }, { name: "", dept: "", type: "FULL" as const }].map((p, i) => (
            <div key={i} className="grid grid-cols-2 gap-2 border-b border-line pb-3 sm:grid-cols-[1fr_1fr_8rem_5rem] sm:items-center sm:border-0 sm:pb-0">
              <input name="pname" defaultValue={p.name} placeholder={i >= positions.length ? "新增職位…" : ""} aria-label={`職位 ${i + 1} 名稱`} className="input col-span-2 sm:col-span-1" />
              <input name="pdept" defaultValue={p.dept} list="depts-all" placeholder="部門" aria-label={`職位 ${i + 1} 部門`} className="input" />
              <select name="ptype" defaultValue={p.type} aria-label={`職位 ${i + 1} 聘用類型`} className="input">
                {Object.entries(EMPLOY_TYPE).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              {i < positions.length
                ? <label className="flex min-h-touch items-center gap-2 text-sm text-danger md:min-h-0"><input type="checkbox" name={`pdel-${i}`} className="h-4 w-4" />刪除</label>
                : <span />}
            </div>
          ))}
          <datalist id="depts-all">{depts.map((d) => <option key={d} value={d} />)}</datalist>
          <SubmitButton>儲存職位</SubmitButton>
        </form>
      </Card>
    </>
  );
}
