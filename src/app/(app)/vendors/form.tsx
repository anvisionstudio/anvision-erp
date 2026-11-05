import Link from "next/link";
import type { Vendor } from "@prisma/client";
import { saveVendor } from "@/app/actions/purchasing";
import { Field } from "@/components/ui";
import { SubmitButton } from "@/components/client";

export function VendorForm({ v, categories }: { v?: Vendor; categories: string[] }) {
  return (
    <form action={saveVendor} className="grid gap-4 md:grid-cols-3">
      {v && <input type="hidden" name="id" value={v.id} />}
      <Field label="名稱 *"><input name="name" required defaultValue={v?.name} className="input" /></Field>
      <Field label="類別"><input name="category" defaultValue={v?.category ?? ""} className="input" list="vendor-cats" placeholder="印刷 / 大圖輸出 / 設計外包…" /></Field>
      <Field label="統一編號"><input name="taxId" defaultValue={v?.taxId ?? ""} className="input" /></Field>
      <Field label="帳上別名（逗號分隔）" className="md:col-span-3">
        <input name="aliases" defaultValue={v?.aliases ?? ""} className="input" placeholder="例如：龍泰, 龍泰旗幟, 龍泰影像" />
        <span className="mt-1 block text-xs text-slate-400">日記簿摘要中出現這些字，就會計入這家供應商的帳上交易。</span>
      </Field>
      <Field label="聯絡人"><input name="contact" defaultValue={v?.contact ?? ""} className="input" /></Field>
      <Field label="電話"><input name="phone" defaultValue={v?.phone ?? ""} className="input" /></Field>
      <Field label="Email"><input name="email" defaultValue={v?.email ?? ""} className="input" /></Field>
      <Field label="地址" className="md:col-span-2"><input name="address" defaultValue={v?.address ?? ""} className="input" /></Field>
      <Field label="匯款帳戶"><input name="bankInfo" defaultValue={v?.bankInfo ?? ""} className="input" placeholder="銀行 / 分行 / 帳號 / 戶名" /></Field>
      <Field label="備註" className="md:col-span-3"><textarea name="notes" defaultValue={v?.notes ?? ""} className="input" rows={2} /></Field>
      <datalist id="vendor-cats">{categories.map((c) => <option key={c} value={c} />)}</datalist>
      <div className="flex gap-2"><SubmitButton>儲存</SubmitButton><Link href={v ? `/vendors/${v.id}` : "/vendors"} className="btn-secondary">取消</Link></div>
    </form>
  );
}
