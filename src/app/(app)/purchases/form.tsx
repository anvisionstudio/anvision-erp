import { savePO } from "@/app/actions/purchasing";
import { Field, Select } from "@/components/ui";
import { LineItems, SubmitButton } from "@/components/client";
import { isoDate } from "@/lib/format";
import type { PurchaseOrder, PurchaseItem, Vendor, Project, InventoryItem } from "@prisma/client";

export function POForm({ po, vendors, projects, catalog }: { po?: PurchaseOrder & { items: PurchaseItem[] }; vendors: Vendor[]; projects: Project[]; catalog: InventoryItem[] }) {
  return (
    <form action={savePO} className="space-y-6">
      {po && <input type="hidden" name="id" value={po.id} />}
      <div className="grid gap-4 md:grid-cols-4">
        <Field label="供應商 *" className="md:col-span-2"><Select name="vendorId" required placeholder="選擇供應商" defaultValue={po?.vendorId} options={vendors.map((v) => ({ value: v.id, label: v.name }))} /></Field>
        <Field label="歸屬專案"><Select name="projectId" placeholder="（公司用）" defaultValue={po?.projectId} options={projects.map((p) => ({ value: p.id, label: `${p.code} ${p.name}` }))} /></Field>
        <Field label="採購日期"><input type="date" name="orderDate" defaultValue={isoDate(po?.orderDate ?? new Date())} className="input" /></Field>
      </div>
      <LineItems initial={po?.items} initialTaxRate={po?.taxRate ?? 0.05} catalog={catalog.map((c) => ({ id: c.id, label: `${c.sku} ${c.name}`, cost: c.cost }))} />
      <Field label="備註 / 交貨條件"><textarea name="notes" rows={2} defaultValue={po?.notes ?? ""} className="input" /></Field>
      <SubmitButton>儲存採購單</SubmitButton>
    </form>
  );
}
