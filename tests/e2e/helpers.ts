import { expect, type Page } from "@playwright/test";

export const ADMIN = { email: "admin@anvision.studio", password: "anvision1234" };
export const PM = { email: "pm@anvision.studio", password: "demo1234" };
export const DESIGNER = { email: "designer@anvision.studio", password: "demo1234" };

export async function login(page: Page, who = ADMIN) {
  await page.goto("/login");
  await page.fill("input[name=email]", who.email);
  await page.fill("input[name=password]", who.password);
  await page.click("button[type=submit]");
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));
}

/** 頁面正常顯示：沒有錯誤畫面、有標題 */
export async function expectPageOk(page: Page) {
  await expect(page.locator("text=操作未完成")).toHaveCount(0);
  await expect(page.locator("main h1").first()).toBeVisible();
}
