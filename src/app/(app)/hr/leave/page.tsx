import { db } from "@/lib/db";
import { requireUser, can } from "@/lib/auth";
import { date, isoDate, num } from "@/lib/format";
import { requestLeave, reviewLeave, deleteLeave } from "@/app/actions/hr";
import { PageHeader, Card, Empty, Field, Select, Badge } from "@/components/ui";
import { ConfirmButton, SubmitButton } from "@/components/client";

export default async function Leave() {
  const user = await requireUser("leave");
  const isHR = can(user, "hr");
  const reviewer = isHR || user.role === "MANAGER";
  const [leaves, emps] = await Promise.all([
    db.leaveRequest.findMany({ where: reviewer ? {} : { employeeId: user.employee?.id ?? "-" }, include: { employee: true }, orderBy: { startDate: "desc" }, take: 100 }),
    isHR ? db.employee.findMany({ where: { status: "ACTIVE" }, orderBy: { name: "asc" } }) : Promise.resolve([]),
  ]);
  const year = new Date().getFullYear();
  const myUsed = user.employee ? leaves.filter((l) => l.employeeId === user.employee!.id && l.type === "特休" && l.status === "APPROVED" && l.startDate.getFullYear() === year).reduce((s, l) => s + l.days, 0) : 0;
  return (
    <>
      <PageHeader title="請假" sub={user.employee ? `${year} 年特休：已用 ${num(myUsed, 1)} / ${num(user.employee.annualLeave, 1)} 天` : undefined} />
      <Card title="申請請假" className="mb-6">
        {!isHR && !user.employee ? <p className="text-sm text-ink-muted">您的帳號尚未連結員工資料，請聯絡管理員。</p> : (
          <form action={requestLeave} className="grid gap-3 md:grid-cols-6">
            {isHR && <Field label="員工"><Select name="employeeId" required defaultValue={user.employee?.id} options={emps.map((e) => ({ value: e.id, label: e.name }))} /></Field>}
            <Field label="假別"><Select name="type" options={["特休", "病假", "事假", "公假", "婚假", "喪假", "其他"].map((v) => ({ value: v, label: v }))} /></Field>
            <Field label="開始日"><input type="date" name="startDate" required defaultValue={isoDate(new Date())} className="input" /></Field>
            <Field label="結束日"><input type="date" name="endDate" required defaultValue={isoDate(new Date())} className="input" /></Field>
            <Field label="天數"><input type="number" step="0.5" name="days" defaultValue={1} className="input" /></Field>
            <Field label="事由"><input name="reason" className="input" /></Field>
            <div className="flex items-end"><SubmitButton>送出申請</SubmitButton></div>
          </form>
        )}
      </Card>
      <Card title={reviewer ? "全部假單" : "我的假單"} pad={false}>
        {leaves.length === 0 ? <Empty /> : (
          <table className="tbl">
            <thead><tr><th>員工</th><th>假別</th><th>期間</th><th className="text-right">天數</th><th>事由</th><th>狀態</th><th /></tr></thead>
            <tbody>{leaves.map((l) => (
              <tr key={l.id}>
                <td>{l.employee.name}</td><td>{l.type}</td><td>{date(l.startDate)} – {date(l.endDate)}</td><td className="num">{num(l.days, 1)}</td><td>{l.reason}</td><td><Badge status={l.status} /></td>
                <td className="whitespace-nowrap text-right">
                  {reviewer && l.status === "PENDING" && <>
                    <ConfirmButton action={reviewLeave.bind(null, l.id, "APPROVED")} message="核准此假單？" className="btn-primary btn-sm">核准</ConfirmButton>{" "}
                    <ConfirmButton action={reviewLeave.bind(null, l.id, "REJECTED")} message="駁回此假單？" className="btn-secondary btn-sm">駁回</ConfirmButton>{" "}
                  </>}
                  {(isHR || l.status === "PENDING") && <ConfirmButton action={deleteLeave.bind(null, l.id)} message="刪除 / 撤回此假單？">✕</ConfirmButton>}
                </td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </Card>
    </>
  );
}
