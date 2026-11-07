import { NextResponse, type NextRequest } from "next/server";
import { db, isDemo } from "@/lib/db";
import { parseWorkbook, applyImport, downloadFromDrive } from "@/lib/importer";
import { notionConfigured, getNotionDbs, syncNotionMeetings } from "@/lib/notion";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

/** Vercel Cron 每日呼叫：從 Google Drive 同步 Excel 帳務、從 Notion 同步會議記錄（需設定環境變數 CRON_SECRET） */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (isDemo) return NextResponse.json({ skipped: "demo mode" });
  const out: Record<string, unknown> = {};
  let failed = false;

  const link = (await db.setting.findUnique({ where: { key: "sync.drive" } }))?.value;
  if (!link) out.excel = "skipped: no drive link configured";
  else {
    try {
      const r = await applyImport(await parseWorkbook(await downloadFromDrive(link)), null);
      out.excel = { entries: r.entries, invoices: r.invoices, unbalanced: r.unbalanced.length };
      await db.auditLog.create({ data: { action: "自動同步", entity: "帳務", detail: `傳票 ${r.entries}・請款 ${r.invoices}${r.unbalanced.length ? `・${r.unbalanced.length} 張不平衡` : ""}` } });
    } catch (e) {
      failed = true;
      out.excel = { error: (e as Error).message };
      await db.auditLog.create({ data: { action: "自動同步失敗", entity: "帳務", detail: (e as Error).message } });
    }
  }

  if (!notionConfigured() || !(await getNotionDbs()).length) out.notion = "skipped: not configured";
  else {
    try {
      const n = await syncNotionMeetings();
      out.notion = n;
      await db.auditLog.create({ data: { action: "自動同步", entity: "會議記錄", detail: `新增 ${n.created}・更新 ${n.updated}・未變更 ${n.skipped}` } });
    } catch (e) {
      failed = true;
      out.notion = { error: (e as Error).message };
      await db.auditLog.create({ data: { action: "自動同步失敗", entity: "會議記錄", detail: (e as Error).message } });
    }
  }
  return NextResponse.json({ ok: !failed, ...out }, { status: failed ? 500 : 200 });
}
