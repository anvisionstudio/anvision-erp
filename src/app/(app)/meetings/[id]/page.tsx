import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink, Pencil } from "lucide-react";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { date } from "@/lib/format";
import { MEETING_KIND } from "@/lib/meetings";
import { deleteMeeting } from "@/app/actions/meetings";
import { PageHeader, Card, Badge } from "@/components/ui";
import { ConfirmButton } from "@/components/client";
import { MeetingForm } from "../form";
import { RichText } from "../text";

export default async function MeetingPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ edit?: string }> }) {
  await requireUser("projects");
  const { id } = await params;
  const { edit } = await searchParams;
  const m = await db.meeting.findUnique({ where: { id }, include: { project: { select: { id: true, name: true } }, createdBy: { select: { name: true } } } });
  if (!m) notFound();
  if (edit) {
    const projects = await db.project.findMany({ orderBy: { createdAt: "desc" }, select: { id: true, name: true } });
    return (
      <>
        <PageHeader title={`編輯：${m.title}`} back={`/meetings/${m.id}`} />
        {m.source === "NOTION" && <p className="mb-4 rounded-md bg-accent-soft px-4 py-2 text-sm text-accent">此筆來自 Notion，下次同步若 Notion 有修改會覆蓋這裡的內容（專案對應會保留）。</p>}
        <Card><MeetingForm m={m} projects={projects} /></Card>
      </>
    );
  }
  const del = deleteMeeting.bind(null, m.id);
  return (
    <>
      <PageHeader title={m.title} back="/meetings"
        sub={<span className="flex flex-wrap items-center gap-2"><Badge label={MEETING_KIND[m.kind]} tone={m.kind === "NOTE" ? "amber" : "blue"} /><span>{date(m.date)}</span>
          {m.project ? <Link className="link" href={`/projects/${m.project.id}?tab=meetings`}>{m.project.name}</Link> : m.projectLabel && <span>{m.projectLabel}（未對應專案）</span>}
          {m.createdBy && <span>建立者 {m.createdBy.name}</span>}</span>}
        actions={<>
          {m.notionUrl && <a className="btn-secondary" href={m.notionUrl} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" aria-hidden />在 Notion 開啟</a>}
          <Link className="btn-secondary" href={`/meetings/${m.id}?edit=1`}><Pencil className="h-4 w-4" aria-hidden />編輯</Link>
          <ConfirmButton action={del} message="確定刪除這筆會議記錄？" className="btn-danger">刪除</ConfirmButton>
        </>} />
      {(m.attendees || m.tags) && (
        <dl className="mb-4 flex flex-wrap gap-x-6 gap-y-1 text-sm">
          {m.attendees && <div className="flex gap-2"><dt className="text-ink-muted">與會者</dt><dd>{m.attendees}</dd></div>}
          {m.tags && <div className="flex gap-2"><dt className="text-ink-muted">類別</dt><dd>{m.tags}</dd></div>}
        </dl>
      )}
      {m.summary && <Card title="摘要" className="mb-6"><RichText text={m.summary} /></Card>}
      {(m.decisions || m.actions) && (
        <div className="mb-6 grid gap-6 md:grid-cols-2">
          <Card title="決策">{m.decisions ? <RichText text={m.decisions} /> : <p className="text-sm text-ink-muted">—</p>}</Card>
          <Card title="未來行動項目">{m.actions ? <RichText text={m.actions} /> : <p className="text-sm text-ink-muted">—</p>}</Card>
        </div>
      )}
      {m.content && <Card title={m.kind === "NOTE" ? "筆記內容" : "會議內容"}><RichText text={m.content} /></Card>}
      {!m.summary && !m.decisions && !m.actions && !m.content && <Card><p className="text-sm text-ink-muted">尚無內容，<Link className="link" href={`/meetings/${m.id}?edit=1`}>點此編輯</Link>。</p></Card>}
    </>
  );
}
