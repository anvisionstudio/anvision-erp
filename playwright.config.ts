import { defineConfig, devices } from "@playwright/test";
import path from "node:path";

/**
 * 自動測試（瀏覽器端到端）。
 * 執行前需先 `npm run build`；測試會用全新的 SQLite 測試資料庫（prisma/e2e.db）啟動系統，不會碰正式資料。
 *   npm run test:e2e
 */
const PORT = 3210;
const db = `file:${path.resolve("prisma/e2e.db")}`;

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1, // 測試會修改同一個資料庫，依序執行
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    // 雲端開發環境已預先安裝瀏覽器；CI 會自行安裝
    launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {},
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } }],
  webServer: {
    command: `node scripts/e2e-reset.mjs && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/login`,
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      DATABASE_URL: db, SESSION_SECRET: "e2e-secret", NODE_ENV: "production", VERCEL_ENV: "",
      // 確保不會讀到正式資料庫的連線設定
      DATABASE_URL_UNPOOLED: "", POSTGRES_URL_NON_POOLING: "", POSTGRES_PRISMA_URL: "", PREVIEW_DATABASE_URL: "",
    },
  },
});
