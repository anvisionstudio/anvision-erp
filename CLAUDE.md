# Anvision ERP — 開發說明

景安設計有限公司（Anvision Studio）內部 ERP：設計／動畫工作室，10 人以內。
使用者介面一律**繁體中文（台灣）**；程式碼、變數名稱用英文，註解可用中文。

## 技術
- Next.js 15（App Router、Server Actions）、React 19、TypeScript、Tailwind 3、lucide-react
- Prisma 6：本機與測試用 SQLite；正式環境 PostgreSQL（Neon）。`scripts/vercel-build.mjs` 會在建置時把 provider 換成 postgresql
- 部署：Vercel（區域 sin1）。`main` = 正式版；其他分支 = 預覽版（測試網址）

## 工作流程（每次修改都照這個做）
1. 從 `main` 開新分支（例如 `feat/xxx`、`fix/xxx`），不要直接改 `main`
2. 修改後執行 `npm run check`（型別檢查 → 建置 → 16+ 項瀏覽器自動測試），全部通過才推送
3. 新功能要補自動測試（`tests/e2e/*.spec.ts`）；修 bug 先寫一個會失敗的測試
4. 推送分支 → GitHub Actions 自動檢查、Vercel 產生預覽網址 → 使用者在預覽網址確認 → 合併到 `main` 才上線
5. 合併後確認 Vercel 正式部署成功（狀態 READY）且沒有 runtime error

常用指令：
- `npm run dev` 本機開發（需要 `.env` 的 `DATABASE_URL="file:./dev.db"`）
- `npm run typecheck` / `npm run build`
- `npm run test:e2e` 只跑自動測試（需先 build）。雲端開發環境請加 `PW_CHROMIUM_PATH=/opt/pw-browsers/chromium`
- 測試會用 `scripts/e2e-reset.mjs` 重建 `prisma/e2e.db`（示範資料），帳號：`admin@anvision.studio / anvision1234`、`pm@`／`designer@`／`finance@anvision.studio / demo1234`

## 資料安全（一定要遵守）
- **預覽部署不能碰正式資料庫**：`VERCEL_ENV=preview` 時只用 `PREVIEW_DATABASE_URL`，沒有就用示範資料。規則同時寫在 `src/lib/db.ts` 的 `databaseUrl()` 與 `scripts/vercel-build.mjs`，兩邊要一致
- 公司資料（CSV、Excel、銀行帳號、印章／Logo 圖檔、客戶名單）**不可提交到 git**；`.gitignore` 已排除 `*.db`、根目錄 `*.csv`。圖檔只存在資料庫設定（data URL）
- schema 只做「新增」類變更；刪欄位、改型別前要先跟使用者確認並規劃資料搬移（正式建置會執行 `prisma db push`）
- 不要在 commit、PR、程式碼中寫入模型名稱

## 程式慣例
- 權限：`requireUser(area)`（`src/lib/auth.ts` 的 `ACCESS`），專案／任務權限看 `src/lib/perm.ts`（`canManageProject`、`canUpdateTask`、簽核 `signActions`）
- 由 `ConfirmButton` 呼叫的 Server Action 要用 `guard()`（`src/lib/guard.ts`）包住，錯誤改成回傳 `{ error }`，否則正式環境只會顯示通用錯誤頁
- 有資料異動的動作要 `audit()` 留紀錄；任務狀態變更要 `recordSign()` 記錄誰簽核
- 清單頁的篩選用 `<FilterBar>`（`src/components/filters.tsx`）＋ `pick` / `dateRange` / `href`（`src/lib/filters.ts`）
- 狀態標籤用 `<Badge status=… />`，顏色定義在 `src/lib/format.ts` 的 `STATUS`；不要只靠顏色傳達資訊（一定有文字）
- 設計規範：`design-system/anvision-erp/MASTER.md`（色彩 token、字體、44px 觸控目標、WCAG AA、手機不可左右捲動）。顏色用 Tailwind token（`primary`、`ink`、`surface`、`danger`…），不要寫死色碼
- 報價單／請款單 PDF 版面（`src/components/sheet.tsx`）依公司範本以 pt 量測，修改要對照原範本

## 業務規則摘要
- 會計：自動過帳用角色科目（`ACC.*`，`src/lib/ledger.ts`），可在設定以 `acckey.*` 對應；Excel 匯入後 `ledger.autopost` 預設關閉，避免重複入帳
- Excel 帳務同步是單向（Google Drive → ERP），每日 cron `/api/cron/sync`（同時同步 Notion 會議記錄）
- 客戶／供應商以「別名」比對專案名稱與傳票摘要自動歸戶（`src/lib/client-match.ts`、`vendor-ledger.ts`）；CSV 匯入的空白欄位不覆蓋原資料
- 職位清單存在設定 `hr.positions`（`src/lib/positions.ts`），外包職位標示「外包」
- 會議記錄：Notion API（`NOTION_TOKEN`＋設定 `notion.meetingDbs`）或 Notion 匯出 CSV；依名稱自動對應專案

## 錯誤與備份
- 伺服器端未處理的錯誤由 `src/instrumentation.ts` → `src/lib/errors.ts` 記錄到 `ErrorLog`，管理員在「系統狀態」（/settings/system）查看；設定 `ERROR_WEBHOOK_URL` 會同步通知聊天群組
- `/api/test-error` 只在 `E2E=1`（自動測試）時存在，用來驗證錯誤紀錄流程
- 完整備份：`/api/backup`（僅管理員，JSON，不含密碼雜湊）；新增資料表會自動包含在備份內

## 已知狀況
- Vercel 偶爾出現 `Resource provisioning timed out`（建置機器沒啟動，非程式問題）：重新部署即可
- 自動測試中按下有確認視窗的按鈕前要 `page.on("dialog", d => d.accept())`
