import { test, expect } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { login } from "./helpers";

test("快速做筆記，待辦以勾選框顯示", async ({ page }) => {
  await login(page);
  await page.goto("/");
  await page.getByRole("link", { name: /^做筆記/ }).click();
  await page.fill("input[name=title]", "自動測試筆記");
  await page.fill("textarea[name=actions]", "[ ] 待辦一\n[x] 完成二");
  await page.click('button:has-text("儲存")');
  await page.waitForURL(/\/meetings\/c/);
  await expect(page.getByLabel("未完成")).toHaveCount(1);
  await expect(page.getByLabel("已完成")).toHaveCount(1);
});

test("匯入 Notion 匯出的會議記錄 CSV，並自動對應專案", async ({ page }) => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "mtg-")), "meetings.csv");
  fs.writeFileSync(file, "﻿討論主題,專案總管,會議時間,決策,未來行動項目\n" +
    "提案會議,晨光咖啡 品牌識別重塑 (https://www.notion.so/abc),2026年7月22日,採用 B 案,\"整理提案\n7/30 回覆客戶\"\n");
  await login(page);
  await page.goto("/meetings", { waitUntil: "networkidle" });
  await page.setInputFiles("input[type=file][name=file]", file);
  await page.click('button:has-text("匯入 CSV")');
  await expect(page.locator("form:has(input[name=file]) [role=status]")).toContainText("1 筆已對應到專案");
  await page.reload();
  const row = page.locator("tr", { hasText: "提案會議" });
  await expect(row).toContainText("晨光咖啡 品牌識別重塑");
  await expect(row).toContainText("採用 B 案");
});
