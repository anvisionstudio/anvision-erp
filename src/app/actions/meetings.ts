"use server";
import { guard } from "@/lib/guard";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db, isDemo } from "@/lib/db";
import { requireUser, audit } from "@/lib/auth";
import { str, req } from "@/lib/form";
import { parseCsv } from "@/lib/csv";
import { fieldOf, parseDate, cleanLabel, matchProject, projectsForMatch, NOTION_DBS_KEY } from "@/lib/meetings";
import { syncNotionMeetings } from "@/lib/notion";

const refresh = (projectId?: string | null) => {
  revalidatePath("/meetings");
  revalidatePath("/");
  if (projectId) revalidatePath(`/projects/${projectId}`);
};

export async function saveMeeting(f: FormData) {
  const u = await requireUser("projects");
  const id = str(f, "id");
  const data = {
    kind: str(f, "kind") === "NOTE" ? "NOTE" : "MEETING",
    title: req(f, "title"),
    date: parseDate(str(f, "date")) ?? new Date(),
    projectId: str(f, "projectId"),
    attendees: str(f, "attendees"), tags: str(f, "tags"), summary: str(f, "summary"),
    decisions: str(f, "decisions"), actions: str(f, "actions"), content: str(f, "content"),
  };
  const m = id
    ? await db.meeting.update({ where: { id }, data })
    : await db.meeting.create({ data: { ...data, createdById: u.id } });
  await audit(u.id, id ? "更新" : "新增", data.kind === "NOTE" ? "筆記" : "會議記錄", m.id, m.title);
  refresh(m.projectId);
  redirect(`/meetings/${m.id}`);
}

export async function deleteMeeting(id: string) {
  return guard(async () => {
    const u = await requireUser("projects");
    const m = await db.meeting.delete({ where: { id } });
    await audit(u.id, "刪除", "會議記錄", id, m.title);
    refresh(m.projectId);
    redirect("/meetings");
  });
}

export type MeetingImportState = { ok?: string; error?: string } | null;

/** 匯入 Notion「匯出 → Markdown & CSV」產生的 CSV（欄位：討論主題、專案總管、會議時間、決策、未來行動項目…） */
export async function importMeetingsCsv(_: MeetingImportState, f: FormData): Promise<MeetingImportState> {
  try {
    const u = await requireUser("projects");
    const file = f.get("file");
    if (!(file instanceof File) || !file.size) return { error: "請選擇 CSV 檔案" };
    const rows = parseCsv(await file.text());
    if (rows.length < 2) return { error: "CSV 沒有資料列" };
    const cols = rows[0].map((h) => fieldOf(h.trim()));
    if (!cols.includes("title")) return { error: "找不到標題欄位（討論主題 / 會議名稱 / Name）" };
    const projects = await projectsForMatch();
    let created = 0, updated = 0, matched = 0;
    for (const r of rows.slice(1)) {
      const v: Record<string, string> = {};
      cols.forEach((k, i) => { if (k && r[i]?.trim() && !v[k]) v[k] = r[i].trim(); });
      if (!v.title) continue;
      const projectLabel = cleanLabel(v.project);
      const projectId = matchProject(projectLabel, projects);
      if (projectId) matched++;
      const date = parseDate(v.date) ?? new Date();
      const data = {
        title: v.title, date, projectLabel, projectId,
        attendees: v.attendees ?? null, tags: v.tags ?? null, summary: v.summary ?? null,
        decisions: v.decisions ?? null, actions: v.actions ?? null, content: v.content ?? null, source: "CSV",
      };
      // 同標題、同一天視為同一筆（重複匯入不會重複建立）
      const day = new Date(date); day.setHours(0, 0, 0, 0);
      const exists = await db.meeting.findFirst({ where: { title: v.title, date: { gte: day, lt: new Date(day.getTime() + 864e5) } } });
      if (exists) { await db.meeting.update({ where: { id: exists.id }, data: { ...data, projectId: projectId ?? exists.projectId } }); updated++; }
      else { await db.meeting.create({ data: { ...data, createdById: u.id } }); created++; }
    }
    await audit(u.id, "CSV 匯入", "會議記錄", undefined, `新增 ${created}・更新 ${updated}`);
    refresh();
    return { ok: `匯入完成：新增 ${created} 筆、更新 ${updated} 筆，其中 ${matched} 筆已對應到專案` };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function saveNotionDbs(f: FormData) {
  const u = await requireUser("projects");
  if (!["ADMIN", "MANAGER"].includes(u.role)) throw new Error("只有管理員或經理可以設定 Notion 同步");
  const v = (str(f, "dbs") ?? "").split(/\s+/).filter(Boolean).join("\n");
  await db.setting.upsert({ where: { key: NOTION_DBS_KEY }, create: { key: NOTION_DBS_KEY, value: v }, update: { value: v } });
  await audit(u.id, "設定", "Notion 同步", undefined, v);
  revalidatePath("/meetings");
}

export async function runNotionSync(_: MeetingImportState, f: FormData): Promise<MeetingImportState> {
  try {
    const u = await requireUser("projects");
    if (!["ADMIN", "MANAGER"].includes(u.role)) return { error: "只有管理員或經理可以執行同步" };
    if (isDemo) return { error: "示範模式無法連線 Notion" };
    const r = await syncNotionMeetings(f.get("full") === "1");
    await audit(u.id, "Notion 同步", "會議記錄", undefined, `新增 ${r.created}・更新 ${r.updated}・未變更 ${r.skipped}`);
    refresh();
    return { ok: `同步完成：新增 ${r.created} 筆、更新 ${r.updated} 筆、未變更 ${r.skipped} 筆（${r.matched} 筆對應到專案）` };
  } catch (e) {
    return { error: (e as Error).message };
  }
}
