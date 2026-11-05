import Link from "next/link";
import { ArrowRight, CalendarDays, Package } from "lucide-react";
import { db } from "@/lib/db";
import { requireUser, can } from "@/lib/auth";
import { twd, date, num } from "@/lib/format";
import { profitAndLoss, arAging } from "@/lib/reports";
import { PageHeader, Card, Stat, Badge, Empty } from "@/components/ui";

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  const user = await requireUser("dashboard");
  const { denied } = await searchParams;
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const weekStart = new Date(now); weekStart.setDate(now.getDate() - ((now.getDay() + 6) % 7)); weekStart.setHours(0, 0, 0, 0);
  const finance = can(user, "finance");

  const [myTasks, weekHours, activeProjects, pendingLeaves, lowStock] = await Promise.all([
    db.task.findMany({ where: { assigneeId: user.id, status: { not: "DONE" } }, include: { project: true }, orderBy: [{ dueDate: "asc" }], take: 8 }),
    db.timeEntry.aggregate({ _sum: { hours: true }, where: { userId: user.id, date: { gte: weekStart } } }),
    db.project.findMany({ where: { status: "ACTIVE" }, include: { client: true, tasks: true }, orderBy: { dueDate: "asc" }, take: 6 }),
    can(user, "hr") || user.role === "MANAGER" ? db.leaveRequest.count({ where: { status: "PENDING" } }) : Promise.resolve(0),
    db.inventoryItem.findMany({ where: { reorderLevel: { gt: 0 } } }).then((xs) => xs.filter((x) => x.quantity <= x.reorderLevel)),
  ]);
  const pl = finance ? await profitAndLoss(monthStart, now) : null;
  const ar = finance ? await arAging(now) : null;
  const ap = finance ? await db.expense.findMany({ where: { status: "UNPAID" } }) : [];
  const apTotal = ap.reduce((s, e) => s + e.amount + e.tax, 0);
  const overdue = ar?.rows.filter((r) => r.overdue > 0) ?? [];

  return (
    <>
      <PageHeader title={`早安，${user.name}`} sub={`${date(now)}　今天也辛苦了`} />
      {denied && <div className="mb-4 rounded-md bg-accent-soft px-4 py-2 text-sm text-accent">您沒有存取該模組的權限，如有需要請聯絡管理員。</div>}

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {finance && pl && ar ? (
          <>
            <Stat label="本月營收（未稅）" value={twd(pl.totalRevenue)} hint={`本月淨利 ${twd(pl.net)}`} tone={pl.net >= 0 ? undefined : "bad"} />
            <Stat label="應收帳款餘額" value={twd(ar.total)} hint={overdue.length ? `${overdue.length} 張逾期` : "無逾期"} tone={overdue.length ? "bad" : undefined} />
            <Stat label="應付未付" value={twd(apTotal)} hint={`${ap.length} 筆帳單`} />
          </>
        ) : (
          <Stat label="我的待辦任務" value={myTasks.length} />
        )}
        <Stat label="本週我的工時" value={`${num(weekHours._sum.hours ?? 0, 1)} h`} hint={<Link className="link inline-flex min-h-6 items-center gap-1" href="/time">登錄工時<ArrowRight className="h-3.5 w-3.5" aria-hidden /></Link>} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="我的任務" actions={<Link href="/tasks" className="link text-xs">全部</Link>} pad={false}>
          {myTasks.length === 0 ? <Empty>沒有待辦任務，做得好！</Empty> : (
            <table className="tbl"><tbody>
              {myTasks.map((t) => (
                <tr key={t.id}>
                  <td><Link href={`/tasks/${t.id}`} className="link">{t.title}</Link><div className="text-xs text-ink-muted">{t.project.name}</div></td>
                  <td><Badge status={t.status} /></td>
                  <td className={`text-right text-xs ${t.dueDate && t.dueDate < now ? "text-danger" : "text-ink-muted"}`}>{date(t.dueDate)}</td>
                </tr>
              ))}
            </tbody></table>
          )}
        </Card>

        <Card title="進行中專案" actions={<Link href="/projects" className="link text-xs">全部</Link>} pad={false}>
          {activeProjects.length === 0 ? <Empty /> : (
            <table className="tbl"><tbody>
              {activeProjects.map((p) => {
                const done = p.tasks.filter((t) => t.status === "DONE").length;
                const pct = p.tasks.length ? Math.round((done / p.tasks.length) * 100) : 0;
                return (
                  <tr key={p.id}>
                    <td><Link href={`/projects/${p.id}`} className="link">{p.name}</Link><div className="text-xs text-ink-muted">{p.client?.name ?? "內部專案"}</div></td>
                    <td className="w-40">
                      <div className="h-1.5 rounded-full bg-surface-muted"><div className="h-1.5 rounded-full bg-brand-500" style={{ width: `${pct}%` }} /></div>
                      <div className="mt-1 text-xs text-ink-muted">{done}/{p.tasks.length} 任務</div>
                    </td>
                    <td className="text-right text-xs text-ink-muted">{date(p.dueDate)}</td>
                  </tr>
                );
              })}
            </tbody></table>
          )}
        </Card>

        {finance && (
          <Card title="逾期應收" actions={<Link href="/reports?tab=ar" className="link text-xs">帳齡分析</Link>} pad={false}>
            {overdue.length === 0 ? <Empty>沒有逾期帳款</Empty> : (
              <table className="tbl"><tbody>
                {overdue.slice(0, 6).map((r) => (
                  <tr key={r.inv.id}>
                    <td><Link href={`/invoices/${r.inv.id}`} className="link">{r.inv.number}</Link><div className="text-xs text-ink-muted">{r.inv.client.name}</div></td>
                    <td className="text-xs text-danger">逾期 {r.overdue} 天</td>
                    <td className="num">{twd(r.balance)}</td>
                  </tr>
                ))}
              </tbody></table>
            )}
          </Card>
        )}

        {(pendingLeaves > 0 || lowStock.length > 0) && (
          <Card title="待處理事項">
            <ul className="space-y-2 text-sm">
              {pendingLeaves > 0 && <li className="flex items-center gap-2"><CalendarDays className="h-4 w-4 shrink-0 text-ink-muted" aria-hidden /><Link className="link" href="/hr/leave">{pendingLeaves} 張假單待審核</Link></li>}
              {lowStock.map((i) => (
                <li key={i.id} className="flex flex-wrap items-center gap-x-2"><Package className="h-4 w-4 shrink-0 text-accent" aria-hidden />庫存偏低：<Link className="link" href="/inventory">{i.name}</Link>（剩 {num(i.quantity)} {i.unit}，安全量 {num(i.reorderLevel)}）</li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </>
  );
}
