"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser, audit, hashPassword } from "@/lib/auth";
import { str, req } from "@/lib/form";
import { COMPANY_FIELDS } from "@/lib/settings";

export async function saveSettings(f: FormData) {
  const u = await requireUser("admin");
  for (const [key] of COMPANY_FIELDS) {
    const value = str(f, key) ?? "";
    await db.setting.upsert({ where: { key }, create: { key, value }, update: { value } });
  }
  await audit(u.id, "更新", "公司設定");
  revalidatePath("/", "layout");
}

export async function saveUser(f: FormData) {
  const u = await requireUser("admin");
  const id = str(f, "id");
  const pw = str(f, "password");
  const data = { name: req(f, "name"), email: req(f, "email").toLowerCase(), role: req(f, "role"), active: str(f, "active") !== "false" };
  if (id === u.id && (data.role !== "ADMIN" || !data.active)) throw new Error("不能移除自己的管理員權限");
  if (id) {
    await db.user.update({ where: { id }, data: { ...data, ...(pw ? { passwordHash: await hashPassword(pw) } : {}) } });
    if (!data.active) await db.session.deleteMany({ where: { userId: id } });
  } else {
    if (!pw || pw.length < 8) throw new Error("新帳號密碼至少 8 碼");
    await db.user.create({ data: { ...data, passwordHash: await hashPassword(pw) } });
  }
  await audit(u.id, id ? "更新" : "新增", "帳號", id ?? undefined, data.email);
  revalidatePath("/settings");
}

export async function changeOwnPassword(f: FormData) {
  const u = await requireUser();
  const pw = req(f, "password");
  if (pw.length < 8) throw new Error("密碼至少 8 碼");
  await db.user.update({ where: { id: u.id }, data: { passwordHash: await hashPassword(pw) } });
  await audit(u.id, "變更密碼", "帳號", u.id);
}
