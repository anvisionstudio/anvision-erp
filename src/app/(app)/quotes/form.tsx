import { saveQuote } from "@/app/actions/sales";
import { Field, Select } from "@/components/ui";
import { LineItems, SubmitButton } from "@/components/client";
import { isoDate } from "@/lib/format";
import type { Quote, QuoteItem, Client } from "@prisma/client";

export function QuoteForm({ q, clients, clientId }: { q?: Quote & { items: QuoteItem[] }; clients: Client[]; clientId?: string }) {
  const valid = new Date(Date.now() + 30 * 864e5);
  return (
    <form action={saveQuote} className="space-y-6">
      {q && <input type="hidden" name="id" value={q.id} />}
      <div className="grid gap-4 md:grid-cols-4">
        <Field label="客戶 *" className="md:col-span-2">
          <Select name="clientId" required placeholder="選擇客戶" defaultValue={q?.clientId ?? clientId} options={clients.map((c) => ({ value: c.id, label: c.name }))} />
        </Field>
        <Field label="報價日期"><input type="date" name="issueDate" defaultValue={isoDate(q?.issueDate ?? new Date())} className="input" /></Field>
        <Field label="有效期限"><input type="date" name="validUntil" defaultValue={isoDate(q?.validUntil ?? valid)} className="input" /></Field>
        <Field label="報價主旨 *" className="md:col-span-4"><input name="title" required defaultValue={q?.title} className="input" placeholder="例如：2027 品牌識別與官網改版" /></Field>
      </div>
      <LineItems initial={q?.items} initialTaxRate={q?.taxRate ?? 0.05} />
      <Field label="備註 / 付款條件"><textarea name="notes" rows={3} defaultValue={q?.notes ?? "付款方式：簽約後支付 50% 訂金，結案驗收後支付尾款 50%。\n報價含兩次修改，超出另計。"} className="input" /></Field>
      <SubmitButton>儲存報價單</SubmitButton>
    </form>
  );
}
