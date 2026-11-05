import type { TimelineItem } from "@/components/timeline";
import { canManageProject, canUpdateTask, signActions, PRIORITY, type SignAction } from "./perm";

const iso = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : null);
const TASK_TONE: Record<string, TimelineItem["tone"]> = { TODO: "gray", DOING: "blue", REVIEW: "amber", DONE: "green" };

type U = { id: string; role: string };
type Approval = { action: string; note: string | null; createdAt: Date; user: { name: string } };
export type TaskRow = {
  id: string; parentId: string | null; title: string; status: string; priority: string;
  startDate: Date | null; dueDate: Date | null; assigneeId: string | null; assignee?: { name: string } | null;
  approvals?: Approval[];
};
type ProjectRow = { id: string; name: string; managerId: string | null; startDate: Date | null; dueDate: Date | null; status: string; client?: { name: string } | null; tasks: TaskRow[] };

/** Prisma include：時間軸需要的任務欄位（含最近 5 筆簽核） */
export const TIMELINE_TASK_INCLUDE = {
  assignee: { select: { name: true } },
  approvals: { include: { user: { select: { name: true } } }, orderBy: { createdAt: "desc" as const }, take: 5 },
};

function taskItem(u: U, t: TaskRow, p: ProjectRow, parentId: string, depth: number, childCount: number): TimelineItem {
  const overdue = t.status !== "DONE" && !!t.dueDate && t.dueDate.getTime() < Date.now() - 864e5;
  const pr = PRIORITY[t.priority];
  const manage = canManageProject(u, p);
  return {
    id: t.id, kind: "task", parentId, projectId: p.id, depth, childCount,
    label: t.title, sub: t.assignee?.name ?? "未指派",
    start: iso(t.startDate), end: iso(t.dueDate), tone: overdue ? "red" : TASK_TONE[t.status] ?? "gray",
    href: `/tasks/${t.id}`, editable: canUpdateTask(u, t, p), done: t.status === "DONE", status: t.status,
    priority: pr ? { label: pr.label, tone: pr.tone } : null,
    signActions: signActions(u, t, p) as SignAction[],
    approvals: (t.approvals ?? []).map((a) => ({ action: a.action, note: a.note, at: a.createdAt.toISOString(), by: a.user.name })),
    canAddChild: manage || t.assigneeId === u.id,
  };
}

/** 依「專案 → 任務 → 子項目（多層）」的順序展開成時間軸列 */
export function projectItems(u: U, projects: ProjectRow[]): TimelineItem[] {
  const out: TimelineItem[] = [];
  for (const p of projects) {
    const ds = p.tasks.flatMap((t) => [t.startDate, t.dueDate]).filter((d): d is Date => !!d).map((d) => d.getTime());
    const start = p.startDate ?? (ds.length ? new Date(Math.min(...ds)) : null);
    const end = p.dueDate ?? (ds.length ? new Date(Math.max(...ds)) : null);
    const ids = new Set(p.tasks.map((t) => t.id));
    const kids = new Map<string, TaskRow[]>();
    for (const t of p.tasks) {
      const key = t.parentId && ids.has(t.parentId) ? t.parentId : p.id;
      kids.set(key, [...(kids.get(key) ?? []), t]);
    }
    const sortKey = (t: TaskRow) => t.startDate?.getTime() ?? t.dueDate?.getTime() ?? 9e15;
    out.push({
      id: p.id, kind: "project", parentId: null, projectId: p.id, depth: 0, childCount: kids.get(p.id)?.length ?? 0,
      label: p.name, sub: p.client?.name ?? null, start: iso(start), end: iso(end),
      tone: p.status === "DONE" ? "green" : p.status === "ON_HOLD" ? "amber" : "primary", href: `/projects/${p.id}?tab=timeline`,
      editable: canManageProject(u, p), done: p.status === "DONE", status: p.status, priority: null, signActions: [], approvals: [],
      canAddChild: canManageProject(u, p),
    });
    const walk = (parent: string, depth: number) => {
      for (const t of (kids.get(parent) ?? []).sort((a, b) => sortKey(a) - sortKey(b))) {
        out.push(taskItem(u, t, p, parent, depth, kids.get(t.id)?.length ?? 0));
        walk(t.id, depth + 1);
      }
    };
    walk(p.id, 1);
  }
  return out;
}
