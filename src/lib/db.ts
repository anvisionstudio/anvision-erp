import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";

/** 正式資料庫連線（Neon / Vercel Postgres 等整合會自動設定其中之一） */
export function databaseUrl() {
  const e = process.env;
  return e.DATABASE_URL_UNPOOLED || e.POSTGRES_URL_NON_POOLING || e.DATABASE_URL || e.POSTGRES_PRISMA_URL || "";
}

/** 未設定任何資料庫時為示範模式（內建 SQLite，資料可能重置） */
export const isDemo = !databaseUrl();

function datasourceUrl() {
  const url = databaseUrl();
  if (url.startsWith("file:")) return undefined; // 本機開發：使用 .env 的 SQLite
  if (url) return url;
  const target = "/tmp/anvision-erp.db";
  if (!fs.existsSync(target)) fs.copyFileSync(path.join(process.cwd(), "prisma", "demo.db"), target);
  return `file:${target}`;
}

const g = globalThis as unknown as { prisma?: PrismaClient };
export const db = g.prisma ?? new PrismaClient({ datasourceUrl: datasourceUrl() });
if (process.env.NODE_ENV !== "production") g.prisma = db;

export type Tx = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends">;
