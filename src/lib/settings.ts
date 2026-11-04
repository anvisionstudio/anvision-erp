import { db } from "./db";

export const COMPANY_FIELDS = [
  ["company.name", "公司名稱"],
  ["company.taxId", "統一編號"],
  ["company.address", "地址"],
  ["company.phone", "電話"],
  ["company.email", "Email"],
  ["company.bank", "匯款帳戶（顯示於請款單）"],
] as const;

export async function getCompany() {
  const rows = await db.setting.findMany({ where: { key: { startsWith: "company." } } });
  const m = Object.fromEntries(rows.map((r) => [r.key.replace("company.", ""), r.value]));
  return { name: m.name || "Anvision Studio", taxId: m.taxId ?? "", address: m.address ?? "", phone: m.phone ?? "", email: m.email ?? "", bank: m.bank ?? "" };
}
