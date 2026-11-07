import { test, expect } from "@playwright/test";
import { login, PM, DESIGNER } from "./helpers";

test("專案經理指派任務，負責人在儀表板勾選送審，經理看到簽核紀錄", async ({ page, browser }) => {
  await login(page, PM);
  await page.goto("/tasks/team#assign");
  await page.selectOption("#assign select[name=projectId]", { label: "晨光咖啡 品牌識別重塑" });
  await page.fill("#assign input[name=title]", "自動測試任務");
  await page.selectOption("#assign select[name=assigneeId]", { label: "王設計" });
  const today = new Date().toISOString().slice(0, 10);
  await page.fill("#assign input[name=dueDate]", today);
  await page.click('#assign button:has-text("建立並指派")');
  await page.waitForLoadState("networkidle");

  // 負責人：儀表板「本週任務」勾選 → 送審
  const ctx = await browser.newContext();
  const des = await ctx.newPage();
  await login(des, DESIGNER);
  await des.goto("/");
  const send = des.locator('button[aria-label="送審：自動測試任務"]');
  await expect(send).toBeVisible();
  await send.click();
  await expect(des.locator('li:has-text("自動測試任務")')).toContainText("審核中");
  await ctx.close();

  // 經理：在任務頁看到簽核紀錄
  await page.goto("/tasks/team");
  await page.click('a:has-text("自動測試任務")');
  await expect(page.locator("main")).toContainText("審核中");
  await expect(page.locator("main")).toContainText("王設計");
});

test("專案頁有會議記錄分頁", async ({ page }) => {
  await login(page);
  await page.goto("/projects");
  await page.click('a:has-text("晨光咖啡 品牌識別重塑")');
  await page.click('a:has-text("會議記錄")');
  await expect(page.locator("main")).toContainText("新增會議記錄");
});
