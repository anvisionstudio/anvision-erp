import { test, expect } from "@playwright/test";
import { login } from "./helpers";

test("篩選器：選擇後自動套用、網址乾淨、可清除", async ({ page }) => {
  await login(page);
  await page.goto("/quotes");
  await page.selectOption("#f-client", { label: "晨光咖啡股份有限公司" });
  await page.waitForURL(/client=/);
  expect(page.url()).not.toMatch(/q=&|from=&/);
  await expect(page.locator("tbody")).toContainText("晨光咖啡");
  await expect(page.locator("tbody")).not.toContainText("山嵐民宿");
  await page.click('a:has-text("清除")');
  await expect(page).not.toHaveURL(/client=/);
});

test("每個清單頁都有篩選列", async ({ page }) => {
  await login(page);
  for (const url of ["/clients", "/quotes", "/invoices", "/projects", "/expenses", "/purchases", "/inventory", "/accounting", "/tasks", "/tasks/team", "/vendors", "/hr/employees", "/hr/leave", "/meetings"]) {
    await page.goto(url);
    await expect(page.locator("form[role=search]"), url).toHaveCount(1);
  }
});

test("會計科目可停用 / 啟用，狀態以顏色標示", async ({ page }) => {
  await login(page);
  await page.goto("/accounting/accounts");
  const row = page.locator("tr", { has: page.locator('td:text-is("6103")') });
  await expect(row).toContainText("使用中");
  await row.locator('button:has-text("停用")').click();
  await expect(row).toContainText("已停用");
  await row.locator('button:has-text("啟用")').click();
  await expect(row).toContainText("使用中");
});

test("員工職位選單包含預設職位，外包會標示", async ({ page }) => {
  await login(page);
  await page.goto("/hr/employees?new=1");
  const opts = await page.locator("select[name=title] option").allInnerTexts();
  for (const p of ["動畫總監", "動畫師", "設計師", "設計助理", "外包設計師", "外包剪輯師", "社群行銷", "會計"]) expect(opts.join()).toContain(p);
  await page.fill("input[name=name]", "測試剪輯");
  await page.selectOption("select[name=title]", "外包剪輯師");
  await page.click('form:has(input[name=name]) button:has-text("儲存")');
  await page.goto("/hr/employees?type=CONTRACT");
  await expect(page.locator("tbody")).toContainText("測試剪輯");
  await expect(page.locator("tbody")).toContainText("外包");
});

test("儀表板：快速新增列、前往捷徑帶數量、進度數字在進度條內", async ({ page }) => {
  await login(page);
  await page.goto("/");
  for (const label of ["指派任務", "建立專案", "做筆記", "記錄會議"]) await expect(page.getByRole("link", { name: new RegExp(label) })).toBeVisible();
  const nav = page.getByRole("navigation", { name: "前往" });
  await expect(nav.getByRole("link", { name: /任務總表\s*\d+/ })).toBeVisible();
  const bar = page.getByRole("progressbar", { name: "晨光咖啡 品牌識別重塑 完成度" });
  await expect(bar).toHaveAttribute("aria-valuetext", /%$/);
  await expect(bar).toContainText("%");
  await page.goto("/projects");
  await expect(page.getByRole("progressbar").first()).toContainText("%");
});
