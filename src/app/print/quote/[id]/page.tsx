import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getCompany } from "@/lib/settings";
import { DocSheet } from "@/components/sheet";
import { SheetPreview, PrintToolbar } from "@/components/sheet-preview";

type P = { params: Promise<{ id: string }>; searchParams: Promise<{ auto?: string }> };

// 列印 / 存 PDF 時，瀏覽器以標題作為預設檔名
export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { id } = await params;
  const q = await db.quote.findUnique({ where: { id }, select: { number: true, title: true } });
  return { title: q ? `${q.number}_${q.title}` : "報價單" };
}

export default async function PrintQuote({ params, searchParams }: P) {
  await requireUser("sales");
  const { id } = await params;
  const { auto } = await searchParams;
  const [q, co] = await Promise.all([
    db.quote.findUnique({ where: { id }, include: { client: true, items: { orderBy: { sort: "asc" } } } }),
    getCompany(),
  ]);
  if (!q) notFound();
  return (
    <div className="min-h-dvh bg-line/60 print:bg-white">
      <style>{"@page { size: A4; margin: 0; } @media print { html, body { background: #fff !important; } }"}</style>
      <PrintToolbar back={`/quotes/${q.id}`} auto={auto === "1"} />
      <main id="main" className="px-2 py-6 print:p-0">
        <SheetPreview>
          <DocSheet co={co} kind={co.quoteLabel} number={q.number} title={q.title} party={q.client} date={q.issueDate} validUntil={q.validUntil} items={q.items} taxRate={q.taxRate} notes={q.notes} />
        </SheetPreview>
      </main>
    </div>
  );
}
