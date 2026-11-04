import Link from "next/link";
import { db, isDemo } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { num } from "@/lib/format";
import { setAutopost, clearDriveLink } from "@/app/actions/importer";
import { PageHeader, Card, Badge, Stat } from "@/components/ui";
import { ConfirmButton } from "@/components/client";
import { UploadForm, DriveForm } from "./forms";

export const maxDuration = 300;

type Summary = {
  at: string; accounts: number; entries: number; lines: number; projectsCreated: number; projectsUpdated: number;
  invoices: number; seconds: number; unbalanced: { number: string; debit: number; credit: number }[]; warnings: string[];
};

export default async function ImportPage() {
  await requireUser("finance");
  const settings = Object.fromEntries((await db.setting.findMany({ where: { key: { in: ["import.last", "sync.drive", "ledger.autopost"] } } })).map((s) => [s.key, s.value]));
  const last: Summary | null = settings["import.last"] ? JSON.parse(settings["import.last"]) : null;
  const autopost = settings["ledger.autopost"] !== "false";
  const drive = settings["sync.drive"] ?? "";
  return (
    <>
      <PageHeader title="Excel 帳務同步" sub="匯入「捷瑞會計系統」格式的 Excel：會計項目表、日記簿、專案清單、發票明細" />
      {isDemo && (
        <div className="mb-6 rounded-md bg-red-50 p-4 text-sm text-red-700">
          目前是<b>示範模式</b>，無法匯入真實帳務資料（資料不會保存，且示範網站的預設帳號是公開的）。請先在 Vercel 專案的 Storage 連接 Neon 資料庫並重新部署。
        </div>
      )}
      {last && (
        <Card title={`上次同步：${new Date(last.at).toLocaleString("zh-TW", { hour12: false, timeZone: "Asia/Taipei" })}`} className="mb-6">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
            <Stat label="會計科目" value={num(last.accounts)} />
            <Stat label="傳票" value={num(last.entries)} hint={`${num(last.lines)} 筆分錄`} />
            <Stat label="專案" value={num(last.projectsCreated + last.projectsUpdated)} hint={`新增 ${last.projectsCreated}・更新 ${last.projectsUpdated}`} />
            <Stat label="發票 / 請款" value={num(last.invoices)} />
            <Stat label="借貸不平傳票" value={last.unbalanced.length} tone={last.unbalanced.length ? "bad" : "good"} />
          </div>
          {last.unbalanced.length > 0 && (
            <div className="mt-4 text-sm">
              <div className="mb-1 font-medium text-red-700">以下傳票在 Excel 中借貸不平衡，請回 Excel 日記簿修正後再同步：</div>
              <div className="flex flex-wrap gap-2">
                {last.unbalanced.map((u) => (
                  <Link key={u.number} href={`/accounting?q=${encodeURIComponent(u.number)}`} className="rounded bg-red-50 px-2 py-1 font-mono text-xs text-red-700 hover:underline">
                    {u.number}（借 {num(u.debit)} / 貸 {num(u.credit)}）
                  </Link>
                ))}
              </div>
            </div>
          )}
          {last.warnings.length > 0 && (
            <ul className="mt-4 list-disc pl-5 text-xs text-amber-700">{last.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
          )}
        </Card>
      )}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="方式一：上傳 Excel 檔">
          <p className="mb-3 text-sm text-slate-500">從 Google Drive 下載最新的 .xlsx 後上傳。可重複匯入，會以 Excel 內容為準更新。</p>
          <UploadForm />
        </Card>
        <Card title="方式二：從 Google Drive 自動同步" actions={drive ? <ConfirmButton action={clearDriveLink} message="停止每日自動同步？">停止自動同步</ConfirmButton> : undefined}>
          <p className="mb-3 text-sm text-slate-500">
            貼上 Drive 檔案連結。檔案共用設定需為「知道連結的任何人」可檢視。設定後系統每天凌晨 2 點自動同步一次，也可隨時按下方按鈕立即同步。
          </p>
          <DriveForm link={drive} />
          {drive && <p className="mt-2 text-xs text-emerald-700">✓ 已啟用每日自動同步</p>}
        </Card>
        <Card title="匯入規則" className="lg:col-span-2">
          <ul className="list-disc space-y-1 pl-5 text-sm text-slate-600">
            <li><b>Excel 是帳務主檔</b>：日記簿每次整批取代 ERP 中「Excel 匯入」的傳票；ERP 內手動輸入的傳票不受影響。</li>
            <li><b>專案</b>以「專案簡稱」對應：新的會新增，已存在的只更新名稱與金額，ERP 裡的任務、工時不會被刪除。</li>
            <li><b>發票</b>依專案清單的發票號碼建立請款單（含入帳金額與發票明細），暫掛在「Excel 匯入客戶（待整理）」。</li>
            <li>日記簿的「專案」欄會保留在每筆分錄上，專案損益直接取自帳上的收入與成本。</li>
          </ul>
          <div className="mt-4 flex flex-wrap items-center gap-3 rounded-md bg-slate-50 p-3 text-sm">
            <span>ERP 自動過帳：</span>
            <Badge label={autopost ? "開啟" : "關閉"} tone={autopost ? "green" : "gray"} />
            <span className="text-slate-500">
              {autopost ? "請款、收款、費用、薪資會自動產生傳票。" : "以 Excel 為帳務主檔，ERP 的請款/費用/薪資不會另外產生傳票，避免重複入帳。"}
            </span>
            <ConfirmButton action={setAutopost.bind(null, !autopost)} message={autopost ? "關閉自動過帳？" : "開啟自動過帳？若帳務仍在 Excel 記錄，可能造成重複入帳。"} className="btn-secondary btn-sm">
              {autopost ? "關閉" : "開啟"}
            </ConfirmButton>
          </div>
        </Card>
      </div>
    </>
  );
}
