import { saveProject } from "@/app/actions/projects";
import { Field, Select, statusOptions } from "@/components/ui";
import { SubmitButton } from "@/components/client";
import { isoDate } from "@/lib/format";
import type { Project, Client, User } from "@prisma/client";

export function ProjectForm({ p, clients, users }: { p?: Project; clients: Client[]; users: User[] }) {
  return (
    <form action={saveProject} className="grid gap-4 md:grid-cols-2">
      {p && <input type="hidden" name="id" value={p.id} />}
      <Field label="專案名稱 *" className="md:col-span-2"><input name="name" required defaultValue={p?.name} className="input" /></Field>
      <Field label="客戶"><Select name="clientId" placeholder="（內部專案）" defaultValue={p?.clientId} options={clients.map((c) => ({ value: c.id, label: c.name }))} /></Field>
      <Field label="專案負責人"><Select name="managerId" placeholder="未指定" defaultValue={p?.managerId} options={users.map((u) => ({ value: u.id, label: u.name }))} /></Field>
      <Field label="狀態"><Select name="status" defaultValue={p?.status ?? "ACTIVE"} options={statusOptions(["PLANNING", "ACTIVE", "ON_HOLD", "DONE", "CANCELLED"])} /></Field>
      <Field label="合約金額（未稅）"><input name="budget" type="number" step="1" defaultValue={p?.budget ?? 0} className="input" /></Field>
      <Field label="開始日"><input name="startDate" type="date" defaultValue={isoDate(p?.startDate)} className="input" /></Field>
      <Field label="交付日"><input name="dueDate" type="date" defaultValue={isoDate(p?.dueDate)} className="input" /></Field>
      <Field label="說明" className="md:col-span-2"><textarea name="description" rows={3} defaultValue={p?.description ?? ""} className="input" /></Field>
      <div className="md:col-span-2"><SubmitButton>儲存</SubmitButton></div>
    </form>
  );
}
