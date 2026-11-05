import { db } from "@/lib/db";
import { fieldOf, matchProject, projectsForMatch, parseDate, NOTION_DBS_KEY } from "@/lib/meetings";

/**
 * Notion 會議記錄同步（單向：Notion → ERP）。
 * 需在 Vercel 設定環境變數 NOTION_TOKEN（Notion 內部整合的密鑰），並在 Notion 把資料庫「連結」給該整合。
 */
const API = "https://api.notion.com/v1";
export const notionConfigured = () => !!process.env.NOTION_TOKEN;

/** 從 Notion 網址或 ID 取出 32 位資料庫 ID */
export function notionId(s: string): string | null {
  const m = s.replace(/-/g, "").match(/([0-9a-f]{32})(?:\?|$|#)/i) ?? s.replace(/-/g, "").match(/([0-9a-f]{32})/i);
  return m ? m[1].toLowerCase() : null;
}

async function call<T = any>(path: string, body?: unknown, tries = 0): Promise<T> { // eslint-disable-line @typescript-eslint/no-explicit-any
  const res = await fetch(API + path, {
    method: body ? "POST" : "GET",
    headers: { Authorization: `Bearer ${process.env.NOTION_TOKEN}`, "Notion-Version": "2022-06-28", "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  if (res.status === 429 && tries < 5) {
    await new Promise((r) => setTimeout(r, (Number(res.headers.get("retry-after")) || 1) * 1000));
    return call(path, body, tries + 1);
  }
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    if (res.status === 404) throw new Error("找不到 Notion 資料庫：請確認網址正確，且已在 Notion 該資料庫的「⋯ → 連結」加入此整合");
    if (res.status === 401) throw new Error("NOTION_TOKEN 無效，請重新設定");
    throw new Error(`Notion API 錯誤 ${res.status}：${e.message ?? res.statusText}`);
  }
  return res.json();
}

type RT = { plain_text: string }[];
const rt = (x: RT | undefined) => (x ?? []).map((t) => t.plain_text).join("").trim();

const titleCache = new Map<string, string>();
async function pageTitle(id: string) {
  if (titleCache.has(id)) return titleCache.get(id)!;
  let t = "";
  try {
    const p = await call(`/pages/${id}`);
    const prop = Object.values(p.properties as Record<string, { type: string; title?: RT }>).find((v) => v.type === "title");
    t = rt(prop?.title);
  } catch { /* 沒有權限讀取關聯頁面時略過 */ }
  titleCache.set(id, t);
  return t;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function propText(v: any): Promise<string> {
  switch (v.type) {
    case "title": case "rich_text": return rt(v[v.type]);
    case "date": return v.date ? v.date.start : "";
    case "select": case "status": return v[v.type]?.name ?? "";
    case "multi_select": return v.multi_select.map((o: { name: string }) => o.name).join("、");
    case "people": return v.people.map((p: { name?: string }) => p.name ?? "").filter(Boolean).join("、");
    case "relation": return (await Promise.all(v.relation.slice(0, 5).map((r: { id: string }) => pageTitle(r.id)))).filter(Boolean).join("、");
    case "created_time": return v.created_time;
    case "formula": return String(v.formula?.[v.formula.type] ?? "");
    case "url": case "email": case "phone_number": return v[v.type] ?? "";
    case "number": return v.number == null ? "" : String(v.number);
    case "checkbox": return v.checkbox ? "✓" : "";
    default: return "";
  }
}

const PREFIX: Record<string, string> = { heading_1: "# ", heading_2: "## ", heading_3: "### ", bulleted_list_item: "• ", numbered_list_item: "• ", quote: "> ", callout: "" };
/** 讀取頁面內文（兩層），轉為純文字 */
async function pageBody(id: string, depth = 0): Promise<string> {
  const lines: string[] = [];
  let cursor: string | undefined;
  do {
    const r = await call(`/blocks/${id}/children?page_size=100${cursor ? `&start_cursor=${cursor}` : ""}`);
    for (const b of r.results) {
      const d = b[b.type];
      let text = d?.rich_text ? rt(d.rich_text) : "";
      if (b.type === "to_do") text = `${d.checked ? "☑" : "☐"} ${text}`;
      else if (b.type === "divider") text = "—";
      else if (b.type === "child_page" || b.type === "child_database") text = d.title ? `［${d.title}］` : "";
      else if (PREFIX[b.type] !== undefined) text = PREFIX[b.type] + text;
      if (text.trim()) lines.push("  ".repeat(depth) + text);
      if (b.has_children && depth < 1 && !["child_page", "child_database"].includes(b.type)) {
        const sub = await pageBody(b.id, depth + 1);
        if (sub) lines.push(sub);
      }
    }
    cursor = r.has_more ? r.next_cursor : undefined;
  } while (cursor && lines.length < 2000);
  return lines.join("\n");
}

export type NotionSyncResult = { created: number; updated: number; skipped: number; matched: number; databases: number };

export async function getNotionDbs() {
  const v = (await db.setting.findUnique({ where: { key: NOTION_DBS_KEY } }))?.value ?? "";
  return v.split(/\s+/).map((s) => s.trim()).filter(Boolean);
}

/** 同步所有已設定的 Notion 資料庫；only 有變更（last_edited_time 不同）的頁面才重抓內文 */
export async function syncNotionMeetings(full = false): Promise<NotionSyncResult> {
  if (!notionConfigured()) throw new Error("尚未設定 NOTION_TOKEN 環境變數");
  const dbs = await getNotionDbs();
  if (!dbs.length) throw new Error("尚未設定要同步的 Notion 資料庫");
  const projects = await projectsForMatch();
  const out: NotionSyncResult = { created: 0, updated: 0, skipped: 0, matched: 0, databases: dbs.length };
  titleCache.clear();
  for (const link of dbs) {
    const id = notionId(link);
    if (!id) throw new Error(`無法辨識的 Notion 網址：${link}`);
    let cursor: string | undefined;
    do {
      const r = await call(`/databases/${id}/query`, { page_size: 100, ...(cursor ? { start_cursor: cursor } : {}) });
      for (const page of r.results) {
        const edited = new Date(page.last_edited_time);
        const exists = await db.meeting.findUnique({ where: { notionId: page.id } });
        if (!full && exists?.notionEditedAt && exists.notionEditedAt.getTime() === edited.getTime()) { out.skipped++; continue; }
        const f: Record<string, string> = {};
        let titleProp = "";
        for (const [name, v] of Object.entries(page.properties as Record<string, { type: string }>)) {
          const text = await propText(v);
          if (v.type === "title") titleProp = text;
          const k = fieldOf(name);
          if (k && text && !f[k]) f[k] = text;
        }
        const body = await pageBody(page.id).catch(() => "");
        const projectLabel = f.project || null;
        const projectId = matchProject(projectLabel, projects);
        if (projectId) out.matched++;
        const data = {
          title: f.title || titleProp || "未命名會議",
          date: parseDate(f.date) ?? new Date(page.created_time),
          projectLabel, projectId: projectId ?? exists?.projectId ?? null,
          attendees: f.attendees || null, tags: f.tags || null, summary: f.summary || null,
          decisions: f.decisions || null, actions: f.actions || null,
          content: [f.content, body].filter(Boolean).join("\n\n") || null,
          notionUrl: page.url, notionEditedAt: edited, source: "NOTION",
        };
        if (exists) { await db.meeting.update({ where: { id: exists.id }, data }); out.updated++; }
        else { await db.meeting.create({ data: { ...data, notionId: page.id } }); out.created++; }
      }
      cursor = r.has_more ? r.next_cursor : undefined;
    } while (cursor);
  }
  return out;
}
