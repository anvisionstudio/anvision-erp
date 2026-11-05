import { db } from "./db";

/** 公司資料（顯示於報價單 / 請款單） */
export const COMPANY_FIELDS = [
  ["company.name", "公司名稱"],
  ["company.city", "地址第一行（縣市）"],
  ["company.address", "地址第二行"],
  ["company.phone", "TEL"],
  ["company.mobile", "Mobile"],
  ["company.email", "Mail"],
  ["company.web", "Web"],
  ["company.taxId", "統一編號"],
  ["company.payee", "收款人"],
  ["company.bankName", "銀行（含分行與代碼）"],
  ["company.bankAccount", "銀行帳號"],
  ["company.bank", "其他匯款說明（選填）"],
] as const;

/** 單據設定 */
export const DOC_FIELDS = [
  ["doc.quoteLabel", "報價單標題文字"],
  ["doc.invoiceLabel", "請款單標題文字"],
  ["doc.validDays", "報價有效天數"],
  ["doc.quoteTerms", "報價單預設備註（每行一條）"],
  ["doc.signLeft", "左側簽章欄文字"],
  ["doc.signRight", "右側簽章欄文字"],
] as const;

export const DOC_DEFAULTS: Record<string, string> = {
  "doc.quoteLabel": "報價單",
  "doc.invoiceLabel": "請款單",
  "doc.validDays": "10",
  "doc.quoteTerms": [
    "1. 本報價單經由客戶雙方確認簽章後，即為有效訂單。",
    "2. 文案、圖案由客戶提供，如須撰寫；攝影費用另計。",
    "3. 乙方應配合甲方意見為必要之修改，如作業中有大幅修正或追加稿件製作時，交件日期得由雙方另行議定，並另行追加預算。",
    "4. 打樣費用，設計方先行支付，客戶憑發票實支實付。",
    "5. 付款方式：確認報價支付訂金30%，後續根據合約付款方式支付款項。",
  ].join("\n"),
  "doc.signLeft": "甲方-承製公司經辦人簽章",
  "doc.signRight": "乙方-承製公司經辦人簽章",
};

/** 單據圖片（以 data URL 存在設定中，不放進程式碼） */
export const IMAGE_KEYS = [
  ["company.logo", "左上角標誌（Logo 文字）"],
  ["company.mark", "右上角圖形標誌"],
  ["company.stamp", "公司大小章 / 發票章（顯示於付款資訊旁）"],
] as const;

export async function getCompany() {
  const rows = await db.setting.findMany({ where: { OR: [{ key: { startsWith: "company." } }, { key: { startsWith: "doc." } }] } });
  const m = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  const g = (k: string) => m[k] ?? DOC_DEFAULTS[k] ?? "";
  return {
    name: m["company.name"] || "Anvision Studio",
    city: g("company.city"), address: g("company.address"), phone: g("company.phone"), mobile: g("company.mobile"),
    email: g("company.email"), web: g("company.web"), taxId: g("company.taxId"),
    payee: g("company.payee"), bankName: g("company.bankName"), bankAccount: g("company.bankAccount"), bank: g("company.bank"),
    logo: g("company.logo"), mark: g("company.mark"), stamp: g("company.stamp"),
    quoteLabel: g("doc.quoteLabel"), invoiceLabel: g("doc.invoiceLabel"), validDays: Number(g("doc.validDays")) || 10,
    quoteTerms: g("doc.quoteTerms"), signLeft: g("doc.signLeft"), signRight: g("doc.signRight"),
  };
}
export type Company = Awaited<ReturnType<typeof getCompany>>;
