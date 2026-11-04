import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { twd, date, isoDate } from "@/lib/format";
import { invoiceAmounts } from "@/lib/reports";
import { setInvoiceStatus, deleteInvoice, addPayment, deletePayment } from "@/app/actions/finance";
import { PageHeader, Card, Badge, Field, Select } from "@/components/ui";
import { ConfirmButton, PrintButton, SubmitButton } from "@/components/client";
import { DocumentView } from "@/components/document";

export default async function InvoiceDetail({ params }: { params: Promise<{ id: string }> }) {
  await requireUser("finance");
  const { id } = await params;
  const inv = await db.invoice.findUnique({ where: { id }, include: { client: true, project: true, items: { orderBy: { sort: "asc" } }, payments: { orderBy: { date: "asc" } } } });
  if (!inv) notFound();
  const a = invoiceAmounts(inv);
  const entries = await db.journalEntry.findMany({ where: { OR: [{ source: "INVOICE", sourceId: inv.id }, { source: "PAYMENT", sourceId: { in: inv.payments.map((p) => p.id) } }] }, orderBy: { date: "asc" } });
  const open = inv.status === "ISSUED" || inv.status === "PARTIAL";
  return (
    <>
      <PageHeader title={`請款單 ${inv.number}`} back="/invoices"
        sub={<span className="flex items-center gap-2"><Badge status={inv.status} />{inv.project && <Link className="link" href={`/projects/${inv.project.id}`}>{inv.project.name}</Link>}</span>}
        actions={<>
          <PrintButton />
          {inv.status !== "VOID" && <Link href={`/invoices/${inv.id}/edit`} className="btn-secondary">編輯</Link>}
          {inv.status === "DRAFT" && <ConfirmButton action={setInvoiceStatus.bind(null, inv.id, "ISSUED")} message="確認開立？系統將自動產生應收帳款傳票。" className="btn-primary">開立請款</ConfirmButton>}
          {inv.status === "ISSUED" && <ConfirmButton action={setInvoiceStatus.bind(null, inv.id, "VOID")} message="確定作廢？相關傳票將一併沖銷。" className="btn-danger">作廢</ConfirmButton>}
          {inv.status === "DRAFT" && <ConfirmButton action={deleteInvoice.bind(null, inv.id)} message="刪除此草稿？" className="btn-danger">刪除</ConfirmButton>}
        </>} />
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <DocumentView kind="請款單" number={inv.number} party={inv.client} partyLabel="客戶" showBank
            meta={[["開立日期", date(inv.issueDate)], ["付款期限", date(inv.dueDate)], ...(inv.gui ? [["發票號碼", inv.gui] as [string, string]] : []), ...(inv.project ? [["專案", inv.project.name] as [string, string]] : [])]}
            items={inv.items} taxRate={inv.taxRate} notes={inv.notes}
            footer={a.paid > 0 && <><div className="flex justify-between text-emerald-700"><span>已收款</span><span>{twd(a.paid)}</span></div><div className="flex justify-between font-medium"><span>未收餘額</span><span>{twd(a.balance)}</span></div></>} />
        </div>
        <div className="no-print space-y-6">
          <Card title="收款紀錄" pad={false}>
            <table className="tbl"><tbody>
              {inv.payments.map((p) => (
                <tr key={p.id}><td>{date(p.date)}<div className="text-xs text-slate-500">{p.method} {p.note}</div></td><td className="num">{twd(p.amount)}</td>
                  <td className="text-right"><ConfirmButton action={deletePayment.bind(null, p.id)} message="刪除這筆收款？">✕</ConfirmButton></td></tr>
              ))}
              {inv.payments.length === 0 && <tr><td className="text-center text-slate-400">尚無收款</td></tr>}
            </tbody></table>
            {open && (
              <form action={addPayment} className="grid grid-cols-2 gap-3 border-t border-slate-100 p-4">
                <input type="hidden" name="invoiceId" value={inv.id} />
                <Field label="收款日"><input type="date" name="date" defaultValue={isoDate(new Date())} className="input" /></Field>
                <Field label="金額"><input type="number" name="amount" defaultValue={a.balance} className="input" /></Field>
                <Field label="方式"><Select name="method" options={["轉帳", "現金", "支票", "信用卡"].map((v) => ({ value: v, label: v }))} /></Field>
                <Field label="備註"><input name="note" className="input" placeholder="例如：扣手續費 15" /></Field>
                <div className="col-span-2"><SubmitButton>登錄收款</SubmitButton></div>
              </form>
            )}
          </Card>
          <Card title="相關傳票" pad={false}>
            <table className="tbl"><tbody>
              {entries.map((e) => <tr key={e.id}><td><Link className="link" href={`/accounting?q=${e.number}`}>{e.number}</Link></td><td className="text-xs">{e.memo}</td></tr>)}
              {entries.length === 0 && <tr><td className="text-center text-slate-400">開立後自動產生</td></tr>}
            </tbody></table>
          </Card>
        </div>
      </div>
    </>
  );
}
