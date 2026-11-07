// 自動測試用：重建一個乾淨的 SQLite 測試資料庫並放入示範資料（不會碰正式資料庫）
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const file = path.resolve("prisma/e2e.db");
for (const f of [file, file + "-journal"]) fs.rmSync(f, { force: true });
const env = { ...process.env, DATABASE_URL: `file:${file}`, SEED_DEMO: "true", VERCEL_ENV: "" };
for (const k of ["DATABASE_URL_UNPOOLED", "POSTGRES_URL_NON_POOLING", "POSTGRES_PRISMA_URL"]) delete env[k];
execSync("npx prisma db push --skip-generate", { stdio: "inherit", env });
execSync("npx tsx prisma/seed.ts", { stdio: "inherit", env });
