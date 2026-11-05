import { db } from "./db";

export const splitAliases = (s: string | null | undefined) =>
  (s ?? "").split(/[,，、\n]/).map((x) => x.trim()).filter(Boolean);

/**
 * 依供應商「別名」比對日記簿摘要，計算各供應商在帳上的成本 / 費用。
 * 一筆分錄只歸屬給一家供應商（以最長、最具體的別名優先）。
 */
export async function vendorLedger(vendorId?: string) {
  const vendors = await db.vendor.findMany({ select: { id: true, name: true, aliases: true } });
  const patterns = vendors
    .flatMap((v) => [v.name, ...splitAliases(v.aliases)].map((alias) => ({ alias, vendorId: v.id })))
    .filter((p) => p.alias.length >= 2)
    .sort((a, b) => b.alias.length - a.alias.length);
  const stats = new Map<string, { spend: number; prepaid: number; lines: number; last: Date | null; projects: Set<string> }>();
  for (const v of vendors) stats.set(v.id, { spend: 0, prepaid: 0, lines: 0, last: null, projects: new Set() });
  if (!patterns.length) return { stats, lines: [] };

  const lines = await db.journalLine.findMany({
    where: { memo: { not: null } },
    select: {
      id: true, memo: true, debit: true, credit: true, project: true,
      account: { select: { code: true, name: true, type: true } },
      entry: { select: { id: true, number: true, date: true } },
    },
  });
  const matched: (typeof lines[number] & { vendorId: string })[] = [];
  for (const l of lines) {
    const memo = l.memo!;
    const hit = patterns.find((p) => memo.includes(p.alias));
    if (!hit) continue;
    const s = stats.get(hit.vendorId)!;
    s.lines++;
    if (l.account.type === "EXPENSE") s.spend += l.debit - l.credit;
    if (l.account.type === "ASSET" && /預付/.test(l.account.name)) s.prepaid += l.debit - l.credit;
    if (!s.last || l.entry.date > s.last) s.last = l.entry.date;
    if (l.project && l.project !== "公司") s.projects.add(l.project);
    if (!vendorId || hit.vendorId === vendorId) matched.push({ ...l, vendorId: hit.vendorId });
  }
  matched.sort((a, b) => b.entry.date.getTime() - a.entry.date.getTime());
  return { stats, lines: matched };
}
