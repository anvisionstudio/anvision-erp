"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser, audit, can } from "@/lib/auth";
import { canManageProject, canUpdateTask } from "@/lib/perm";
import { str, req, n, dt } from "@/lib/form";
import { nextNumber } from "@/lib/seq";

export async function saveProject(f: FormData) {
  const u = await requireUser("projects");
  const id = str(f, "id");
  const existing = id ? await db.project.findUniqueOrThrow({ where: { id }, select: { managerId: true } }) : null;
  if (id ? !canManageProject(u, existing) : !(u.role === "ADMIN" || u.role === "MANAGER")) throw new Error("只有專案經理或專案負責人可以修改專案");
  const data = {
    name: req(f, "name"), clientId: str(f, "clientId"), managerId: str(f, "managerId"),
    status: str(f, "status") ?? "ACTIVE", budget: n(f, "budget"),
    startDate: dt(f, "startDate"), dueDate: dt(f, "dueDate"), description: str(f, "description"),
  };
  const p = id
    ? await db.project.update({ where: { id }, data })
    : await db.$transaction(async (tx) => tx.project.create({ data: { ...data, code: await nextNumber(tx, "P") } }));
  await audit(u.id, id ? "更新" : "新增", "專案", p.id, p.name);
  revalidatePath("/projects");
  redirect(`/projects/${p.id}`);
}

export async function deleteProject(id: string) {
  const u = await requireUser("projects");
  if (!(u.role === "ADMIN" || u.role === "MANAGER")) throw new Error("只有管理員或專案經理可以刪除專案");
  const c = await db.project.findUniqueOrThrow({ where: { id }, include: { _count: { select: { invoices: true, expenses: true } } } });
  if (c._count.invoices + c._count.expenses > 0) throw new Error("此專案已有請款或費用，請改為「已取消」狀態");
  await db.quote.updateMany({ where: { projectId: id }, data: { projectId: null } });
  await db.project.delete({ where: { id } });
  await audit(u.id, "刪除", "專案", id, c.name);
  redirect("/projects");
}

// ── 任務 ──
const ymd = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10).replaceAll("-", "/") : "未設定");
const STATUS_LABEL: Record<string, string> = { TODO: "待辦", DOING: "進行中", REVIEW: "審核中", DONE: "已完成" };

async function logActivity(taskId: string, userId: string, body: string) {
  await db.taskComment.create({ data: { taskId, userId, kind: "ACTIVITY", body } });
}

function revalidateTask(t: { id: string; projectId: string }) {
  revalidatePath(`/projects/${t.projectId}`);
  revalidatePath(`/tasks/${t.id}`);
  revalidatePath("/tasks");
  revalidatePath("/tasks/team");
  revalidatePath("/timeline");
}

/** 新增 / 編輯任務。指派與刪除僅限可管理專案者；被指派者可更新狀態、日期、說明 */
export async function saveTask(f: FormData) {
  const u = await requireUser("projects");
  const id = str(f, "id");
  const projectId = req(f, "projectId");
  const project = await db.project.findUniqueOrThrow({ where: { id: projectId }, select: { managerId: true, name: true } });
  const manage = canManageProject(u, project);
  const startDate = dt(f, "startDate"), dueDate = dt(f, "dueDate");
  if (startDate && dueDate && dueDate < startDate) throw new Error("截止日不能早於開始日");

  if (!id) {
    if (!manage) throw new Error("只有專案經理或專案負責人可以新增任務");
    const t = await db.task.create({
      data: {
        projectId, title: req(f, "title"), description: str(f, "description"), assigneeId: str(f, "assigneeId"),
        startDate, dueDate, estimateHours: n(f, "estimateHours"), status: str(f, "status") ?? "TODO",
        priority: str(f, "priority") ?? "NORMAL", createdById: u.id,
      },
      include: { assignee: true },
    });
    await logActivity(t.id, u.id, `建立任務${t.assignee ? `，指派給 ${t.assignee.name}` : ""}`);
    await audit(u.id, "新增", "任務", t.id, t.title);
    revalidateTask(t);
    if (str(f, "open")) redirect(`/tasks/${t.id}`);
    return;
  }

  const cur = await db.task.findUniqueOrThrow({ where: { id }, include: { assignee: true } });
  if (!canUpdateTask(u, cur, project)) throw new Error("您不是此任務的負責人，無法修改");
  const data: Record<string, unknown> = {
    title: str(f, "title") ?? cur.title, description: str(f, "description"),
    startDate, dueDate, status: str(f, "status") ?? cur.status,
  };
  if (manage) {
    data.assigneeId = str(f, "assigneeId");
    data.priority = str(f, "priority") ?? cur.priority;
    data.estimateHours = n(f, "estimateHours", cur.estimateHours);
  }
  if (data.status === "DONE" && cur.status !== "DONE") data.completedAt = new Date();
  if (data.status !== "DONE") data.completedAt = null;
  const t = await db.task.update({ where: { id }, data, include: { assignee: true } });

  const log: string[] = [];
  if (manage && cur.assigneeId !== t.assigneeId) log.push(t.assignee ? `指派給 ${t.assignee.name}` : `取消指派（原為 ${cur.assignee?.name ?? "—"}）`);
  if (cur.status !== t.status) log.push(`狀態：${STATUS_LABEL[cur.status] ?? cur.status} → ${STATUS_LABEL[t.status] ?? t.status}`);
  if (ymd(cur.startDate) !== ymd(t.startDate) || ymd(cur.dueDate) !== ymd(t.dueDate)) log.push(`日期：${ymd(t.startDate)} – ${ymd(t.dueDate)}`);
  if (manage && cur.priority !== t.priority) log.push(`優先度：${t.priority}`);
  if (cur.title !== t.title) log.push(`標題改為「${t.title}」`);
  for (const l of log) await logActivity(t.id, u.id, l);
  await audit(u.id, "更新", "任務", t.id, t.title);
  revalidateTask(t);
}

