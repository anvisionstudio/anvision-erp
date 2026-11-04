import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";

/**
 * Vercel 示範模式：未設定 DATABASE_URL 時，把內建的示範資料庫複製到 /tmp 使用。
 * （伺服器重新啟動時資料會重置；正式使用請設定 PostgreSQL 的 DATABASE_URL）
 */
function datasourceUrl() {
  if (process.env.DATABASE_URL) return undefined;
  const target = "/tmp/anvision-erp.db";
  if (!fs.existsSync(target)) fs.copyFileSync(path.join(process.cwd(), "prisma", "demo.db"), target);
  return `file:${target}`;
}

const g = globalThis as unknown as { prisma?: PrismaClient };
export const db = g.prisma ?? new PrismaClient({ datasourceUrl: datasourceUrl() });
if (process.env.NODE_ENV !== "production") g.prisma = db;

export type Tx = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends">;
