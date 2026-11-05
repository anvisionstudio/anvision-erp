import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { twd, date } from "@/lib/format";
import { PageHeader, Card, Badge, Empty, Tabs } from "@/components/ui";

const TABS = [["OPEN", "進行中"], ["DONE", "已完成"], ["ALL", "全部"]];

export default async function Projects({ searchParams }: { searchParams: Promise<{ status?: string; q?: string; noclient?: string }> }) {
  const user = await requireUser("projects");
  const { status = "OPEN", q, noclient } = await searchParams;
  const where = {
    ...(status === "OPEN" ? { status: { in: ["PLANNING", "ACTIVE", "ON_HOLD"] } } : status === "DONE" ? { status: { in: ["DONE", "CANCELLED"] } } : {}),
    ...(q ? { OR: [{ name: { contains: q } }, { code: { contains: q } }] } : {}),
    ...(noclient ? { AND: [{ OR: [{ clientId: null }, { client: { name: "Excel 匯入客戶（待整理）" } }] }] } : {}),
  };
  const projects = await db.project.findMany({ where, include: { client: true, manager: true, tasks: true }, orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }] });
  return (
    <>
      <PageHeader title="專案" sub={`${projects.length} 個專案`} actions={user.role !== "STAFF" && <Link href="/projects/new" className="btn-primary">＋ 新增專案</Link>} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Tabs active={status} tabs={TABS.map(([k, l]) => ({ key: k, label: l, href: `/projects?status=${k}` }))} />
        <form className="mb-4"><input type="hidden" name="status" value={status} /><input type="search" aria-label="搜尋專案" name="q" defaultValue={q} placeholder="搜尋專案…" className="input w-full sm:w-56" /></form>
      </div>
      <Card pad={false}>
        {projects.length === 0 ? <Empty /> : (
          <table className="tbl">
            <thead><tr><th>編號</th><th>專案</th><th>客戶</th><th>負責人</th><th>進度</th><th>交付日</th><th className="text-right">合約金額</th><th>狀態</th></tr></thead>
            <tbody>{projects.map((p) => {
              const done = p.tasks.filter((t) => t.status === "DONE").length;
              const pct = p.tasks.length ? Math.round((done / p.tasks.length) * 100) : 0;
              return (
                <tr key={p.id}>
                  <td className="font-mono text-xs text-ink-muted">{p.code}</td>
                  <td><Link href={`/projects/${p.id}`} className="link">{p.name}</Link></td>
                  <td>{p.client?.name ?? <span className="text-ink-muted">內部</span>}</td>
                  <td>{p.manager?.name}</td>
                  <td className="w-32"><div className="h-1.5 rounded-full bg-surface-muted"><div className="h-1.5 rounded-full bg-brand-500" style={{ width: `${pct}%` }} /></div><div className="text-xs text-ink-muted">{pct}%</div></td>
                  <td className={p.dueDate && p.dueDate < new Date() && p.status === "ACTIVE" ? "text-danger" : ""}>{date(p.dueDate)}</td>
                  <td className="num">{twd(p.budget)}</td>
                  <td><Badge status={p.status} /></td>
                </tr>
              );
            })}</tbody>
          </table>
        )}
      </Card>
    </>
  );
}
