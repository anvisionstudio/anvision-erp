import { saveClient } from "@/app/actions/sales";
import { Field } from "@/components/ui";
import { SubmitButton } from "@/components/client";
import type { Client } from "@prisma/client";

export function ClientForm({ c }: { c?: Client }) {
  return (
    <form action={saveClient} className="grid gap-4 md:grid-cols-2">
      {c && <input type="hidden" name="id" value={c.id} />}
      <Field label="公司 / 客戶名稱 *"><input name="name" required defaultValue={c?.name} className="input" /></Field>
      <Field label="統一編號"><input inputMode="numeric" pattern="[0-9]{8}" title="統一編號為 8 碼數字" name="taxId" defaultValue={c?.taxId ?? ""} className="input" maxLength={8} /></Field>
      <Field label="聯絡人"><input name="contact" defaultValue={c?.contact ?? ""} className="input" /></Field>
      <Field label="Email"><input type="email" autoComplete="email" name="email" defaultValue={c?.email ?? ""} className="input" /></Field>
      <Field label="電話"><input type="tel" inputMode="tel" autoComplete="tel" name="phone" defaultValue={c?.phone ?? ""} className="input" /></Field>
      <Field label="地址"><input autoComplete="street-address" name="address" defaultValue={c?.address ?? ""} className="input" /></Field>
      <Field label="專案別名（逗號分隔）" className="md:col-span-2">
        <input name="aliases" defaultValue={c?.aliases ?? ""} className="input" placeholder="例如：彤心美學, 彤芯美學, 彤心醫美" />
        <span className="mt-1 block text-xs text-ink-muted">Excel 專案名稱中出現這些字，同步時就會自動歸給這位客戶（已指定客戶的專案不受影響）。</span>
      </Field>
      <Field label="備註" className="md:col-span-2"><textarea name="notes" rows={3} defaultValue={c?.notes ?? ""} className="input" /></Field>
      <div className="md:col-span-2"><SubmitButton>儲存</SubmitButton></div>
    </form>
  );
}
