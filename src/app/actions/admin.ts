"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser, audit, hashPassword } from "@/lib/auth";
import { str, req } from "@/lib/form";
import { COMPANY_FIELDS, DOC_FIELDS, IMAGE_KEYS } from "@/lib/settings";

export async function saveSettings(f: FormData) {
  const u = await requireUser("admin");
  for (const [key] of [...COMPANY_FIELDS, ...DOC_FIELDS]) {
    if (!f.has(key)) continue;
    const value = (f.get(key) as string | null)?.trim() ?? "";
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

const IMAGE_TYPES = ["image/png", "image/jpeg", "image/svg+xml", "image/webp"];

/** 上傳單據圖片（Logo / 標誌 / 印章），以 data URL 存入設定 */
export async function saveCompanyImage(f: FormData) {
  const u = await requireUser("admin");
  const key = req(f, "key");
  if (!IMAGE_KEYS.some(([k]) => k === key)) throw new Error("不支援的圖片欄位");
  const file = f.get("file");
  if (!(file instanceof File) || !file.size) throw new Error("請選擇圖片檔");
  if (!IMAGE_TYPES.includes(file.type)) throw new Error("請上傳 PNG、JPG、SVG 或 WebP 圖片（印章建議用去背 PNG）");
  if (file.size > 3 * 1024 * 1024) throw new Error("圖片請小於 3MB");
  const value = `data:${file.type};base64,${Buffer.from(await file.arrayBuffer()).toString("base64")}`;
  await db.setting.upsert({ where: { key }, create: { key, value }, update: { value } });
  await audit(u.id, "上傳圖片", "公司設定", undefined, key);
  revalidatePath("/settings");
}

export async function removeCompanyImage(key: string) {
  const u = await requireUser("admin");
  if (!IMAGE_KEYS.some(([k]) => k === key)) throw new Error("不支援的圖片欄位");
  await db.setting.deleteMany({ where: { key } });
  await audit(u.id, "移除圖片", "公司設定", undefined, key);
  revalidatePath("/settings");
}
