import { db } from "./db";
import { invoiceAmounts } from "./reports";

/** 各客戶：專案數、帳上營收（日記簿收入科目，依專案標籤）、未收金額、最近專案日期 */
export async function clientStats() {
  const [projects, accounts, invoices] = await Promise.all([
    db.project.findMany({ where: { clientId: { not: null } }, select: { clientId: true, ref: true, startDate: true, createdAt: true } }),
    db.account.findMany({ where: { type: "REVENUE" }, select: { id: true } }),
    db.invoice.findMany({ where: { status: { in: ["ISSUED", "PARTIAL"] } }, include: { items: true, payments: true } }),
  ]);
  const refs = projects.map((p) => p.ref).filter((r): r is string => !!r);
  const sums = refs.length
    ? await db.journalLine.groupBy({ by: ["project"], where: { project: { in: refs }, accountId: { in: accounts.map((a) => a.id) } }, _sum: { debit: true, credit: true } })
    : [];
  const revByRef = new Map(sums.map((s) => [s.project!, (s._sum.credit ?? 0) - (s._sum.debit ?? 0)]));
  const out = new Map<string, { projects: number; revenue: number; outstanding: number; last: Date | null }>();
  const get = (id: string) => out.get(id) ?? out.set(id, { projects: 0, revenue: 0, outstanding: 0, last: null }).get(id)!;
  for (const p of projects) {
    const s = get(p.clientId!);
    s.projects++;
    s.revenue += p.ref ? revByRef.get(p.ref) ?? 0 : 0;
    const d = p.startDate ?? p.createdAt;
    if (!s.last || d > s.last) s.last = d;
  }
  for (const i of invoices) get(i.clientId).outstanding += invoiceAmounts(i).balance;
  return out;
}
