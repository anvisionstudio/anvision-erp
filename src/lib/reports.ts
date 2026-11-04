import { db } from "./db";
import { totals } from "./format";

/** 各科目在期間內的借貸合計與餘額（正常餘額方向） */
export async function accountBalances(from?: Date, to?: Date) {
  const accounts = await db.account.findMany({ orderBy: { code: "asc" } });
  const sums = await db.journalLine.groupBy({
    by: ["accountId"],
    _sum: { debit: true, credit: true },
    where: { entry: { date: { gte: from, lte: to } } },
  });
  const map = new Map(sums.map((s) => [s.accountId, s._sum]));
  return accounts.map((a) => {
    const s = map.get(a.id);
    const debit = s?.debit ?? 0;
    const credit = s?.credit ?? 0;
    const debitNormal = a.type === "ASSET" || a.type === "EXPENSE";
    return { ...a, debit, credit, balance: debitNormal ? debit - credit : credit - debit };
  });
}

export async function profitAndLoss(from: Date, to: Date) {
  const rows = await accountBalances(from, to);
  const revenue = rows.filter((r) => r.type === "REVENUE" && r.balance !== 0);
  const expense = rows.filter((r) => r.type === "EXPENSE" && r.balance !== 0);
  const totalRevenue = revenue.reduce((s, r) => s + r.balance, 0);
  const totalExpense = expense.reduce((s, r) => s + r.balance, 0);
  return { revenue, expense, totalRevenue, totalExpense, net: totalRevenue - totalExpense };
}

export async function balanceSheet(asOf: Date) {
  const rows = await accountBalances(undefined, asOf);
  const pick = (t: string) => rows.filter((r) => r.type === t && r.balance !== 0);
  const sum = (rs: { balance: number }[]) => rs.reduce((s, r) => s + r.balance, 0);
  const earnings =
    sum(rows.filter((r) => r.type === "REVENUE")) - sum(rows.filter((r) => r.type === "EXPENSE"));
  const assets = pick("ASSET"), liabilities = pick("LIABILITY"), equity = pick("EQUITY");
  return {
    assets, liabilities, equity, earnings,
    totalAssets: sum(assets),
    totalLiabilities: sum(liabilities),
    totalEquity: sum(equity) + earnings,
  };
}

export function invoiceAmounts(inv: { items: { quantity: number; unitPrice: number }[]; taxRate: number; payments: { amount: number }[] }) {
  const t = totals(inv.items, inv.taxRate);
  const paid = inv.payments.reduce((s, p) => s + p.amount, 0);
  return { ...t, paid, balance: Math.max(0, t.total - paid) };
}

/** 應收帳款帳齡 */
export async function arAging(today = new Date()) {
  const invs = await db.invoice.findMany({
    where: { status: { in: ["ISSUED", "PARTIAL"] } },
    include: { items: true, payments: true, client: true },
    orderBy: { issueDate: "asc" },
  });
  const buckets = { current: 0, d30: 0, d60: 0, d90: 0 };
  const rows = invs.map((inv) => {
    const a = invoiceAmounts(inv);
    const due = inv.dueDate ?? inv.issueDate;
    const overdue = Math.floor((today.getTime() - due.getTime()) / 864e5);
    const bucket = overdue <= 0 ? "current" : overdue <= 30 ? "d30" : overdue <= 60 ? "d60" : "d90";
    buckets[bucket] += a.balance;
    return { inv, ...a, overdue, bucket };
  });
  return { rows, buckets, total: rows.reduce((s, r) => s + r.balance, 0) };
}

/** 專案損益：已請款收入 vs 直接費用 + 人工成本（工時 × 時薪成本） */
export async function projectProfit(projectId?: string) {
  const projects = await db.project.findMany({
    where: projectId ? { id: projectId } : { status: { not: "CANCELLED" } },
    include: {
      client: true,
      invoices: { where: { status: { notIn: ["DRAFT", "VOID"] } }, include: { items: true, payments: true } },
      expenses: true,
      timeEntries: { include: { user: { include: { employee: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });
  // Excel 匯入的專案：收入 / 成本直接取自日記簿「專案」欄
  const refs = projects.map((p) => p.ref).filter((r): r is string => !!r);
  const ledger = new Map<string, { revenue: number; cost: number }>();
  if (refs.length) {
    const [sums, accounts] = await Promise.all([
      db.journalLine.groupBy({ by: ["project", "accountId"], where: { project: { in: refs } }, _sum: { debit: true, credit: true } }),
      db.account.findMany({ select: { id: true, type: true } }),
    ]);
    const type = new Map(accounts.map((a) => [a.id, a.type]));
    for (const s of sums) {
      const r = ledger.get(s.project!) ?? { revenue: 0, cost: 0 };
      const d = s._sum.debit ?? 0, c = s._sum.credit ?? 0;
      if (type.get(s.accountId) === "REVENUE") r.revenue += c - d;
      if (type.get(s.accountId) === "EXPENSE") r.cost += d - c;
      ledger.set(s.project!, r);
    }
  }
  return projects.map((p) => {
    const fromLedger = p.ref ? ledger.get(p.ref) ?? { revenue: 0, cost: 0 } : null;
    const invoiced = fromLedger ? fromLedger.revenue : p.invoices.reduce((s, i) => s + totals(i.items, i.taxRate).subtotal, 0);
    const expenses = fromLedger ? fromLedger.cost : p.expenses.reduce((s, e) => s + e.amount, 0);
    const hours = p.timeEntries.reduce((s, t) => s + t.hours, 0);
    const labor = p.timeEntries.reduce((s, t) => s + t.hours * (t.user.employee?.hourlyCost ?? 0), 0);
    const cost = expenses + labor;
    const profit = invoiced - cost;
    return {
      project: p, invoiced, expenses, hours, labor, cost, profit, fromLedger: !!fromLedger,
      margin: invoiced > 0 ? profit / invoiced : 0,
      billedPct: p.budget > 0 ? invoiced / p.budget : 0,
    };
  });
}
