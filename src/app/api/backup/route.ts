import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getUser, audit } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * 全部資料備份（JSON 下載）。僅限管理員。
 * 不含登入用的密碼雜湊與 Session（還原後請重設密碼）。
 */
export async function GET() {
  const user = await getUser();
  if (!user || user.role !== "ADMIN") return NextResponse.json({ error: "只有管理員可以下載備份" }, { status: 403 });
  const tables: Record<string, unknown[]> = {};
  for (const m of Prisma.dmmf.datamodel.models) {
    if (m.name === "Session") continue;
    const key = m.name.charAt(0).toLowerCase() + m.name.slice(1);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows: Record<string, unknown>[] = await (db as any)[key].findMany();
    tables[m.name] = m.name === "User" ? rows.map(({ passwordHash: _p, ...r }) => r) : rows;
  }
  const now = new Date();
  const stamp = now.toLocaleDateString("sv-SE", { timeZone: "Asia/Taipei" }).replace(/-/g, "");
  const counts = Object.fromEntries(Object.entries(tables).map(([k, v]) => [k, v.length]));
  await audit(user.id, "下載備份", "系統", undefined, `${Object.values(counts).reduce((a, b) => a + b, 0)} 筆資料`);
  const body = JSON.stringify({ app: "anvision-erp", version: 1, exportedAt: now.toISOString(), counts, tables }, null, 1);
  return new NextResponse(body, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="anvision-erp-backup-${stamp}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
