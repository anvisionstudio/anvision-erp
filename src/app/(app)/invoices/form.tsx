import { saveInvoice } from "@/app/actions/finance";
import { Field, Select } from "@/components/ui";
import { LineItems, SubmitButton } from "@/components/client";
import { isoDate } from "@/lib/format";
import type { Invoice, InvoiceItem, Client, Project } from "@prisma/client";

export function InvoiceForm({ inv, clients, projects, preset }: {
  inv?: Invoice & { items: InvoiceItem[] }; clients: Client[]; projects: Project[];
  preset?: { clientId?: string | null; projectId?: string | null; items?: { description: string; quantity: number; unitPrice: number }[] };
}) {
  return (
    <form action={saveInvoice} className="space-y-6">
      {inv && <input type="hidden" name="id" value={inv.id} />}
      {inv && inv.status !== "DRAFT" && <div className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">此請款單已開立，儲存後將自動重新過帳。</div>}
      <div className="grid gap-4 md:grid-cols-4">
        <Field label="客戶 *" className="md:col-span-2"><Select name="clientId" required placeholder="選擇客戶" defaultValue={inv?.clientId ?? preset?.clientId} options={clients.map((c) => ({ value: c.id, label: c.name }))} /></Field>
        <Field label="關聯專案" className="md:col-span-2"><Select name="projectId" placeholder="（無）" defaultValue={inv?.projectId ?? preset?.projectId} options={projects.map((p) => ({ value: p.id, label: `${p.code} ${p.name}` }))} /></Field>
        <Field label="開立日期"><input type="date" name="issueDate" defaultValue={isoDate(inv?.issueDate ?? new Date())} className="input" /></Field>
        <Field label="付款期限"><input type="date" name="dueDate" defaultValue={isoDate(inv?.dueDate ?? new Date(Date.now() + 30 * 864e5))} className="input" /></Field>
        <Field label="統一發票號碼" className="md:col-span-2"><input name="gui" defaultValue={inv?.gui ?? ""} placeholder="例如 AB-12345678" className="input" /></Field>
      </div>
      <LineItems initial={inv?.items ?? preset?.items} initialTaxRate={inv?.taxRate ?? 0.05} />
      <Field label="備註"><textarea name="notes" rows={3} defaultValue={inv?.notes ?? ""} className="input" /></Field>
      <SubmitButton>儲存請款單</SubmitButton>
    </form>
  );
}
