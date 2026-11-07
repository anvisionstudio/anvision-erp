import { test, expect } from "@playwright/test";
import http from "node:http";
import { login, DESIGNER } from "./helpers";

test("系統錯誤會被記錄、通知，並在系統狀態與儀表板顯示", async ({ page, baseURL }) => {
  // 假的聊天群組 Webhook，接收錯誤通知
  const port = Number(new URL(baseURL!).port) + 1;
  const received: string[] = [];
  const hook = http.createServer((req, res) => { let b = ""; req.on("data", (c) => (b += c)); req.on("end", () => { received.push(b); res.end("ok"); }); });
  await new Promise<void>((r) => hook.listen(port, r));
  try {
    await login(page);
    const r = await page.request.get("/api/test-error");
    expect(r.status()).toBe(500);
    await expect.poll(() => received.length, { timeout: 10_000 }).toBeGreaterThan(0);
    const payload = JSON.parse(received[0]);
    expect(payload.text).toContain("自動測試用錯誤");
    expect(payload.content).toBe(payload.text);

    await page.goto("/");
    await expect(page.getByRole("link", { name: /過去 24 小時系統發生 \d+ 次錯誤/ })).toBeVisible();
    await page.goto("/settings/system");
    await expect(page.locator("main")).toContainText("自動測試用錯誤");
    await expect(page.locator("main")).toContainText("/api/test-error");
    await expect(page.locator("main")).toContainText("已開啟");
  } finally {
    hook.close();
  }
});

test("管理員可下載完整備份；一般員工不行", async ({ page, browser }) => {
  await login(page);
  await page.goto("/settings/system");
  const [dl] = await Promise.all([page.waitForEvent("download"), page.click('a:has-text("下載完整備份")')]);
  expect(dl.suggestedFilename()).toMatch(/^anvision-erp-backup-\d{8}\.json$/);
  const data = JSON.parse(await (await import("node:fs")).promises.readFile((await dl.path())!, "utf8"));
  expect(data.app).toBe("anvision-erp");
  expect(data.tables.Client.length).toBeGreaterThan(0);
  expect(data.tables.Project.length).toBeGreaterThan(0);
  expect(JSON.stringify(data.tables.User)).not.toContain("passwordHash");
  await page.reload();
  await expect(page.locator("main")).toContainText("今天");

  const ctx = await browser.newContext();
  const staff = await ctx.newPage();
  await login(staff, DESIGNER);
  const r = await staff.request.get("/api/backup");
  expect(r.status()).toBe(403);
  await ctx.close();
});
