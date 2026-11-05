import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { date, num, isoDate } from "@/lib/format";
import { canManageProject, PRIORITY, PRIORITY_OPTIONS } from "@/lib/perm";
import { saveTask } from "@/app/actions/projects";
import { PageHeader, Card, Badge, Empty, Field, Select, Tabs, Chip } from "@/components/ui";
import { SubmitButton } from "@/components/client";
import { FilterBar } from "@/components/filters";


export default async function TeamTasks({ searchParams }: { searchParams: Promise<{ user?: string; show?: string; project?: string; priority?: string; status?: string; q?: string }> }) {
  const me = await requireUser("projects");
  const sp = await searchParams;
  const now = new Date();
  const weekStart = new Date(now); weekStart.setDate(now.getDate() - ((now.getDay() + 6) % 7)); weekStart.setHours(0, 0, 0, 0);
  const soon = new Date(now.getTime() + 7 * 864e5);
  const [users, tasks, hoursWeek, projects] = await Promise.all([
    db.user.findMany({ where: { active: true }, orderBy: { name: "asc" }, include: { employee: { select: { title: true } } } }),
    db.task.findMany({
      where: { status: { not: "DONE" }, project: { status: { notIn: ["DONE", "CANCELLED"] } } },
      include: { project: { select: { id: true, name: true, managerId: true } }, assignee: { select: { id: true, name: true } } },
    }),
    db.timeEntry.groupBy({ by: ["userId"], where: { date: { gte: weekStart } }, _sum: { hours: true } }),
    db.project.findMany({ where: { status: { in: ["PLANNING", "ACTIVE", "ON_HOLD"] } }, orderBy: { name: "asc" }, select: { id: true, name: true, managerId: true } }),
  ]);
  const weekByUser = new Map(hoursWeek.map((h) => [h.userId, h._sum.hours ?? 0]));
  const manageable = projects.filter((p) => canManageProject(me, p));
  const isOverdue = (t: (typeof tasks)[number]) => !!t.dueDate && t.dueDate.getTime() < now.getTime() - 864e5;

  const rows = [...users.map((u) => ({ id: u.id, name: u.name, title: u.employee?.title })), { id: "none", name: "未指派", title: null }].map((u) => {
    const mine = tasks.filter((t) => (u.id === "none" ? !t.assigneeId : t.assigneeId === u.id));
    return {
      ...u, total: mine.length,
      todo: mine.filter((t) => t.status === "TODO").length, doing: mine.filter((t) => t.status === "DOING").length, review: mine.filter((t) => t.status === "REVIEW").length,
      overdue: mine.filter(isOverdue).length, dueSoon: mine.filter((t) => t.dueDate && t.dueDate >= now && t.dueDate <= soon).length,
      est: mine.reduce((s, t) => s + t.estimateHours, 0), week: weekByUser.get(u.id) ?? 0,
    };
  }).filter((r) => r.id !== "none" || r.total > 0);
  const maxTotal = Math.max(1, ...rows.map((r) => r.total));

  const sel = sp.user;
  const f = { project: sp.project, priority: sp.priority, status: sp.status, q: sp.q };
  const taskProjects = [...new Map(tasks.map((t) => [t.project.id, t.project.name])).entries()].sort((a, b) => a[1].localeCompare(b[1], "zh-TW"));
  const list = tasks
    .filter((t) => (!f.project || t.project.id === f.project) && (!f.priority || t.priority === f.priority) && (!f.status || t.status === f.status) && (!f.q || [t.title, t.project.name].some((x) => x.includes(f.q!))))
    .filter((t) => (!sel ? true : sel === "none" ? !t.assigneeId : t.assigneeId === sel))
    .filter((t) => (sp.show === "overdue" ? isOverdue(t) : sp.show === "soon" ? t.dueDate && t.dueDate >= now && t.dueDate <= soon : true))
    .sort((a, b) => (isOverdue(b) ? 1 : 0) - (isOverdue(a) ? 1 : 0) || (PRIORITY[a.priority]?.order ?? 3) - (PRIORITY[b.priority]?.order ?? 3) || (a.dueDate?.getTime() ?? 9e15) - (b.dueDate?.getTime() ?? 9e15));
  const q = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams(Object.entries({ user: sp.user, show: sp.show, ...f, ...patch }).filter(([, v]) => v) as [string, string][]);
    return `/tasks/team${p.size ? `?${p}` : ""}`;
  };

  return (
    <>
      <PageHeader title="團隊任務" sub={`${tasks.length} 項未完成任務・${rows.reduce((s, r) => s + r.overdue, 0)} 項逾期`} />
      <Tabs active="team" tabs={[{ key: "mine", label: "我的任務", href: "/tasks" }, { key: "team", label: "團隊總覽", href: "/tasks/team" }, { key: "timeline", label: "時間軸", href: "/timeline" }]} />

      <FilterBar path="/tasks/team" values={f} keep={{ user: sp.user, show: sp.show }} fields={[
        { type: "search", name: "q", label: "搜尋", placeholder: "任務、專案…" },
        { type: "select", name: "project", label: "專案", options: taskProjects.map(([value, label]) => ({ value, label })) },
        { type: "select", name: "status", label: "狀態", options: [{ value: "TODO", label: "待辦" }, { value: "DOING", label: "進行中" }, { value: "REVIEW", label: "審核中" }] },
        { type: "select", name: "priority", label: "優先度", options: PRIORITY_OPTIONS },
      ]} />
      <Card title="成員工作量" pad={false} className="mb-6">
        <table className="tbl">
          <thead><tr><th>成員</th><th className="text-right">未完成</th><th>分布</th><th className="text-right">逾期</th><th className="text-right">7 天內到期</th><th className="text-right">預估工時</th><th className="text-right">本週已登錄</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className={sel === r.id ? "bg-primary-soft/50" : ""}>
                <td><Link className="link" href={q({ user: sel === r.id ? undefined : r.id })} aria-current={sel === r.id ? "true" : undefined}>{r.name}</Link>{r.title && <div className="text-xs text-ink-muted">{r.title}</div>}</td>
                <td className="num font-medium">{r.total}</td>
                <td className="w-48 min-w-[8rem]">
                  <div className="flex h-2.5 overflow-hidden rounded-full bg-surface-muted" role="img" aria-label={`待辦 ${r.todo}、進行中 ${r.doing}、審核中 ${r.review}`} style={{ width: `${(r.total / maxTotal) * 100}%` }}>
                    <div className="bg-slate-300" style={{ flex: r.todo }} /><div className="bg-blue-500" style={{ flex: r.doing }} /><div className="bg-amber-400" style={{ flex: r.review }} />
                  </div>
                </td>
                <td className={`num ${r.overdue ? "font-medium text-danger" : ""}`}>{r.overdue || "—"}</td>
                <td className="num">{r.dueSoon || "—"}</td>
                <td className="num">{num(r.est, 1)}h</td>
                <td className="num">{num(r.week, 1)}h</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="px-4 py-2 text-xs text-ink-muted">分布：<span className="mx-1 inline-block h-2 w-3 rounded-sm bg-slate-300 align-middle" />待辦 <span className="mx-1 inline-block h-2 w-3 rounded-sm bg-blue-500 align-middle" />進行中 <span className="mx-1 inline-block h-2 w-3 rounded-sm bg-amber-400 align-middle" />審核中。點成員名稱可篩選下方任務。</p>
      </Card>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card title={`任務清單${sel ? `：${rows.find((r) => r.id === sel)?.name ?? ""}` : ""}（${list.length}）`} pad={false} className="xl:col-span-2"
          actions={<div className="flex flex-wrap gap-1.5"><Chip href={q({ show: undefined })} active={!sp.show}>全部</Chip><Chip href={q({ show: "overdue" })} active={sp.show === "overdue"}>逾期</Chip><Chip href={q({ show: "soon" })} active={sp.show === "soon"}>7 天內</Chip></div>}>
          {list.length === 0 ? <Empty>沒有符合的任務</Empty> : (
            <table className="tbl">
              <thead><tr><th>任務</th><th>負責人</th><th>優先度</th><th>狀態</th><th>截止日</th></tr></thead>
              <tbody>{list.map((t) => {
                const pr = PRIORITY[t.priority] ?? PRIORITY.NORMAL;
                return (
                  <tr key={t.id}>
                    <td><Link className="link" href={`/tasks/${t.id}`}>{t.title}</Link><div className="text-xs text-ink-muted">{t.project.name}</div></td>
                    <td className="whitespace-nowrap">{t.assignee?.name ?? <span className="text-ink-muted">未指派</span>}</td>
                    <td><Badge label={pr.label} tone={pr.tone} /></td>
                    <td><Badge status={t.status} /></td>
                    <td className={`whitespace-nowrap ${isOverdue(t) ? "font-medium text-danger" : ""}`}>{date(t.dueDate)}{isOverdue(t) && <span className="sr-only">（逾期）</span>}</td>
                  </tr>
                );
              })}</tbody>
            </table>
          )}
        </Card>

        {manageable.length > 0 && (
          <div id="assign" className="scroll-mt-20"><Card title="指派任務">
            <form action={saveTask} className="space-y-3">
              <input type="hidden" name="open" value="1" />
              <Field label="專案 *"><Select name="projectId" required placeholder="選擇專案" options={manageable.map((p) => ({ value: p.id, label: p.name }))} /></Field>
              <Field label="任務名稱 *"><input name="title" required className="input" /></Field>
              <Field label="指派給"><Select name="assigneeId" placeholder="未指派" defaultValue={sel && sel !== "none" ? sel : undefined} options={users.map((u) => ({ value: u.id, label: u.name }))} /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="開始日"><input type="date" name="startDate" defaultValue={isoDate(now)} className="input" /></Field>
                <Field label="截止日"><input type="date" name="dueDate" className="input" /></Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="優先度"><Select name="priority" defaultValue="NORMAL" options={PRIORITY_OPTIONS} /></Field>
                <Field label="預估工時"><input type="number" inputMode="decimal" step="0.5" min={0} name="estimateHours" defaultValue={0} className="input" /></Field>
              </div>
              <Field label="說明"><textarea name="description" rows={3} className="input" /></Field>
              <SubmitButton>建立並指派</SubmitButton>
            </form>
          </Card></div>
        )}
      </div>
    </>
  );
}
