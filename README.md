# Anvision ERP

Anvision Studio 公司內部 ERP。專為小型設計/創意工作室設計：從**報價 → 專案 → 工時 → 請款 → 收款**一路串接，並**自動產生會計傳票**，財務報表即時可看。

## 功能模組

| 模組 | 內容 |
|---|---|
| 儀表板 | 本月營收/淨利、應收應付、逾期帳款、我的任務、進行中專案、待審假單、低庫存提醒 |
| 業務 | 客戶（統編、聯絡人）、報價單（可列印/PDF、成交一鍵轉專案、轉訂金 50% 或全額請款） |
| 專案 | 專案看板（待辦/進行中/審核/完成）、任務指派、工時登錄、週工時表、**專案損益**（已請款 − 費用 − 工時×時薪成本） |
| 會計財務 | 請款單（統一發票號碼、部分收款、作廢沖銷）、費用/應付帳款、手動傳票、會計科目 |
| 財務報表 | 損益表、資產負債表、試算表、應收帳齡、專案損益、營業稅（雙月 401 參考） |
| 採購庫存 | 供應商、採購單（下單 → 驗收入庫 → 自動產生應付帳款）、庫存（移動平均成本、領用、盤點、安全存量） |
| 人事 | 員工資料、請假申請/審核與特休統計、月薪資產生與發放 |
| 系統 | 公司資料（顯示於單據）、帳號與角色權限、操作紀錄 |

### 自動過帳規則

| 事件 | 借 | 貸 |
|---|---|---|
| 請款單開立 | 應收帳款 | 設計服務收入、銷項稅額 |
| 收款 | 銀行存款（或現金） | 應收帳款 |
| 費用/帳單登錄 | 費用科目、進項稅額 | 應付帳款 |
| 費用付款 | 應付帳款 | 銀行存款 |
| 採購驗收 | 存貨（庫存品）/ 印刷製作成本、進項稅額 | 應付帳款 |
| 庫存領用 | 印刷製作成本 | 存貨 |
| 薪資發放 | 薪資支出 | 銀行存款、代扣款項 |

修改或作廢原始單據時，相關傳票會自動重算；自動傳票無法手動刪除，以確保帳務一致。

### 角色權限

- **管理員**：全部
- **會計**：業務、財務、報表、採購、人事薪資
- **專案經理**：業務、專案、採購庫存、審核請假（看不到財務與薪資）
- **一般成員**：專案任務、工時、請假、庫存領用

## 技術架構

Next.js 15（App Router、Server Actions）· React 19 · Prisma 6 · Tailwind CSS 3 · SQLite（開發）/ PostgreSQL（正式）

```
prisma/schema.prisma     資料模型
prisma/seed.ts           會計科目、管理員、示範資料
src/lib/ledger.ts        會計科目與自動過帳邏輯
src/lib/reports.ts       財務報表計算
src/lib/auth.ts          登入、Session、角色權限
src/app/actions/*.ts     各模組的 Server Actions（寫入）
src/app/(app)/**         各頁面
```

## 本機啟動

```bash
npm install
cp .env.example .env
npm run setup        # 建立資料庫 + 會計科目 + 管理員 + 示範資料
npm run dev          # http://localhost:3000
```

預設管理員：`admin@anvision.studio` / `anvision1234`（首次登入後請至「我的帳號」變更密碼）。
可用環境變數 `ADMIN_EMAIL`、`ADMIN_PASSWORD` 指定；`SEED_DEMO=false` 則不建立示範資料。

示範帳號（密碼皆為 `demo1234`）：`pm@`（專案經理）、`finance@`（會計）、`designer@`（一般成員）`anvision.studio`。

## 正式部署（例如 Vercel + Neon / Supabase PostgreSQL）

1. `prisma/schema.prisma` 中 `provider = "sqlite"` 改為 `"postgresql"`
2. 設定環境變數 `DATABASE_URL`
3. 執行 `npx prisma db push` 與 `SEED_DEMO=false ADMIN_EMAIL=... ADMIN_PASSWORD=... npm run db:seed`
4. 部署（build 指令 `npm run build`）

## 待擴充

- 電子發票（財政部 API / 加值中心）串接
- 銀行對帳匯入（CSV）
- 單據附件上傳（收據照片、合約）
- Excel 匯出
- 勞健保級距表自動計算
