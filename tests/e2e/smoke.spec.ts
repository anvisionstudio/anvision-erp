import { test, expect } from "@playwright/test";
import { login, expectPageOk } from "./helpers";

// 每個主要頁面都能正常打開（管理員權限）
const PAGES = [
  "/", "/clients", "/clients/new", "/quotes", "/quotes/new", "/projects", "/projects/new", "/timeline", "/tasks", "/tasks/team",
  "/meetings", "/meetings/new", "/time", "/invoices", "/invoices/new", "/expenses", "/accounting", "/accounting/accounts",
  "/accounting/new", "/reports", "/reports?tab=bs", "/reports?tab=tb", "/vendors", "/purchases", "/purchases/new", "/inventory",
  "/hr/employees", "/hr/leave", "/hr/payroll", "/settings", "/settings/import", "/settings/audit", "/account",
];

test("所有主要頁面都能正常開啟", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await login(page);
  for (const url of PAGES) {
    await test.step(url, async () => {
      const res = await page.goto(url);
      expect(res?.status(), url).toBeLessThan(400);
      await expectPageOk(page);
    });
  }
  expect(errors).toEqual([]);
});

test("手機寬度不會出現左右捲動", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);
  for (const url of ["/", "/projects", "/tasks/team", "/meetings", "/invoices", "/clients", "/hr/employees"]) {
    await page.goto(url);
    const w = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(w, url).toBeLessThanOrEqual(390);
  }
});

test("資產負債表與試算表平衡", async ({ page }) => {
  await login(page);
  await page.goto("/reports?tab=bs");
  await expect(page.locator("main")).toContainText("資產 = 負債 + 權益");
  await expect(page.locator("main")).not.toContainText("帳務不平衡");
  await page.goto("/reports?tab=tb&from=2026-01-01");
  await expect(page.locator("main")).toContainText("合計 平衡");
});
