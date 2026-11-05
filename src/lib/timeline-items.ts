import type { TimelineItem } from "@/components/timeline";
import { canManageProject, canUpdateTask } from "./perm";

const iso = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : null);
const TASK_TONE: Record<string, TimelineItem["tone"]> = { TODO: "gray", DOING: "blue", REVIEW: "amber", DONE: "green" };

type U = { id: string; role: string };
type TaskRow = { id: string; title: string; status: string; startDate: Date | null; dueDate: Date | null; assigneeId: string | null; assignee?: { name: string } | null };
type ProjectRow = { id: string; name: string; managerId: string | null; startDate: Date | null; dueDate: Date | null; status: string; client?: { name: string } | null; tasks: TaskRow[] };

export function taskItem(u: U, t: TaskRow, p: { managerId: string | null }, parentId?: string): TimelineItem {
  const overdue = t.status !== "DONE" && t.dueDate && t.dueDate.getTime() < Date.now() - 864e5;
  return {
    id: t.id, kind: "task", parentId, label: t.title, sub: t.assignee?.name ?? "未指派",
    start: iso(t.startDate), end: iso(t.dueDate), tone: overdue ? "red" : TASK_TONE[t.status] ?? "gray",
    href: `/tasks/${t.id}`, editable: canUpdateTask(u, t, p), done: t.status === "DONE",
  };
}

export function projectItems(u: U, projects: ProjectRow[]): TimelineItem[] {
  const out: TimelineItem[] = [];
  for (const p of projects) {
    // 專案沒有設定期間時，以任務的最早 / 最晚日期推算
    const ds = p.tasks.flatMap((t) => [t.startDate, t.dueDate]).filter((d): d is Date => !!d).map((d) => d.getTime());
    const start = p.startDate ?? (ds.length ? new Date(Math.min(...ds)) : null);
    const end = p.dueDate ?? (ds.length ? new Date(Math.max(...ds)) : null);
    out.push({
      id: p.id, kind: "project", label: p.name, sub: p.client?.name ?? null, start: iso(start), end: iso(end),
      tone: p.status === "DONE" ? "green" : p.status === "ON_HOLD" ? "amber" : "primary", href: `/projects/${p.id}?tab=timeline`,
      editable: canManageProject(u, p), done: p.status === "DONE",
    });
    for (const t of p.tasks) out.push(taskItem(u, t, p, p.id));
  }
  return out;
}
