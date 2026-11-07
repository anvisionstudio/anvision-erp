import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { twd, date } from "@/lib/format";
import { PageHeader, Card, Badge, Empty, Tabs, Progress } from "@/components/ui";
import { FilterBar } from "@/components/filters";
import { dateRange, href, pick } from "@/lib/filters";

const TABS = [["OPEN", "進行中"], ["DONE", "已完成"], ["ALL", "全部"]];

export default async function Projects({ searchParams }: { searchParams: Promise<{ status?: string; q?: string; noclient?: string; client?: string; manager?: string; from?: string; to?: string }> }) {
  const user = await requireUser("projects");
  const sp = await searchParams;
  const { status = "OPEN", q, noclient } = sp;
  const f = pick(sp, ["q", "client", "manager", "from", "to"]);
  const [clients, managers] = await Promise.all([
    db.client.findMany({ where: { projects: { some: {} } }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.user.findMany({ where: { managedProjects: { some: {} } }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  const where = {
    ...(status === "OPEN" ? { status: { in: ["PLANNING", "ACTIVE", "ON_HOLD"] } } : status === "DONE" ? { status: { in: ["DONE", "CANCELLED"] } } : {}),
    ...(q ? { OR: [{ name: { contains: q } }, { code: { contains: q } }, { ref: { contains: q } }, { client: { name: { contains: q } } }] } : {}),
    ...(f.client ? { clientId: f.client } : {}),
    ...(f.manager ? { managerId: f.manager } : {}),
    ...(dateRange(f.from, f.to) ? { dueDate: dateRange(f.from, f.to) } : {}),
    ...(noclient ? { AND: [{ OR: [{ clientId: null }, { client: { name: "Excel 匯入客戶（待整理）" } }] }] } : {}),
  };
  const projects = await db.project.findMany({ where, include: { client: true, manager: true, tasks: true }, orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }] });
  return (
    <>
      <PageHeader title="專案" sub={`${projects.length} 個專案`} actions={user.role !== "STAFF" && <Link href="/projects/new" className="btn-primary">＋ 新增專案</Link>} />
      <Tabs active={status} tabs={TABS.map(([k, l]) => ({ key: k, label: l, href: href("/projects", { ...f, noclient }, { status: k }) }))} />
      <FilterBar path="/projects" values={f} keep={{ status, noclient }} fields={[
        { type: "search", name: "q", label: "搜尋", placeholder: "專案名稱、編號、客戶…" },
        { type: "select", name: "client", label: "客戶", options: clients.map((c) => ({ value: c.id, label: c.name })) },
        { type: "select", name: "manager", label: "負責人", options: managers.map((m) => ({ value: m.id, label: m.name })) },
        { type: "date", name: "from", label: "交付日（起）" },
        { type: "date", name: "to", label: "交付日（迄）" },
      ]} />
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
                  <td className="w-36"><Progress value={pct} label={`${p.name} 完成度`} /></td>
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
