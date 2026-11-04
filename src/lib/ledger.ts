import type { Tx } from "./db";
import { nextNumber } from "./seq";
import { totals } from "./format";

/**
 * 自動過帳使用的「科目角色」。實際科目代碼由設定 acckey.<角色> 決定
 * （匯入 Excel 會計項目表時會自動依名稱對應），未設定時使用系統預設代碼。
 */
export const ACC = {
  CASH: "CASH",
  BANK: "BANK",
  AR: "AR",
  INPUT_VAT: "INPUT_VAT",
  INVENTORY: "INVENTORY",
  AP: "AP",
  OUTPUT_VAT: "OUTPUT_VAT",
  WITHHOLDING: "WITHHOLDING",
  REVENUE: "REVENUE",
  SALARY: "SALARY",
  COST: "COST",
  MISC: "MISC",
} as const;
export type AccKey = keyof typeof ACC;

export const ACC_DEFAULT_CODE: Record<AccKey, string> = {
  CASH: "1101", BANK: "1102", AR: "1131", INPUT_VAT: "1141", INVENTORY: "1151", AP: "2101",
  OUTPUT_VAT: "2111", WITHHOLDING: "2131", REVENUE: "4101", SALARY: "6101", COST: "5102", MISC: "6109",
};

export const ACC_LABEL: Record<AccKey, string> = {
  CASH: "現金", BANK: "銀行存款（收付款）", AR: "應收帳款", INPUT_VAT: "進項稅額", INVENTORY: "存貨", AP: "應付帳款",
  OUTPUT_VAT: "銷項稅額", WITHHOLDING: "代扣款項", REVENUE: "營業收入", SALARY: "薪資支出", COST: "製作 / 外包成本", MISC: "雜項費用",
};

export const DEFAULT_ACCOUNTS: [string, string, string][] = [
  ["1101", "現金", "ASSET"],
  ["1102", "銀行存款", "ASSET"],
  ["1131", "應收帳款", "ASSET"],
  ["1141", "進項稅額", "ASSET"],
  ["1151", "存貨", "ASSET"],
  ["1161", "預付款項", "ASSET"],
  ["1401", "辦公設備", "ASSET"],
  ["2101", "應付帳款", "LIABILITY"],
  ["2111", "銷項稅額", "LIABILITY"],
  ["2121", "應付薪資", "LIABILITY"],
  ["2131", "代扣款項", "LIABILITY"],
  ["3101", "資本", "EQUITY"],
  ["3201", "保留盈餘", "EQUITY"],
  ["4101", "設計服務收入", "REVENUE"],
  ["4201", "其他收入", "REVENUE"],
  ["5101", "外包成本", "EXPENSE"],
  ["5102", "印刷製作成本", "EXPENSE"],
  ["6101", "薪資支出", "EXPENSE"],
  ["6102", "租金支出", "EXPENSE"],
  ["6103", "文具用品", "EXPENSE"],
  ["6104", "交通差旅", "EXPENSE"],
  ["6105", "水電通訊", "EXPENSE"],
  ["6106", "廣告行銷", "EXPENSE"],
  ["6107", "軟體訂閱", "EXPENSE"],
  ["6108", "保險費", "EXPENSE"],
  ["6109", "雜項費用", "EXPENSE"],
];

export const ACCOUNT_TYPE_LABEL: Record<string, string> = {
  ASSET: "資產",
  LIABILITY: "負債",
  EQUITY: "權益",
  REVENUE: "收入",
  EXPENSE: "費用",
};

type LineIn = { code?: string; accountId?: string; debit?: number; credit?: number; memo?: string };

/** 依「科目角色」（如 ACC.AR）或會計代碼取得科目 */
export async function resolveAccount(tx: Tx, keyOrCode: string) {
  if (keyOrCode in ACC_DEFAULT_CODE) {
    const key = keyOrCode as AccKey;
    const m = await tx.setting.findUnique({ where: { key: `acckey.${key}` } });
    return tx.account.findUnique({ where: { code: m?.value ?? ACC_DEFAULT_CODE[key] } });
  }
  return tx.account.findUnique({ where: { code: keyOrCode } });
}

async function accountId(tx: Tx, code: string) {
  const a = await resolveAccount(tx, code);
  if (!a) throw new Error(`找不到會計科目 ${code}，請先至「會計科目」建立或於匯入設定中對應`);
  return a.id;
}

/** 自動過帳開關：以 Excel 為帳務主檔時關閉，避免重複入帳 */
export async function autopostEnabled(tx: Tx) {
  const s = await tx.setting.findUnique({ where: { key: "ledger.autopost" } });
  return s?.value !== "false";
}

/** 建立傳票（借貸必須平衡） */
export async function createEntry(
  tx: Tx,
  e: { date: Date; memo: string; source?: string; sourceId?: string; lines: LineIn[] },
) {
  const lines = [];
  for (const l of e.lines) {
    const d = Math.round((l.debit ?? 0) * 100) / 100;
    const c = Math.round((l.credit ?? 0) * 100) / 100;
    if (d === 0 && c === 0) continue;
    lines.push({ accountId: l.accountId ?? (await accountId(tx, l.code!)), debit: d, credit: c, memo: l.memo });
  }
  const dr = lines.reduce((s, l) => s + l.debit, 0);
  const cr = lines.reduce((s, l) => s + l.credit, 0);
  if (Math.abs(dr - cr) > 0.005) throw new Error(`傳票借貸不平衡（借 ${dr} / 貸 ${cr}）`);
  if (lines.length === 0) return null;
  return tx.journalEntry.create({
    data: {
      number: await nextNumber(tx, "JE", e.date),
      date: e.date,
      memo: e.memo,
      source: e.source ?? "MANUAL",
      sourceId: e.sourceId,
      lines: { create: lines },
    },
  });
}

