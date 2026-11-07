import { test, expect } from "@playwright/test";
import { login, DESIGNER } from "./helpers";

test("密碼錯誤無法登入", async ({ page }) => {
  await page.goto("/login");
  await page.fill("input[name=email]", "admin@anvision.studio");
  await page.fill("input[name=password]", "wrong-password");
  await page.click("button[type=submit]");
  await expect(page).toHaveURL(/\/login/);
});

test("未登入會被導向登入頁", async ({ page }) => {
  await page.goto("/projects");
  await expect(page).toHaveURL(/\/login/);
});

test("一般員工看不到財務功能", async ({ page }) => {
  await login(page, DESIGNER);
  await expect(page.locator("aside nav")).not.toContainText("請款");
  await page.goto("/invoices");
  await expect(page).toHaveURL(/denied=/);
});
