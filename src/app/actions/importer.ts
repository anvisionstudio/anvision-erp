"use server";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { db, isDemo } from "@/lib/db";
import { requireUser, audit } from "@/lib/auth";
import { parseWorkbook, applyImport, downloadFromDrive } from "@/lib/importer";

export type ImportState = { ok?: string; error?: string } | null;

async function guard() {
  const u = await requireUser("finance");
  if (isDemo) throw new Error("示範模式不能匯入真實帳務資料：資料不會保存，且示範網站的預設帳號是公開的。請先在 Vercel 連接資料庫（Storage → Neon）。");
  if (await bcrypt.compare("anvision1234", u.passwordHash))
    throw new Error("您仍在使用預設密碼。匯入公司帳務前，請先到左下角「我的帳號」變更密碼。");
  return u;
}

const done = (r: Awaited<ReturnType<typeof applyImport>>) =>
  `匯入完成：${r.accounts} 個科目、${r.entries} 張傳票（${r.lines} 筆分錄）、新增 ${r.projectsCreated} / 更新 ${r.projectsUpdated} 個專案、${r.invoices} 張發票，耗時 ${r.seconds} 秒。`;

export async function importUpload(_: ImportState, f: FormData): Promise<ImportState> {
  try {
    const u = await guard();
    const file = f.get("file");
    if (!(file instanceof File) || file.size === 0) return { error: "請選擇 Excel 檔案（.xlsx）" };
    if (!file.name.toLowerCase().endsWith(".xlsx")) return { error: "只支援 .xlsx 格式" };
    const r = await applyImport(await parseWorkbook(await file.arrayBuffer()), u.id);
    revalidatePath("/", "layout");
    return { ok: done(r) };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function importDrive(_: ImportState, f: FormData): Promise<ImportState> {
  try {
    const u = await guard();
    const link = String(f.get("drive") ?? "").trim();
    if (!link) return { error: "請貼上 Google Drive 檔案連結" };
    await db.setting.upsert({ where: { key: "sync.drive" }, create: { key: "sync.drive", value: link }, update: { value: link } });
    const r = await applyImport(await parseWorkbook(await downloadFromDrive(link)), u.id);
    revalidatePath("/", "layout");
    return { ok: done(r) };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function setAutopost(on: boolean) {
  const u = await requireUser("finance");
  await db.setting.upsert({ where: { key: "ledger.autopost" }, create: { key: "ledger.autopost", value: String(on) }, update: { value: String(on) } });
  await audit(u.id, on ? "開啟自動過帳" : "關閉自動過帳", "帳務設定");
  revalidatePath("/settings/import");
}

export async function clearDriveLink() {
  await requireUser("finance");
  await db.setting.deleteMany({ where: { key: "sync.drive" } });
  revalidatePath("/settings/import");
}
