import type { Tx } from "./db";

/** 產生流水號，例如 nextNumber(tx, "INV") → INV-2026-0001 */
export async function nextNumber(tx: Tx, prefix: string, date = new Date()) {
  const key = `${prefix}-${date.getFullYear()}`;
  const row = await tx.sequence.upsert({
    where: { key },
    create: { key, next: 2 },
    update: { next: { increment: 1 } },
  });
  const n = row.next - 1;
  return `${key}-${String(n).padStart(4, "0")}`;
}
