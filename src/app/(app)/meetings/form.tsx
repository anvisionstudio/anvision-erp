import { saveMeeting } from "@/app/actions/meetings";
import { Field, Select } from "@/components/ui";
import { SubmitButton } from "@/components/client";
import { isoDate } from "@/lib/format";

type M = {
  id?: string; kind?: string; title?: string; date?: Date; projectId?: string | null; attendees?: string | null; tags?: string | null;
  summary?: string | null; decisions?: string | null; actions?: string | null; content?: string | null;
};

/** 會議記錄 / 筆記表單（新增與編輯共用） */
export function MeetingForm({ m = {}, projects }: { m?: M; projects: { id: string; name: string }[] }) {
  const note = m.kind === "NOTE";
  return (
    <form action={saveMeeting} className="space-y-4">
      {m.id && <input type="hidden" name="id" value={m.id} />}
      <div className="grid gap-4 md:grid-cols-4">
        <Field label="類型"><Select name="kind" defaultValue={m.kind ?? "MEETING"} options={[{ value: "MEETING", label: "會議記錄" }, { value: "NOTE", label: "筆記" }]} /></Field>
        <Field label={note ? "標題 *" : "討論主題 *"} className="md:col-span-3"><input name="title" required defaultValue={m.title} className="input" /></Field>
        <Field label="日期"><input type="date" name="date" defaultValue={isoDate(m.date ?? new Date())} className="input" /></Field>
        <Field label="專案" className="md:col-span-2"><Select name="projectId" placeholder="（不指定）" defaultValue={m.projectId} options={projects.map((p) => ({ value: p.id, label: p.name }))} /></Field>
        <Field label="類別 / 標籤"><input name="tags" defaultValue={m.tags ?? ""} className="input" placeholder="客戶通話、回顧…" /></Field>
        <Field label="與會者" className="md:col-span-4"><input name="attendees" defaultValue={m.attendees ?? ""} className="input" placeholder="以「、」分隔" /></Field>
      </div>
      <Field label="摘要"><textarea name="summary" rows={2} defaultValue={m.summary ?? ""} className="input" /></Field>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="決策"><textarea name="decisions" rows={6} defaultValue={m.decisions ?? ""} className="input" /></Field>
        <Field label="未來行動項目" help="一行一項，可用「[ ] 」開頭當作待辦"><textarea name="actions" rows={6} defaultValue={m.actions ?? ""} className="input" /></Field>
      </div>
      <Field label={note ? "筆記內容" : "會議內容 / 筆記"}><textarea name="content" rows={10} defaultValue={m.content ?? ""} className="input font-sans" /></Field>
      <SubmitButton>儲存</SubmitButton>
    </form>
  );
}
