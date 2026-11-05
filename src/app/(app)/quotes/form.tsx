import { saveQuote } from "@/app/actions/sales";
import { Field, Select } from "@/components/ui";
import { LineItems, SubmitButton } from "@/components/client";
import { isoDate } from "@/lib/format";
import type { Quote, QuoteItem, Client } from "@prisma/client";

export function QuoteForm({ q, clients, clientId, defaults }: {
  q?: Quote & { items: QuoteItem[] }; clients: Client[]; clientId?: string;
  defaults: { validDays: number; terms: string };
}) {
  const valid = new Date(Date.now() + defaults.validDays * 864e5);
  return (
    <form action={saveQuote} className="space-y-6">
      {q && <input type="hidden" name="id" value={q.id} />}
      <div className="grid gap-4 md:grid-cols-4">
        <Field label="客戶 *" className="md:col-span-2">
          <Select name="clientId" required placeholder="選擇客戶" defaultValue={q?.clientId ?? clientId} options={clients.map((c) => ({ value: c.id, label: c.name }))} />
        </Field>
        <Field label="報價日期"><input type="date" name="issueDate" defaultValue={isoDate(q?.issueDate ?? new Date())} className="input" /></Field>
        <Field label="有效期限" help="備註會自動顯示「本報價單 N 日內有效」"><input type="date" name="validUntil" defaultValue={isoDate(q?.validUntil ?? valid)} className="input" /></Field>
        <Field label="報價主旨 *" className="md:col-span-3" help="顯示在單據左上角的大標題，例如「行銷整合報價」"><input name="title" required defaultValue={q?.title} className="input" placeholder="例如：行銷整合報價" /></Field>
        <Field label="單號（Invoice）" help="留空自動編號"><input name="number" defaultValue={q?.number} className="input" placeholder="例如 2026523" /></Field>
      </div>
      <LineItems initial={q?.items} initialTaxRate={q?.taxRate ?? 0.05} withUnits />
      <Field label="備註 TERMS" help="每行一條，會依序列在單據左下方">
        <textarea name="notes" rows={6} defaultValue={q ? q.notes ?? "" : defaults.terms} className="input" />
      </Field>
      <SubmitButton>儲存報價單</SubmitButton>
    </form>
  );
}
