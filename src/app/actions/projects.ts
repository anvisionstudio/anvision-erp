"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser, audit, can } from "@/lib/auth";
import { str, req, n, dt } from "@/lib/form";
import { nextNumber } from "@/lib/seq";

export async function saveProject(f: FormData) {
  const u = await requireUser("projects");
  if (u.role === "STAFF") throw new Error("權限不足");
  const id = str(f, "id");
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
  if (u.role === "STAFF") throw new Error("權限不足");
  const c = await db.project.findUniqueOrThrow({ where: { id }, include: { _count: { select: { invoices: true, expenses: true } } } });
  if (c._count.invoices + c._count.expenses > 0) throw new Error("此專案已有請款或費用，請改為「已取消」狀態");
  await db.quote.updateMany({ where: { projectId: id }, data: { projectId: null } });
  await db.project.delete({ where: { id } });
  await audit(u.id, "刪除", "專案", id, c.name);
  redirect("/projects");
}

// ── 任務 ──
export async function saveTask(f: FormData) {
  const u = await requireUser("projects");
  const id = str(f, "id");
  const projectId = req(f, "projectId");
  const data = {
    title: req(f, "title"), assigneeId: str(f, "assigneeId"), dueDate: dt(f, "dueDate"),
    estimateHours: n(f, "estimateHours"), status: str(f, "status") ?? "TODO",
  };
  if (id) await db.task.update({ where: { id }, data });
  else await db.task.create({ data: { ...data, projectId } });
  await audit(u.id, id ? "更新" : "新增", "任務", id ?? undefined, data.title);
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/tasks");
}

export async function setTaskStatus(id: string, status: string) {
  await requireUser("projects");
  const t = await db.task.update({ where: { id }, data: { status } });
  revalidatePath(`/projects/${t.projectId}`);
  revalidatePath("/tasks");
}

export async function deleteTask(id: string) {
  const u = await requireUser("projects");
  const t = await db.task.delete({ where: { id } });
  await audit(u.id, "刪除", "任務", id, t.title);
  revalidatePath(`/projects/${t.projectId}`);
  revalidatePath("/tasks");
}

// ── 工時 ──
export async function saveTime(f: FormData) {
  const u = await requireUser("time");
  // 主管 / 會計 可替他人登錄，一般成員只能登錄自己
  const userId = can(u, "finance") || u.role === "MANAGER" ? str(f, "userId") ?? u.id : u.id;
  const hours = n(f, "hours");
  if (hours <= 0 || hours > 24) throw new Error("工時需介於 0–24 小時");
  await db.timeEntry.create({
    data: { userId, projectId: req(f, "projectId"), date: dt(f, "date") ?? new Date(), hours, note: str(f, "note") },
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
