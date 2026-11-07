import { test, expect } from "@playwright/test";
import { login } from "./helpers";

test("報價 → 成交建立專案 → 請款 → 收款", async ({ page }) => {
  page.on("dialog", (d) => d.accept());
  await login(page);
  await page.goto("/quotes/new");
  await page.selectOption("select[name=clientId]", { label: "山嵐民宿" });
  await page.fill("input[name=title]", "自動測試：網站設計");
  await page.fill('input[aria-label="項目 1 說明"]', "網站設計");
  await page.fill('input[aria-label="項目 1 單價"]', "100000");
  await page.click('button:has-text("儲存報價單")');
  await page.waitForURL(/\/quotes\/c/);
  await expect(page.locator("main")).toContainText("105,000"); // 含 5% 稅

  await page.click('button:has-text("成交並建立專案")');
  await page.waitForURL(/\/projects\/c/);
  await expect(page.locator("h1")).toContainText("自動測試：網站設計");

  await page.goBack();
  await page.reload();
  await page.click('button:has-text("開全額請款")');
  await page.waitForURL(/\/invoices\/c/);
  await page.click('button:has-text("開立請款")');
  await expect(page.locator("main")).toContainText("已開立");
  await page.fill("input[name=amount]", "50000");
  await page.click('button:has-text("登錄收款")');
  await expect(page.locator("main")).toContainText("部分收款");
});

test("有交易紀錄的客戶刪除時顯示原因，並可合併到其他客戶", async ({ page }) => {
  page.on("dialog", (d) => d.accept());
  await login(page);
  await page.goto("/clients?q=" + encodeURIComponent("綠野"));
  await page.click('table a:has-text("綠野科技有限公司")');
  await page.waitForURL(/\/clients\/c/);
  const src = page.url();

  await page.click('main button:has-text("刪除")');
  await expect(page.locator("main span[role=alert]")).toContainText("無法直接刪除");
  await expect(page.locator("text=操作未完成")).toHaveCount(0);

  await page.selectOption("select[name=targetId]", { label: "晨光咖啡股份有限公司" });
  await Promise.all([page.waitForURL((u) => u.toString() !== src), page.click('button:has-text("合併並刪除本客戶")')]);
  await expect(page.locator("h1")).toContainText("晨光咖啡股份有限公司");
  await expect(page.locator("input[name=aliases]")).toHaveValue(/綠野科技有限公司/);
});
