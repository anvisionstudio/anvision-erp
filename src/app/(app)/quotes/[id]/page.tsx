import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser, can } from "@/lib/auth";
import { date } from "@/lib/format";
import { setQuoteStatus, deleteQuote, quoteToProject, quoteToInvoice } from "@/app/actions/sales";
import { PageHeader, Badge } from "@/components/ui";
import { ConfirmButton, PrintButton } from "@/components/client";
import { DocumentView } from "@/components/document";

export default async function QuoteDetail({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser("sales");
  const { id } = await params;
  const q = await db.quote.findUnique({ where: { id }, include: { client: true, items: { orderBy: { sort: "asc" } }, project: true } });
  if (!q) notFound();
  const status = (s: string) => setQuoteStatus.bind(null, q.id, s);
  return (
    <>
      <PageHeader title={q.title} sub={<span className="flex items-center gap-2">{q.number} <Badge status={q.status} /></span>} back="/quotes"
        actions={<>
          <PrintButton />
          <Link href={`/quotes/${q.id}/edit`} className="btn-secondary">編輯</Link>
          {q.status === "DRAFT" && <ConfirmButton action={status("SENT")} message="標記為已送出？" className="btn-secondary">標記已送出</ConfirmButton>}
          {(q.status === "SENT" || q.status === "DRAFT") && <ConfirmButton action={status("REJECTED")} message="標記為未成交？" className="btn-secondary">未成交</ConfirmButton>}
          {q.project ? (
            <Link href={`/projects/${q.project.id}`} className="btn-secondary">查看專案 {q.project.code}</Link>
          ) : q.status !== "REJECTED" && (
            <ConfirmButton action={quoteToProject.bind(null, q.id)} message="將此報價標記成交並建立專案？" className="btn-primary">成交並建立專案<ArrowRight className="h-4 w-4" aria-hidden /></ConfirmButton>
          )}
          {can(user, "finance") && q.status === "ACCEPTED" && (<>
            <ConfirmButton action={quoteToInvoice.bind(null, q.id, 0.5)} message="依報價建立 50% 訂金請款單？" className="btn-secondary">開 50% 訂金請款</ConfirmButton>
            <ConfirmButton action={quoteToInvoice.bind(null, q.id, 1)} message="依報價建立全額請款單？" className="btn-secondary">開全額請款</ConfirmButton>
          </>)}
          <ConfirmButton action={deleteQuote.bind(null, q.id)} message="確定刪除此報價單？" className="btn-danger">刪除</ConfirmButton>
        </>} />
      <DocumentView kind="報價單" number={q.number} party={q.client} partyLabel="客戶"
        meta={[["報價日期", date(q.issueDate)], ["有效期限", date(q.validUntil)], ["主旨", q.title]]}
        items={q.items} taxRate={q.taxRate} notes={q.notes} />
    </>
  );
}
