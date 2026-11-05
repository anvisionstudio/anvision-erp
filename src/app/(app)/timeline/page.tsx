import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { projectItems } from "@/lib/timeline-items";
import { setTaskDates, setProjectDates } from "@/app/actions/projects";
import { Timeline } from "@/components/timeline";
import { PageHeader, Chip } from "@/components/ui";

export default async function TimelinePage({ searchParams }: { searchParams: Promise<{ user?: string; show?: string }> }) {
  const me = await requireUser("projects");
  const sp = await searchParams;
  const showDone = sp.show === "all";
  const taskWhere = { ...(sp.user === "me" ? { assigneeId: me.id } : sp.user === "none" ? { assigneeId: null } : sp.user ? { assigneeId: sp.user } : {}), ...(showDone ? {} : { status: { not: "DONE" } }) };
  const [projects, users] = await Promise.all([
    db.project.findMany({
      where: { status: { in: showDone ? ["PLANNING", "ACTIVE", "ON_HOLD", "DONE"] : ["PLANNING", "ACTIVE", "ON_HOLD"] }, ...(sp.user ? { tasks: { some: taskWhere } } : {}) },
      include: { client: true, tasks: { where: taskWhere, include: { assignee: true }, orderBy: [{ startDate: "asc" }, { dueDate: "asc" }] } },
      orderBy: [{ startDate: "asc" }, { createdAt: "asc" }],
    }),
    db.user.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  const items = projectItems(me, projects);
  const q = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams(Object.entries({ user: sp.user, show: sp.show, ...patch }).filter(([, v]) => v) as [string, string][]);
    return `/timeline${p.size ? `?${p}` : ""}`;
  };
  return (
    <>
      <PageHeader title="時間軸" sub={`${projects.length} 個專案・${items.filter((i) => i.kind === "task").length} 項任務`} />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="text-sm text-ink-muted">成員</span>
        <Chip href={q({ user: undefined })} active={!sp.user}>全部</Chip>
        <Chip href={q({ user: "me" })} active={sp.user === "me"}>我的</Chip>
        {users.filter((u) => u.id !== me.id).map((u) => <Chip key={u.id} href={q({ user: u.id })} active={sp.user === u.id}>{u.name}</Chip>)}
        <Chip href={q({ user: "none" })} active={sp.user === "none"}>未指派</Chip>
        <span className="ml-0 text-sm text-ink-muted sm:ml-4">狀態</span>
        <Chip href={q({ show: undefined })} active={!showDone}>進行中</Chip>
        <Chip href={q({ show: "all" })} active={showDone}>含已完成</Chip>
      </div>
      <Timeline items={items} moveTask={setTaskDates} moveProject={setProjectDates} emptyText="沒有符合條件的專案或任務" />
      <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-muted">
        <span><span className="mr-1 inline-block h-2.5 w-4 rounded-sm bg-primary align-middle" />專案</span>
        <span><span className="mr-1 inline-block h-2.5 w-4 rounded-sm bg-slate-200 align-middle" />待辦</span>
        <span><span className="mr-1 inline-block h-2.5 w-4 rounded-sm bg-blue-100 ring-1 ring-blue-300 align-middle" />進行中</span>
        <span><span className="mr-1 inline-block h-2.5 w-4 rounded-sm bg-amber-100 ring-1 ring-amber-300 align-middle" />審核中</span>
        <span><span className="mr-1 inline-block h-2.5 w-4 rounded-sm bg-emerald-100 ring-1 ring-emerald-300 align-middle" />已完成</span>
        <span><span className="mr-1 inline-block h-2.5 w-4 rounded-sm bg-red-100 ring-1 ring-red-300 align-middle" />逾期</span>
      </p>
    </>
  );
}
