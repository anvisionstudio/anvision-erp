import { saveClient } from "@/app/actions/sales";
import { Field } from "@/components/ui";
import { SubmitButton } from "@/components/client";
import type { Client } from "@prisma/client";

export function ClientForm({ c }: { c?: Client }) {
  return (
    <form action={saveClient} className="grid gap-4 md:grid-cols-2">
      {c && <input type="hidden" name="id" value={c.id} />}
      <Field label="公司 / 客戶名稱 *"><input name="name" required defaultValue={c?.name} className="input" /></Field>
      <Field label="統一編號"><input name="taxId" defaultValue={c?.taxId ?? ""} className="input" maxLength={8} /></Field>
      <Field label="聯絡人"><input name="contact" defaultValue={c?.contact ?? ""} className="input" /></Field>
      <Field label="Email"><input name="email" type="email" defaultValue={c?.email ?? ""} className="input" /></Field>
      <Field label="電話"><input name="phone" defaultValue={c?.phone ?? ""} className="input" /></Field>
      <Field label="地址"><input name="address" defaultValue={c?.address ?? ""} className="input" /></Field>
      <Field label="備註" className="md:col-span-2"><textarea name="notes" rows={3} defaultValue={c?.notes ?? ""} className="input" /></Field>
      <div className="md:col-span-2"><SubmitButton>儲存</SubmitButton></div>
    </form>
  );
}
