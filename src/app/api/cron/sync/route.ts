import { NextResponse, type NextRequest } from "next/server";
import { db, isDemo } from "@/lib/db";
import { parseWorkbook, applyImport, downloadFromDrive } from "@/lib/importer";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

/** Vercel Cron 每日呼叫：從 Google Drive 同步 Excel 帳務（需設定環境變數 CRON_SECRET） */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (isDemo) return NextResponse.json({ skipped: "demo mode" });
  const link = (await db.setting.findUnique({ where: { key: "sync.drive" } }))?.value;
  if (!link) return NextResponse.json({ skipped: "no drive link configured" });
  try {
    const r = await applyImport(await parseWorkbook(await downloadFromDrive(link)), null);
    return NextResponse.json({ ok: true, entries: r.entries, invoices: r.invoices, unbalanced: r.unbalanced.length });
  } catch (e) {
    await db.auditLog.create({ data: { action: "自動同步失敗", entity: "帳務", detail: (e as Error).message } });
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
