import { CheckCircle2, AlertTriangle, Download } from "lucide-react";
import { db, isDemo } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { PageHeader, Card, Empty, Badge, Stat } from "@/components/ui";

const fmt = (d: Date) => d.toLocaleString("zh-TW", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });
const KIND: Record<string, string> = { render: "頁面", route: "API", action: "操作", middleware: "登入檢查" };

export default async function SystemStatus() {
  await requireUser("admin");
  const day = new Date(Date.now() - 864e5), week = new Date(Date.now() - 7 * 864e5);
  const [errors, errors24, errors7, syncs, lastBackup, total] = await Promise.all([
    db.errorLog.findMany({ orderBy: { createdAt: "desc" }, take: 50 }),
    db.errorLog.count({ where: { createdAt: { gte: day } } }),
    db.errorLog.count({ where: { createdAt: { gte: week } } }),
    db.auditLog.findMany({ where: { OR: [{ action: { contains: "同步" } }, { action: { contains: "匯入" }, entity: "帳務" }] }, orderBy: { createdAt: "desc" }, take: 8, include: { user: { select: { name: true } } } }),
    db.auditLog.findFirst({ where: { action: "下載備份" }, orderBy: { createdAt: "desc" }, include: { user: { select: { name: true } } } }),
    Promise.all([db.client.count(), db.project.count(), db.invoice.count(), db.journalEntry.count(), db.meeting.count()]),
  ]);
  const webhook = !!process.env.ERROR_WEBHOOK_URL;
  const backupAge = lastBackup ? Math.floor((Date.now() - lastBackup.createdAt.getTime()) / 864e5) : null;

  return (
    <>
      <PageHeader title="系統狀態" sub="錯誤紀錄、自動同步與資料備份" />
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="過去 24 小時錯誤" value={errors24} tone={errors24 ? "bad" : "good"} hint={errors24 ? "請查看下方紀錄" : "系統正常"} />
        <Stat label="過去 7 天錯誤" value={errors7} />
        <Stat label="錯誤通知" value={<span className="text-base">{webhook ? "已開啟" : "未設定"}</span>} hint={webhook ? "錯誤會即時傳到聊天群組" : "設定方式見下方"} />
        <Stat label="上次備份" value={<span className="text-base">{lastBackup ? (backupAge === 0 ? "今天" : `${backupAge} 天前`) : "尚未備份"}</span>} tone={backupAge === null || backupAge > 7 ? "bad" : undefined} hint={lastBackup ? `${fmt(lastBackup.createdAt)}・${lastBackup.user?.name ?? ""}` : "建議每週下載一次"} />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card title="錯誤紀錄（最近 50 筆）" pad={false} className="xl:col-span-2">
          {errors.length === 0 ? <Empty>目前沒有錯誤紀錄</Empty> : (
            <table className="tbl">
              <thead><tr><th>時間</th><th>頁面</th><th className="min-w-[16rem]">訊息</th><th>錯誤代碼</th></tr></thead>
              <tbody>{errors.map((e) => (
                <tr key={e.id} className="align-top">
                  <td className="whitespace-nowrap text-xs">{fmt(e.createdAt)}</td>
                  <td className="text-xs"><span className="font-mono">{e.path ?? "—"}</span>{e.kind && <div className="mt-1"><Badge label={KIND[e.kind] ?? e.kind} dot={false} /></div>}</td>
                  <td className="text-xs"><div className="line-clamp-3 break-all">{e.message}</div></td>
                  <td className="font-mono text-xs"><span className="select-all">{e.digest ?? e.id.slice(-8)}</span></td>
                </tr>
              ))}</tbody>
            </table>
          )}
        </Card>

        <div className="space-y-6">
          <Card title="資料備份">
            <p className="text-sm text-ink-muted">下載整個系統的資料（客戶、專案、報價、請款、傳票、會議記錄、設定…）成一個 JSON 檔，請存到公司雲端硬碟。登入密碼不包含在內。</p>
            <p className="mt-2 text-sm text-ink-muted">目前資料：客戶 {total[0]}・專案 {total[1]}・請款單 {total[2]}・傳票 {total[3]}・會議記錄 {total[4]}</p>
            <a href="/api/backup" className="btn-primary mt-4" download><Download className="h-4 w-4" aria-hidden />下載完整備份</a>
            {!isDemo && (
              <p className="mt-4 border-t border-line pt-3 text-xs text-ink-muted">
                資料庫本身（Neon）另有自動還原點：到 Neon 後台 → 專案 → Restore 可把資料還原到過去某個時間點，保留天數依方案而定。
              </p>
            )}
          </Card>

          <Card title="自動同步紀錄" pad={false}>
            {syncs.length === 0 ? <Empty>尚無同步紀錄</Empty> : (
              <ul className="divide-y divide-line">
                {syncs.map((s) => {
                  const failed = s.action.includes("失敗");
                  return (
                    <li key={s.id} className="flex gap-2 px-4 py-2.5 text-sm">
                      {failed ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger" aria-label="失敗" /> : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-label="成功" />}
                      <div className="min-w-0">
                        <div className="font-medium">{s.entity}：{s.action}</div>
                        <div className="text-xs text-ink-muted">{fmt(s.createdAt)}{s.user ? `・${s.user.name}` : "・自動"}</div>
                        {s.detail && <div className={`mt-0.5 break-all text-xs ${failed ? "text-danger" : "text-ink-muted"}`}>{s.detail}</div>}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card title="錯誤即時通知">
            {webhook ? <p className="text-sm text-ink-muted">已開啟。系統發生錯誤時會傳訊息到設定的聊天群組（同樣的錯誤 1 小時內只通知一次）。</p> : (
              <div className="space-y-2 text-sm text-ink-muted">
                <p>想在手機收到錯誤通知，可以接上公司的聊天群組：</p>
                <ol className="list-decimal space-y-1 pl-5">
                  <li>在 Google Chat 聊天室（或 Slack、Discord 頻道）建立「Webhook」，複製網址</li>
                  <li>到 Vercel 專案 → Settings → Environment Variables 新增 <code className="font-mono">ERROR_WEBHOOK_URL</code>，只勾 Production，然後重新部署</li>
                </ol>
                <p>沒有設定也沒關係：錯誤一樣會記錄在這頁，儀表板也會提醒管理員。</p>
              </div>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
