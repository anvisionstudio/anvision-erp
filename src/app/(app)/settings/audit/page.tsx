import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { PageHeader, Card, Empty } from "@/components/ui";

export default async function Audit() {
  await requireUser("admin");
  const logs = await db.auditLog.findMany({ include: { user: true }, orderBy: { createdAt: "desc" }, take: 300 });
  return (
    <>
      <PageHeader title="操作紀錄" sub="最近 300 筆" />
      <Card pad={false}>
        {logs.length === 0 ? <Empty /> : (
          <table className="tbl">
            <thead><tr><th>時間</th><th>使用者</th><th>動作</th><th>對象</th><th>內容</th></tr></thead>
            <tbody>{logs.map((l) => (
              <tr key={l.id}><td className="whitespace-nowrap text-xs">{l.createdAt.toLocaleString("zh-TW", { hour12: false })}</td><td>{l.user?.name ?? "系統"}</td><td>{l.action}</td><td>{l.entity}</td><td className="text-xs text-slate-500">{l.detail}</td></tr>
            ))}</tbody>
          </table>
        )}
      </Card>
    </>
  );
}