export async function setTaskStatus(id: string, status: string) {
  const u = await requireUser("projects");
  const cur = await db.task.findUniqueOrThrow({ where: { id }, include: { project: { select: { managerId: true } } } });
  if (!canUpdateTask(u, cur, cur.project)) throw new Error("您不是此任務的負責人，無法變更狀態");
  if (cur.status === status) return;
  const t = await db.task.update({ where: { id }, data: { status, completedAt: status === "DONE" ? new Date() : null } });
  await logActivity(id, u.id, `狀態：${STATUS_LABEL[cur.status] ?? cur.status} → ${STATUS_LABEL[status] ?? status}`);
  revalidateTask(t);
}

/** 時間軸拖曳：更新任務起訖日 */
export async function setTaskDates(id: string, start: string, end: string) {
  const u = await requireUser("projects");
  const cur = await db.task.findUniqueOrThrow({ where: { id }, include: { project: { select: { managerId: true } } } });
  if (!canUpdateTask(u, cur, cur.project)) throw new Error("您沒有權限調整此任務日期");
  const startDate = new Date(start), dueDate = new Date(end);
  if (isNaN(+startDate) || isNaN(+dueDate) || dueDate < startDate) throw new Error("日期不正確");
  const t = await db.task.update({ where: { id }, data: { startDate, dueDate } });
  await logActivity(id, u.id, `日期：${ymd(startDate)} – ${ymd(dueDate)}`);
  revalidateTask(t);
}

/** 時間軸拖曳：更新專案起訖日 */
export async function setProjectDates(id: string, start: string, end: string) {
  const u = await requireUser("projects");
  const p = await db.project.findUniqueOrThrow({ where: { id }, select: { managerId: true } });
  if (!canManageProject(u, p)) throw new Error("您沒有權限調整此專案日期");
  const startDate = new Date(start), dueDate = new Date(end);
  if (isNaN(+startDate) || isNaN(+dueDate) || dueDate < startDate) throw new Error("日期不正確");
  await db.project.update({ where: { id }, data: { startDate, dueDate } });
  await audit(u.id, "調整日期", "專案", id, `${ymd(startDate)} – ${ymd(dueDate)}`);
  revalidatePath(`/projects/${id}`);
  revalidatePath("/timeline");
}

export async function addTaskComment(f: FormData) {
  const u = await requireUser("projects");
  const taskId = req(f, "taskId");
  const body = req(f, "body");
  if (body.length > 4000) throw new Error("留言請少於 4000 字");
  const t = await db.task.findUniqueOrThrow({ where: { id: taskId }, select: { id: true, projectId: true } });
  await db.taskComment.create({ data: { taskId, userId: u.id, body, kind: "COMMENT" } });
  revalidateTask(t);
}

export async function deleteTaskComment(id: string) {
  const u = await requireUser("projects");
  const c = await db.taskComment.findUniqueOrThrow({ where: { id }, include: { task: { select: { id: true, projectId: true } } } });
  if (c.kind !== "COMMENT" || (c.userId !== u.id && u.role !== "ADMIN")) throw new Error("只能刪除自己的留言");
  await db.taskComment.delete({ where: { id } });
  revalidateTask(c.task);
}

export async function deleteTask(id: string) {
  const u = await requireUser("projects");
  const cur = await db.task.findUniqueOrThrow({ where: { id }, include: { project: { select: { managerId: true } } } });
  if (!canManageProject(u, cur.project)) throw new Error("只有專案經理或專案負責人可以刪除任務");
  const t = await db.task.delete({ where: { id } });
  await audit(u.id, "刪除", "任務", id, t.title);
  revalidateTask(t);
  redirect(`/projects/${t.projectId}`);
}

// ── 工時 ──
export async function saveTime(f: FormData) {
  const u = await requireUser("time");
  // 主管 / 會計 可替他人登錄，一般成員只能登錄自己
  const userId = can(u, "finance") || u.role === "MANAGER" ? str(f, "userId") ?? u.id : u.id;
  const hours = n(f, "hours");
  if (hours <= 0 || hours > 24) throw new Error("工時需介於 0–24 小時");
  await db.timeEntry.create({
    data: { userId, projectId: req(f, "projectId"), taskId: str(f, "taskId"), date: dt(f, "date") ?? new Date(), hours, note: str(f, "note") },
  });
  revalidatePath("/time");
  const back = str(f, "back");
  if (back) revalidatePath(back);
}

export async function deleteTime(id: string) {
  const u = await requireUser("time");
  const t = await db.timeEntry.findUniqueOrThrow({ where: { id } });
  if (t.userId !== u.id && u.role === "STAFF") throw new Error("只能刪除自己的工時");
  await db.timeEntry.delete({ where: { id } });
  revalidatePath("/time");
  revalidatePath(`/projects/${t.projectId}`);
}
