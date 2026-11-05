import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser, can } from "@/lib/auth";
import { date } from "@/lib/format";
import { setQuoteStatus, deleteQuote, quoteToProject, quoteToInvoice } from "@/app/actions/sales";
import { PageHeader, Badge } from "@/components/ui";
import { ConfirmButton } from "@/components/client";
import { DocSheet } from "@/components/sheet";
import { SheetPreview } from "@/components/sheet-preview";
import { getCompany } from "@/lib/settings";
import { FileDown } from "lucide-react";

export default async function QuoteDetail({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser("sales");
  const { id } = await params;
  const [q, co] = await Promise.all([db.quote.findUnique({ where: { id }, include: { client: true, items: { orderBy: { sort: "asc" } }, project: true } }), getCompany()]);
  if (!q) notFound();
  const status = (s: string) => setQuoteStatus.bind(null, q.id, s);
  return (
    <>
      <PageHeader title={q.title} sub={<span className="flex items-center gap-2">{q.number} <Badge status={q.status} /></span>} back="/quotes"
        actions={<>
          <a href={`/print/quote/${q.id}?auto=1`} target="_blank" rel="noopener" className="btn-primary"><FileDown className="h-4 w-4" aria-hidden />下載 PDF</a>
          <Link href={`/quotes/${q.id}/edit`} className="btn-secondary">編輯</Link>
          {q.status === "DRAFT" && <ConfirmButton action={status("SENT")} message="標記為已送出？" className="btn-secondary">標記已送出</ConfirmButton>}
          {(q.status === "SENT" || q.status === "DRAFT") && <ConfirmButton action={status("REJECTED")} message="標記為未成交？" className="btn-secondary">未成交</ConfirmButton>}
          {q.project ? (
            <Link href={`/projects/${q.project.id}`} className="btn-secondary">查看專案 {q.project.code}</Link>
          ) : q.status !== "REJECTED" && (
            <ConfirmButton action={quoteToProject.bind(null, q.id)} message="將此報價標記成交並建立專案？" className="btn-secondary">成交並建立專案<ArrowRight className="h-4 w-4" aria-hidden /></ConfirmButton>
          )}
          {can(user, "finance") && q.status === "ACCEPTED" && (<>
            <ConfirmButton action={quoteToInvoice.bind(null, q.id, 0.5)} message="依報價建立 50% 訂金請款單？" className="btn-secondary">開 50% 訂金請款</ConfirmButton>
            <ConfirmButton action={quoteToInvoice.bind(null, q.id, 1)} message="依報價建立全額請款單？" className="btn-secondary">開全額請款</ConfirmButton>
          </>)}
          <ConfirmButton action={deleteQuote.bind(null, q.id)} message="確定刪除此報價單？" className="btn-danger">刪除</ConfirmButton>
        </>} />
      <SheetPreview>
        <DocSheet co={co} kind={co.quoteLabel} number={q.number} title={q.title} party={q.client} date={q.issueDate} validUntil={q.validUntil} items={q.items} taxRate={q.taxRate} notes={q.notes} />
      </SheetPreview>
    </>
  );
}
