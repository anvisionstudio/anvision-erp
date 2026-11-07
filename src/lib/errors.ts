import { db } from "@/lib/db";

type Ctx = { routerKind?: string; routePath?: string; routeType?: string };
type Req = { path?: string; method?: string };

/**
 * 記錄系統錯誤並（若有設定）送出通知。
 * - 寫入 ErrorLog，管理員可在「系統狀態」查看
 * - 設定環境變數 ERROR_WEBHOOK_URL（Google Chat / Slack / Discord 的 Webhook）時送出訊息；同樣的錯誤 1 小時內只通知一次
 * 這裡的任何失敗都不能再丟出錯誤（避免錯誤處理本身造成錯誤）
 */
export async function logError(err: unknown, req: Req = {}, ctx: Ctx = {}) {
  try {
    const e = err as Error & { digest?: string };
    if (e?.digest?.startsWith("NEXT_")) return; // redirect / notFound 不是錯誤
    const message = (e?.message || String(err)).slice(0, 2000);
    const path = req.path?.split("?")[0] ?? ctx.routePath ?? null;
    const recent = await db.errorLog.findFirst({ where: { message, notified: true, createdAt: { gte: new Date(Date.now() - 3600e3) } } });
    const url = process.env.ERROR_WEBHOOK_URL;
    const log = await db.errorLog.create({
      data: { digest: e?.digest ?? null, message, path, method: req.method ?? null, kind: ctx.routeType ?? ctx.routerKind ?? null, notified: !!url && !recent },
    });
    if (url && !recent) {
      const text = `⚠️ Anvision ERP 系統錯誤\n頁面：${path ?? "—"}\n訊息：${message.slice(0, 300)}\n錯誤代碼：${log.digest ?? log.id.slice(-8)}\n時間：${log.createdAt.toLocaleString("zh-TW", { timeZone: "Asia/Taipei" })}`;
      // Google Chat / Slack 讀 text，Discord 讀 content
      await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, content: text }), signal: AbortSignal.timeout(5000) }).catch(() => {});
    }
  } catch (e) {
    console.error("logError failed", e);
  }
}