async function clear(tx: Tx, source: string, sourceId: string) {
  await tx.journalEntry.deleteMany({ where: { source, sourceId } });
}

/** 請款單開立 → 借 應收帳款 / 貸 收入、銷項稅額 */
export async function postInvoice(tx: Tx, invoiceId: string) {
  if (!(await autopostEnabled(tx))) return;
  await clear(tx, "INVOICE", invoiceId);
  const inv = await tx.invoice.findUniqueOrThrow({ where: { id: invoiceId }, include: { items: true, client: true } });
  if (inv.imported || inv.status === "DRAFT" || inv.status === "VOID") return;
  const t = totals(inv.items, inv.taxRate);
  await createEntry(tx, {
    date: inv.issueDate,
    memo: `請款 ${inv.number} ${inv.client.name}`,
    source: "INVOICE",
    sourceId: inv.id,
    lines: [
      { code: ACC.AR, debit: t.total },
      { code: ACC.REVENUE, credit: t.subtotal },
      { code: ACC.OUTPUT_VAT, credit: t.tax },
    ],
  });
}

/** 收款 → 借 銀行存款 / 貸 應收帳款 */
export async function postPayment(tx: Tx, paymentId: string) {
  if (!(await autopostEnabled(tx))) return;
  await clear(tx, "PAYMENT", paymentId);
  const p = await tx.payment.findUnique({ where: { id: paymentId }, include: { invoice: true } });
  if (!p || p.imported || p.invoice.imported) return;
  await createEntry(tx, {
    date: p.date,
    memo: `收款 ${p.invoice.number}`,
    source: "PAYMENT",
    sourceId: p.id,
    lines: [
      { code: p.method === "現金" ? ACC.CASH : ACC.BANK, debit: p.amount },
      { code: ACC.AR, credit: p.amount },
    ],
  });
}

export async function removePaymentEntry(tx: Tx, paymentId: string) {
  await clear(tx, "PAYMENT", paymentId);
}

/** 依收款金額更新請款單狀態 */
export async function refreshInvoiceStatus(tx: Tx, invoiceId: string) {
  const inv = await tx.invoice.findUniqueOrThrow({ where: { id: invoiceId }, include: { items: true, payments: true } });
  if (inv.status === "DRAFT" || inv.status === "VOID") return inv.status;
  const { total } = totals(inv.items, inv.taxRate);
  const paid = inv.payments.reduce((s, p) => s + p.amount, 0);
  const status = paid <= 0 ? "ISSUED" : paid + 0.5 >= total ? "PAID" : "PARTIAL";
  if (status !== inv.status) await tx.invoice.update({ where: { id: invoiceId }, data: { status } });
  return status;
}

/** 費用 / 帳單 → 借 費用、進項稅額 / 貸 應付帳款；付款 → 借 應付帳款 / 貸 銀行存款 */
export async function postExpense(tx: Tx, expenseId: string) {
  if (!(await autopostEnabled(tx))) return;
  await clear(tx, "EXPENSE", expenseId);
  await clear(tx, "EXPENSE_PAY", expenseId);
  const e = await tx.expense.findUnique({ where: { id: expenseId }, include: { vendor: true } });
  if (!e) return;
  const total = e.amount + e.tax;
  const memo = `${e.description}${e.vendor ? "／" + e.vendor.name : ""}`;
  await createEntry(tx, {
    date: e.date,
    memo: `費用 ${memo}`,
    source: "EXPENSE",
    sourceId: e.id,
    lines: [
      { accountId: e.accountId, debit: e.amount },
      { code: ACC.INPUT_VAT, debit: e.tax },
      { code: ACC.AP, credit: total },
    ],
  });
  if (e.status === "PAID") {
    await createEntry(tx, {
      date: e.paidDate ?? e.date,
      memo: `付款 ${memo}`,
      source: "EXPENSE_PAY",
      sourceId: e.id,
      lines: [
        { code: ACC.AP, debit: total },
        { code: ACC.BANK, credit: total },
      ],
    });
  }
}

export async function removeExpenseEntries(tx: Tx, expenseId: string) {
  await clear(tx, "EXPENSE", expenseId);
  await clear(tx, "EXPENSE_PAY", expenseId);
}

/** 薪資發放 → 借 薪資支出 / 貸 銀行存款、代扣款項 */
export async function postPayroll(tx: Tx, payrollId: string) {
  if (!(await autopostEnabled(tx))) return;
  await clear(tx, "PAYROLL", payrollId);
  const p = await tx.payroll.findUniqueOrThrow({ where: { id: payrollId }, include: { employee: true } });
  if (p.status !== "PAID") return;
  const gross = p.baseSalary + p.allowance;
  await createEntry(tx, {
    date: p.paidDate ?? new Date(),
    memo: `${p.period} 薪資 ${p.employee.name}`,
    source: "PAYROLL",
    sourceId: p.id,
    lines: [
      { code: ACC.SALARY, debit: gross },
      { code: ACC.BANK, credit: p.netPay },
      { code: ACC.WITHHOLDING, credit: p.deduction },
    ],
  });
}
