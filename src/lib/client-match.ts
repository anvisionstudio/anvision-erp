import type { Tx } from "./db";
import { splitAliases } from "./vendor-ledger";

export const IMPORT_CLIENT = "Excel 匯入客戶（待整理）";

/**
 * 依客戶「別名」比對專案簡稱 / 名稱，把尚未指定客戶的專案（以及其匯入的請款單）歸給該客戶。
 * 以專案名稱中最先出現的別名為準（同位置時取較長者），例如「北高雄_拿多亞…」歸北高雄。
 * 已手動指定客戶的專案不會被改動。
 */
export async function assignClients(tx: Tx) {
  const clients = await tx.client.findMany({ select: { id: true, name: true, aliases: true } });
  const placeholder = clients.find((c) => c.name === IMPORT_CLIENT);
  const patterns = clients
    .filter((c) => c.id !== placeholder?.id)
    .flatMap((c) => [c.name, ...splitAliases(c.aliases)].map((alias) => ({ alias, id: c.id })))
    .filter((p) => p.alias.length >= 2);
  let projects = 0, invoices = 0;
  if (!patterns.length) return { projects, invoices };
  const list = await tx.project.findMany({
    where: { OR: [{ clientId: null }, ...(placeholder ? [{ clientId: placeholder.id }] : [])] },
    select: { id: true, name: true, ref: true },
  });
  for (const p of list) {
    const text = `${p.ref ?? ""} ${p.name}`;
    let best: { pos: number; len: number; id: string } | null = null;
    for (const pat of patterns) {
      const pos = text.indexOf(pat.alias);
      if (pos < 0) continue;
      if (!best || pos < best.pos || (pos === best.pos && pat.alias.length > best.len)) best = { pos, len: pat.alias.length, id: pat.id };
    }
    if (!best) continue;
    await tx.project.update({ where: { id: p.id }, data: { clientId: best.id } });
    projects++;
  }
  if (placeholder) {
    const invs = await tx.invoice.findMany({ where: { clientId: placeholder.id, project: { clientId: { not: null } } }, select: { id: true, project: { select: { clientId: true } } } });
    for (const i of invs) {
      if (i.project?.clientId && i.project.clientId !== placeholder.id) {
        await tx.invoice.update({ where: { id: i.id }, data: { clientId: i.project.clientId } });
        invoices++;
      }
    }
  }
  return { projects, invoices };
}
