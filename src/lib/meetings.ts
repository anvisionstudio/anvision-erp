import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

export const MEETING_KIND: Record<string, string> = { MEETING: "會議", NOTE: "筆記" };
export const NOTION_DBS_KEY = "notion.meetingDbs";

/** 把 Notion / CSV 的欄位名稱對應到會議記錄欄位（大小寫、空白不拘） */
const FIELD_NAMES: Record<string, string[]> = {
  title: ["討論主題", "會議名稱", "主題", "標題", "名稱", "name", "title"],
  date: ["會議時間", "會議日期", "日期", "時間", "date"],
  project: ["專案總管", "專案", "project", "所屬專案"],
  attendees: ["與會者", "參與者", "出席", "attendees"],
  tags: ["類別", "專案類別", "標籤", "tags"],
  summary: ["摘要", "summary"],
  decisions: ["決策", "決議", "decisions"],
  actions: ["未來行動項目", "行動項目", "待辦", "action items", "actions"],
  content: ["內容", "筆記", "內文", "notes", "content"],
};
const norm = (s: string) => s.replace(/[\s​]/g, "").replace(/^[^\p{L}\p{N}]+/u, "").toLowerCase();
export function fieldOf(name: string): string | undefined {
  const k = norm(name);
  return Object.keys(FIELD_NAMES).find((f) => FIELD_NAMES[f].some((n) => norm(n) === k));
}

/** 解析各種日期寫法：2026年7月22日、July 22, 2026、2026/07/22、ISO */
export function parseDate(s: string | null | undefined): Date | null {
  if (!s) return null;
  const t = s.trim();
  let m = t.match(/(\d{4})\s*[年/.-]\s*(\d{1,2})\s*[月/.-]\s*(\d{1,2})/);
  if (m) {
    const time = t.match(/(\d{1,2}):(\d{2})/);
    const pm = /下午|PM/i.test(t) && time && +time[1] < 12 ? 12 : 0;
    return new Date(+m[1], +m[2] - 1, +m[3], time ? +time[1] + pm : 0, time ? +time[2] : 0);
  }
  m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return new Date(+m[3], +m[1] - 1, +m[2]);
  const d = new Date(t.replace(/\s*→.*$/, ""));
  return isNaN(d.getTime()) ? null : d;
}

/** Notion 匯出的關聯欄位長這樣：「用力拍電影｜戀愛登山社 (https://www.notion.so/...)」→ 只取名稱 */
export const cleanLabel = (s: string | null | undefined) =>
  (s ?? "").split(/,\s*(?=\S)(?![^()]*\))/).map((x) => x.replace(/\s*\(https?:\/\/[^)]*\)/g, "").replace(/%20/g, " ").trim()).filter(Boolean).join("、") || null;

type P = { id: string; name: string; ref: string | null; code: string };
const key = (s: string) => s.normalize("NFKC").replace(/[\s|｜_\-－:：、,，()（）「」]/g, "").replace(/^\p{Extended_Pictographic}+/u, "").toLowerCase();

/** 依名稱把來源的專案標籤對應到系統專案：完全相同 > 互相包含 > 共同片段最長（≥4 字） */
export function matchProject(label: string | null, projects: P[]): string | null {
  if (!label) return null;
  const L = key(label);
  if (!L) return null;
  let best: { id: string; score: number } | null = null;
  for (const p of projects) {
    const names = [p.name, p.ref, p.code].filter(Boolean).map((x) => key(x!));
    for (const n of names) {
      if (!n) continue;
      let score = 0;
      if (n === L) score = 1000;
      else if (n.includes(L) || L.includes(n)) score = 500 + Math.min(n.length, L.length);
      else {
        const parts = label.normalize("NFKC").split(/[|｜_\-－:：、,，\s]+/).map(key).filter((x) => x.length >= 4);
        const hit = parts.filter((x) => n.includes(x)).reduce((a, x) => Math.max(a, x.length), 0);
        if (hit >= 4) score = hit;
      }
      if (score && (!best || score > best.score)) best = { id: p.id, score };
    }
  }
  return best?.id ?? null;
}

export async function projectsForMatch(tx: Prisma.TransactionClient | typeof db = db) {
  return tx.project.findMany({ select: { id: true, name: true, ref: true, code: true }, orderBy: { createdAt: "desc" } });
}
