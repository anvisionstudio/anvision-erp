import Link from "next/link";
import { NotebookPen, Plus } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { date } from "@/lib/format";
import { notionConfigured, getNotionDbs } from "@/lib/notion";
import { saveNotionDbs } from "@/app/actions/meetings";
import { PageHeader, Card, Badge, Empty, Field, Tabs } from "@/components/ui";
import { SubmitButton } from "@/components/client";
import { MeetingCsvForm, NotionSyncButton } from "./import";
import { FilterBar } from "@/components/filters";
import { dateRange } from "@/lib/filters";

const PAGE = 50;

export default async function Meetings({ searchParams }: { searchParams: Promise<{ kind?: string; q?: string; project?: string; page?: string; from?: string; to?: string; src?: string }> }) {
  const user = await requireUser("projects");
  const sp = await searchParams;
  const kind = sp.kind === "NOTE" || sp.kind === "MEETING" ? sp.kind : undefined;
  const page = Math.max(1, Number(sp.page) || 1);
  const where: Prisma.MeetingWhereInput = {
    ...(kind ? { kind } : {}),
    ...(sp.project ? { projectId: sp.project } : {}),
    ...(dateRange(sp.from, sp.to) ? { date: dateRange(sp.from, sp.to) } : {}),
    ...(sp.src === "unmatched" ? { projectId: null } : sp.src ? { source: sp.src } : {}),
    ...(sp.q ? { OR: ["title", "summary", "decisions", "actions", "content", "projectLabel"].map((k) => ({ [k]: { contains: sp.q } })) } : {}),
  };
  const [list, total, project, dbs, projects] = await Promise.all([
    db.meeting.findMany({ where, orderBy: { date: "desc" }, skip: (page - 1) * PAGE, take: PAGE, include: { project: { select: { id: true, name: true } } } }),
    db.meeting.count({ where }),
    sp.project ? db.project.findUnique({ where: { id: sp.project }, select: { name: true } }) : null,
    getNotionDbs(),
    db.project.findMany({ where: { meetings: { some: {} } }, orderBy: { createdAt: "desc" }, select: { id: true, name: true } }),
  ]);
  const admin = ["ADMIN", "MANAGER"].includes(user.role);
  const q = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams(Object.entries({ kind, q: sp.q, project: sp.project, from: sp.from, to: sp.to, src: sp.src, ...patch }).filter(([, v]) => v) as [string, string][]);
    return `/meetings${p.size ? `?${p}` : ""}`;
  };
  const pages = Math.ceil(total / PAGE);

  return (
    <>
      <PageHeader title="會議記錄" sub={`${total} 筆${project ? `・專案：${project.name}` : ""}`}
        actions={<>
          <Link href={`/meetings/new?kind=NOTE${sp.project ? `&project=${sp.project}` : ""}`} className="btn-secondary"><NotebookPen className="h-4 w-4" aria-hidden />快速做筆記</Link>
          <Link href={`/meetings/new${sp.project ? `?project=${sp.project}` : ""}`} className="btn-primary"><Plus className="h-4 w-4" aria-hidden />新增會議記錄</Link>
        </>} />
      <Tabs active={kind ?? "all"} tabs={[{ key: "all", label: "全部", href: q({ kind: undefined, page: undefined }) }, { key: "MEETING", label: "會議", href: q({ kind: "MEETING", page: undefined }) }, { key: "NOTE", label: "筆記", href: q({ kind: "NOTE", page: undefined }) }]} />
      <FilterBar path="/meetings" values={{ q: sp.q, project: sp.project, from: sp.from, to: sp.to, src: sp.src }} keep={{ kind }} fields={[
        { type: "search", name: "q", label: "搜尋", placeholder: "主題、決策、行動項目…" },
        { type: "select", name: "project", label: "專案", options: projects.map((p) => ({ value: p.id, label: p.name })) },
        { type: "select", name: "src", label: "來源", options: [{ value: "NOTION", label: "Notion 同步" }, { value: "CSV", label: "CSV 匯入" }, { value: "MANUAL", label: "手動建立" }, { value: "unmatched", label: "未對應專案" }] },
        { type: "date", name: "from", label: "日期（起）" },
        { type: "date", name: "to", label: "日期（迄）" },
      ]} />

      <Card pad={false} className="mb-6">
        {list.length === 0 ? <Empty>{total === 0 && !sp.q ? "還沒有會議記錄，可新增或從 Notion 同步" : "沒有符合的會議記錄"}</Empty> : (
          <table className="tbl">
            <thead><tr><th className="min-w-[12rem]">討論主題</th><th className="min-w-[9rem]">專案</th><th>會議時間</th><th className="min-w-[16rem]">決策</th><th className="min-w-[16rem]">未來行動項目</th></tr></thead>
            <tbody>{list.map((m) => (
              <tr key={m.id} className="align-top">
                <td>
                  <Link className="link font-medium" href={`/meetings/${m.id}`}>{m.title}</Link>
                  <div className="mt-1 flex flex-wrap gap-1">{m.kind === "NOTE" && <Badge label="筆記" tone="amber" />}{m.source === "NOTION" && <Badge label="Notion" />}</div>
                </td>
                <td className="text-xs">{m.project ? <Link className="link" href={q({ project: m.project.id, page: undefined })}>{m.project.name}</Link> : <span className="text-ink-muted">{m.projectLabel ?? "—"}</span>}</td>
                <td className="whitespace-nowrap text-xs">{date(m.date)}</td>
                <td className="text-xs"><div className="line-clamp-4 whitespace-pre-line">{m.decisions ?? m.summary ?? ""}</div></td>
                <td className="text-xs"><div className="line-clamp-4 whitespace-pre-line">{m.actions ?? ""}</div></td>
              </tr>
            ))}</tbody>
          </table>
        )}
        {pages > 1 && (
          <nav aria-label="分頁" className="flex items-center justify-between border-t border-line px-4 py-2 text-sm">
            {page > 1 ? <Link className="link" href={q({ page: String(page - 1) })}>上一頁</Link> : <span />}
            <span className="text-ink-muted">第 {page} / {pages} 頁</span>
            {page < pages ? <Link className="link" href={q({ page: String(page + 1) })}>下一頁</Link> : <span />}
          </nav>
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {admin && (
          <Card title="從 Notion 同步">
            {!notionConfigured() ? (
              <div className="space-y-2 text-sm text-ink-muted">
                <p>尚未設定 Notion 連線。設定步驟：</p>
                <ol className="list-decimal space-y-1 pl-5">
                  <li>到 <a className="link" href="https://www.notion.so/profile/integrations" target="_blank" rel="noreferrer">Notion 整合頁面</a> 建立「內部整合」，複製密鑰（ntn_ 開頭）。</li>
                  <li>在 Vercel 專案 → Settings → Environment Variables 新增 <code className="font-mono">NOTION_TOKEN</code>，然後重新部署。</li>
                  <li>在 Notion 會議記錄資料庫右上「⋯ → 連結」加入該整合，再把資料庫網址貼到下方。</li>
                </ol>
              </div>
            ) : <p className="mb-3 text-sm text-ink-muted">Notion 已連線。每天會自動同步一次，也可手動同步。</p>}
            <form action={saveNotionDbs} className="mt-3 space-y-3">
              <Field label="Notion 資料庫網址" help="一行一個；欄位會依名稱自動對應（討論主題 / 會議名稱、專案總管、會議時間 / 日期、決策、未來行動項目、摘要），頁面內文會一併帶入。">
                <textarea name="dbs" rows={3} defaultValue={dbs.join("\n")} className="input font-mono text-xs" placeholder="https://www.notion.so/…" />
              </Field>
              <SubmitButton className="btn-secondary">儲存</SubmitButton>
            </form>
            {notionConfigured() && dbs.length > 0 && <div className="mt-4 border-t border-line pt-4"><NotionSyncButton /></div>}
          </Card>
        )}
        <Card title="匯入 Notion 匯出的 CSV">
          <p className="mb-3 text-sm text-ink-muted">在 Notion 資料庫右上「⋯ → 匯出 → Markdown &amp; CSV」，解壓後上傳其中的 CSV。同標題同一天的會議會更新而不重複建立；專案依名稱自動對應。</p>
          <MeetingCsvForm />
        </Card>
      </div>
    </>
  );
}
