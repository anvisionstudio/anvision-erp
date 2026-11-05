import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, CalendarDays, Package, ListPlus, FolderPlus, NotebookPen, CalendarPlus, ListChecks, FolderKanban, Database, NotebookText, GanttChart, Square, Clock3 } from "lucide-react";
import { db } from "@/lib/db";
import { requireUser, can } from "@/lib/auth";
import { twd, date, num } from "@/lib/format";
import { profitAndLoss, arAging } from "@/lib/reports";
import { PageHeader, Card, Stat, Badge, Empty, Chip } from "@/components/ui";
import { quickCheckTask } from "@/app/actions/projects";
import { canManageProject } from "@/lib/perm";

/** Notion 風格的區塊標題列 */
function Band({ title, actions }: { title: string; actions?: ReactNode }) {
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-nav px-4 py-2.5 text-white">
      <h2 className="text-lg font-semibold text-white">{title}</h2>
      {actions}
    </div>
  );
}

const PALETTE = ["bg-sky-100 text-sky-800", "bg-emerald-100 text-emerald-800", "bg-amber-100 text-amber-800", "bg-rose-100 text-rose-800", "bg-violet-100 text-violet-800", "bg-teal-100 text-teal-800", "bg-orange-100 text-orange-800"];
const hue = (s: string) => PALETTE[[...s].reduce((a, c) => a + c.charCodeAt(0), 0) % PALETTE.length];
/** 專案圖示：取名稱第一個有意義的字，依名稱配色 */
function Mark({ name, className = "" }: { name: string; className?: string }) {
  const ch = name.replace(/^[\d_\s-]+/, "").trim().charAt(0) || "#";
  return <span className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-xs font-semibold ${hue(name)} ${className}`} aria-hidden>{ch}</span>;
}

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ denied?: string; mine?: string }> }) {
  const user = await requireUser("dashboard");
  const { denied, mine } = await searchParams;
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const weekStart = new Date(now); weekStart.setDate(now.getDate() - ((now.getDay() + 6) % 7)); weekStart.setHours(0, 0, 0, 0);
  const finance = can(user, "finance");
  const weekEnd = new Date(weekStart.getTime() + 7 * 864e5);
  const projectsArea = can(user, "projects");

  const [myTasks, weekHours, pendingLeaves, lowStock] = await Promise.all([
    db.task.findMany({ where: { assigneeId: user.id, status: { not: "DONE" } }, include: { project: true }, orderBy: [{ dueDate: "asc" }], take: 8 }),
    db.timeEntry.aggregate({ _sum: { hours: true }, where: { userId: user.id, date: { gte: weekStart } } }),
    can(user, "hr") || user.role === "MANAGER" ? db.leaveRequest.count({ where: { status: "PENDING" } }) : Promise.resolve(0),
    db.inventoryItem.findMany({ where: { reorderLevel: { gt: 0 } } }).then((xs) => xs.filter((x) => x.quantity <= x.reorderLevel)),
  ]);
  // 本週任務：本週到期（含逾期）或本週進行中的未完成任務
  const [weekTasks, progress, meetings] = await Promise.all([
    db.task.findMany({
      where: {
        status: { not: "DONE" }, project: { status: { notIn: ["DONE", "CANCELLED"] } },
        ...(mine ? { assigneeId: user.id } : {}),
        OR: [{ dueDate: { lt: weekEnd } }, { startDate: { lt: weekEnd }, dueDate: null }, { startDate: { lt: weekEnd }, dueDate: { gte: weekStart } }],
      },
      include: { project: { select: { id: true, name: true, managerId: true } }, assignee: { select: { name: true } } },
      orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }], take: 40,
    }),
    db.project.findMany({
      where: { status: { in: ["PLANNING", "ACTIVE", "ON_HOLD"] } },
      include: { tasks: { select: { status: true } } }, orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }], take: 12,
    }),
    projectsArea ? db.meeting.findMany({ orderBy: { date: "desc" }, take: 5, include: { project: { select: { name: true } } } }) : Promise.resolve([]),
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

      {projectsArea && (
        <>
          <div className="mb-8 grid gap-6 md:grid-cols-[minmax(0,16rem)_1fr]">
            <section aria-labelledby="quick">
              <h2 id="quick" className="mb-3 text-lg font-semibold text-ink-muted">快速按鈕</h2>
              <div className="flex flex-col items-start gap-2">
                {[
                  { href: "/tasks/team#assign", label: "快速加入任務", icon: ListPlus },
                  ...(["ADMIN", "MANAGER"].includes(user.role) ? [{ href: "/projects/new", label: "快速加入專案", icon: FolderPlus }] : []),
                  { href: "/meetings/new?kind=NOTE", label: "快速做筆記", icon: NotebookPen },
                  { href: "/meetings/new", label: "快速會議記錄", icon: CalendarPlus },
                ].map(({ href, label, icon: Icon }) => (
                  <Link key={href} href={href} className="btn-secondary justify-start"><Icon className="h-4 w-4 text-primary" aria-hidden />{label}</Link>
                ))}
              </div>
            </section>
            <section aria-labelledby="shortcuts">
              <h2 id="shortcuts" className="mb-3 text-lg font-semibold text-ink-muted">快捷頁面</h2>
              <nav className="card flex flex-wrap items-center gap-x-1 gap-y-1 p-4">
                {[
                  { href: "/tasks/team", label: "任務總表", icon: ListChecks },
                  { href: "/projects", label: "專案總管", icon: FolderKanban },
                  { href: "/timeline", label: "時間軸", icon: GanttChart },
                  ...(can(user, "sales") ? [{ href: "/clients", label: "資料庫", icon: Database }] : []),
                  { href: "/meetings", label: "會議記錄", icon: NotebookText },
                ].map(({ href, label, icon: Icon }, i) => (
                  <span key={href} className="flex items-center">
                    {i > 0 && <span className="mx-1 text-line" aria-hidden>|</span>}
                    <Link href={href} className="inline-flex min-h-touch items-center gap-1.5 rounded-md px-2 font-medium hover:bg-surface-muted md:min-h-[2.25rem]"><Icon className="h-4 w-4 text-ink-muted" aria-hidden />{label}</Link>
                  </span>
                ))}
              </nav>
            </section>
          </div>

          <div className="mb-8 grid gap-6 xl:grid-cols-2">
            <section aria-label="本週任務" className="min-w-0">
              <Band title="本週任務" actions={<div className="flex gap-1.5 [&_a]:bg-white/10 [&_a]:text-white [&_a[aria-current]]:bg-white [&_a[aria-current]]:text-nav"><Chip href="/" active={!mine}>全部</Chip><Chip href="/?mine=1" active={!!mine}>我的</Chip></div>} />
              <div className="card min-w-0">
                {weekTasks.length === 0 ? <Empty>本週沒有待辦任務</Empty> : (
                  <ul className="divide-y divide-line">
                    {weekTasks.map((t) => {
                      const late = t.dueDate && t.dueDate < now && t.dueDate.toDateString() !== now.toDateString();
                      const mgr = canManageProject(user, t.project);
                      const canCheck = mgr || (t.assigneeId === user.id && t.status !== "REVIEW");
                      return (
                        <li key={t.id} className="flex items-center gap-2 px-3 py-1.5">
                          {canCheck ? (
                            <form action={quickCheckTask.bind(null, t.id)}>
                              <button className="flex h-11 w-11 items-center justify-center rounded-md text-ink-subtle hover:bg-surface-muted hover:text-success md:h-8 md:w-8" aria-label={`${mgr ? "完成" : "送審"}：${t.title}`} title={mgr ? "標記完成" : "完成後送經理簽核"}>
                                <Square className="h-4 w-4" aria-hidden />
                              </button>
                            </form>
                          ) : <span className="flex h-11 w-11 items-center justify-center md:h-8 md:w-8" title={t.status === "REVIEW" ? "等待簽核" : undefined}>{t.status === "REVIEW" ? <Clock3 className="h-4 w-4 text-accent" aria-label="等待簽核" /> : <Square className="h-4 w-4 text-line" aria-hidden />}</span>}
                          <div className="min-w-0 flex-1">
                            <Link href={`/tasks/${t.id}`} className="block truncate font-medium hover:underline">{t.title}</Link>
                            <Link href={`/projects/${t.project.id}`} className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-ink-muted hover:text-ink"><Mark name={t.project.name} className="h-4 w-4 text-[10px]" /><span className="truncate">{t.project.name}</span></Link>
                          </div>
                          <Badge status={t.status} />
                          <span className={`w-20 shrink-0 text-right text-xs tabular-nums ${late ? "font-medium text-danger" : "text-ink-muted"}`}>{date(t.dueDate)}{late && <span className="sr-only">（逾期）</span>}</span>
                          <span className="hidden h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-muted text-xs font-medium sm:inline-flex" title={t.assignee?.name ?? "未指派"} aria-label={`負責人 ${t.assignee?.name ?? "未指派"}`}>{t.assignee?.name.charAt(0) ?? "—"}</span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </section>

            <section aria-label="專案進度" className="min-w-0">
              <Band title="專案進度" actions={<Link href="/projects" className="text-sm text-white/90 underline-offset-2 hover:underline">全部專案</Link>} />
              <div className="card min-w-0">
                {progress.length === 0 ? <Empty>沒有進行中的專案</Empty> : (
                  <ul className="divide-y divide-line">
                    {progress.map((p) => {
                      const done = p.tasks.filter((t) => t.status === "DONE").length;
                      const pct = p.tasks.length ? (done / p.tasks.length) * 100 : 0;
                      return (
                        <li key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 sm:flex-nowrap">
                          <Mark name={p.name} />
                          <Link href={`/projects/${p.id}`} className="min-w-0 flex-1 truncate font-medium hover:underline">{p.name}</Link>
                          <span className="w-16 text-right text-sm tabular-nums">{pct.toFixed(2)}%</span>
                          <span className="h-1.5 w-20 overflow-hidden rounded-full bg-surface-muted" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label={`${p.name} 完成度`}>
                            <span className="block h-full rounded-full bg-success" style={{ width: `${pct}%` }} />
                          </span>
                          <span className="w-20 text-right"><Badge status={p.status} /></span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </section>
          </div>

          {meetings.length > 0 && (
            <Card title="近期會議記錄" actions={<Link href="/meetings" className="link text-xs">全部</Link>} pad={false} className="mb-8">
              <table className="tbl"><tbody>
                {meetings.map((m) => (
                  <tr key={m.id} className="align-top">
                    <td className="min-w-[10rem]"><Link className="link font-medium" href={`/meetings/${m.id}`}>{m.title}</Link><div className="text-xs text-ink-muted">{m.project?.name ?? m.projectLabel ?? ""}</div></td>
                    <td className="whitespace-nowrap text-xs text-ink-muted">{date(m.date)}</td>
                    <td className="min-w-[14rem] text-xs"><div className="line-clamp-2">{m.actions ?? m.decisions ?? m.summary ?? ""}</div></td>
                  </tr>
                ))}
              </tbody></table>
            </Card>
          )}
        </>
      )}

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
