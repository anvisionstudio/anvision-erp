// Vercel 建置腳本：
// - 有設定 PostgreSQL（例如 Vercel 的 Neon 整合）→ 切換 Prisma 為 postgresql、建立資料表、初始化科目與管理員
// - 沒有設定 → 示範模式：建置時產生內建 SQLite 示範資料庫
import { execSync } from "node:child_process";
import fs from "node:fs";

const run = (cmd, env = {}) => execSync(cmd, { stdio: "inherit", env: { ...process.env, ...env } });
const e = process.env;
const pg = e.DATABASE_URL_UNPOOLED || e.POSTGRES_URL_NON_POOLING || e.DATABASE_URL || e.POSTGRES_PRISMA_URL || "";

if (/^postgres(ql)?:/.test(pg)) {
  console.log("▶ 使用 PostgreSQL 正式資料庫");
  const schema = fs.readFileSync("prisma/schema.prisma", "utf8").replace('provider = "sqlite"', 'provider = "postgresql"');
  fs.writeFileSync("prisma/schema.prisma", schema);
  run("npx prisma generate");
  run("npx prisma db push --skip-generate", { DATABASE_URL: pg });
  // 正式環境預設不建立示範資料；要示範資料請在 Vercel 設定 SEED_DEMO=true
  run("npx tsx prisma/seed.ts", { DATABASE_URL: pg, SEED_DEMO: e.SEED_DEMO ?? "false" });
} else {
  console.log("▶ 未設定資料庫，使用示範模式（SQLite）");
  const file = `file:${process.cwd()}/prisma/demo.db`;
  run("npx prisma generate");
  run("npx prisma db push --skip-generate", { DATABASE_URL: file });
  run("npx tsx prisma/seed.ts", { DATABASE_URL: file });
}
run("npx next build");
