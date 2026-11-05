import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { twd, date, isoDate } from "@/lib/format";
import { invoiceAmounts } from "@/lib/reports";
import { setInvoiceStatus, deleteInvoice, addPayment, deletePayment } from "@/app/actions/finance";
import { PageHeader, Card, Badge, Field, Select } from "@/components/ui";
import { ConfirmButton, SubmitButton } from "@/components/client";
import { DocSheet } from "@/components/sheet";
import { SheetPreview } from "@/components/sheet-preview";
import { getCompany } from "@/lib/settings";
import { FileDown } from "lucide-react";

export default async function InvoiceDetail({ params }: { params: Promise<{ id: string }> }) {
  await requireUser("finance");
  const { id } = await params;
  const inv = await db.invoice.findUnique({ where: { id }, include: { client: true, project: true, items: { orderBy: { sort: "asc" } }, payments: { orderBy: { date: "asc" } } } });
  if (!inv) notFound();
  const a = invoiceAmounts(inv);
  const co = await getCompany();
  const entries = await db.journalEntry.findMany({ where: { OR: [{ source: "INVOICE", sourceId: inv.id }, { source: "PAYMENT", sourceId: { in: inv.payments.map((p) => p.id) } }] }, orderBy: { date: "asc" } });
  const open = inv.status === "ISSUED" || inv.status === "PARTIAL";
  return (
    <>
      <PageHeader title={`請款單 ${inv.number}`} back="/invoices"
        sub={<span className="flex items-center gap-2"><Badge status={inv.status} />{inv.project && <Link className="link" href={`/projects/${inv.project.id}`}>{inv.project.name}</Link>}</span>}
        actions={<>
          <a href={`/print/invoice/${inv.id}?auto=1`} target="_blank" rel="noopener" className="btn-secondary"><FileDown className="h-4 w-4" aria-hidden />下載 PDF</a>
          {inv.status !== "VOID" && <Link href={`/invoices/${inv.id}/edit`} className="btn-secondary">編輯</Link>}
          {inv.status === "DRAFT" && <ConfirmButton action={setInvoiceStatus.bind(null, inv.id, "ISSUED")} message="確認開立？系統將自動產生應收帳款傳票。" className="btn-primary">開立請款</ConfirmButton>}
          {inv.status === "ISSUED" && <ConfirmButton action={setInvoiceStatus.bind(null, inv.id, "VOID")} message="確定作廢？相關傳票將一併沖銷。" className="btn-danger">作廢</ConfirmButton>}
          {inv.status === "DRAFT" && <ConfirmButton action={deleteInvoice.bind(null, inv.id)} message="刪除此草稿？" className="btn-danger">刪除</ConfirmButton>}
        </>} />
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="min-w-0 xl:col-span-2">
          <SheetPreview>
            <DocSheet co={co} kind={co.invoiceLabel} number={inv.gui ?? inv.number} title={inv.project?.name ?? "請款單"} party={inv.client} date={inv.issueDate} items={inv.items} taxRate={inv.taxRate} notes={inv.notes} showValidity={false} />
          </SheetPreview>
          {a.paid > 0 && <p className="mt-3 text-sm text-ink-muted">已收款 {twd(a.paid)}，未收餘額 <span className="font-medium text-ink">{twd(a.balance)}</span></p>}
        </div>
        <div className="no-print space-y-6">
          <Card title="收款紀錄" pad={false}>
            <table className="tbl"><tbody>
              {inv.payments.map((p) => (
                <tr key={p.id}><td>{date(p.date)}<div className="text-xs text-ink-muted">{p.method} {p.note}</div></td><td className="num">{twd(p.amount)}</td>
                  <td className="text-right"><ConfirmButton action={deletePayment.bind(null, p.id)} message="刪除這筆收款？">✕</ConfirmButton></td></tr>
              ))}
              {inv.payments.length === 0 && <tr><td className="text-center text-ink-muted">尚無收款</td></tr>}
            </tbody></table>
            {open && (
              <form action={addPayment} className="grid grid-cols-1 gap-3 border-t sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2 border-line p-4">
                <input type="hidden" name="invoiceId" value={inv.id} />
                <Field label="收款日"><input type="date" name="date" defaultValue={isoDate(new Date())} className="input" /></Field>
                <Field label="金額"><input type="number" name="amount" defaultValue={a.balance} className="input" /></Field>
                <Field label="方式"><Select name="method" options={["轉帳", "現金", "支票", "信用卡"].map((v) => ({ value: v, label: v }))} /></Field>
                <Field label="備註"><input name="note" className="input" placeholder="例如：扣手續費 15" /></Field>
                <div className="sm:col-span-2 xl:col-span-1 2xl:col-span-2"><SubmitButton>登錄收款</SubmitButton></div>
              </form>
            )}
          </Card>
          <Card title="相關傳票" pad={false}>
            <table className="tbl"><tbody>
              {entries.map((e) => <tr key={e.id}><td><Link className="link" href={`/accounting?q=${e.number}`}>{e.number}</Link></td><td className="text-xs">{e.memo}</td></tr>)}
              {entries.length === 0 && <tr><td className="text-center text-ink-muted">開立後自動產生</td></tr>}
            </tbody></table>
          </Card>
        </div>
      </div>
    </>
  );
}
