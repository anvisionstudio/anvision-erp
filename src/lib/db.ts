import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";

/**
 * 資料庫連線（Neon / Vercel Postgres 等整合會自動設定其中之一）。
 * Vercel 預覽部署（VERCEL_ENV=preview）一律不使用正式資料庫：
 * 有設定 PREVIEW_DATABASE_URL（例如 Neon 分支）就用它，否則使用示範資料。
 * 同樣的規則也寫在 scripts/vercel-build.mjs，兩邊要一致。
 */
export function databaseUrl() {
  const e = process.env;
  if (e.VERCEL_ENV === "preview") return e.PREVIEW_DATABASE_URL || "";
  return e.DATABASE_URL_UNPOOLED || e.POSTGRES_URL_NON_POOLING || e.DATABASE_URL || e.POSTGRES_PRISMA_URL || "";
}

/** 是否為 Vercel 預覽部署（測試網址） */
export const isPreview = process.env.VERCEL_ENV === "preview";

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
