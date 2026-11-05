import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getCompany } from "@/lib/settings";
import { DocSheet } from "@/components/sheet";
import { SheetPreview, PrintToolbar } from "@/components/sheet-preview";

type P = { params: Promise<{ id: string }>; searchParams: Promise<{ auto?: string }> };

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { id } = await params;
  const i = await db.invoice.findUnique({ where: { id }, select: { number: true, project: { select: { name: true } } } });
  return { title: i ? `${i.number}_${i.project?.name ?? "請款單"}` : "請款單" };
}

export default async function PrintInvoice({ params, searchParams }: P) {
  await requireUser("finance");
  const { id } = await params;
  const { auto } = await searchParams;
  const [inv, co] = await Promise.all([
    db.invoice.findUnique({ where: { id }, include: { client: true, project: true, items: { orderBy: { sort: "asc" } } } }),
    getCompany(),
  ]);
  if (!inv) notFound();
  return (
    <div className="min-h-dvh bg-line/60 print:bg-white">
      <style>{"@page { size: A4; margin: 0; } @media print { html, body { background: #fff !important; } }"}</style>
      <PrintToolbar back={`/invoices/${inv.id}`} auto={auto === "1"} />
      <main id="main" className="px-2 py-6 print:p-0">
        <SheetPreview>
          <DocSheet co={co} kind={co.invoiceLabel} number={inv.gui ?? inv.number} title={inv.project?.name ?? "請款單"} party={inv.client} date={inv.issueDate}
            items={inv.items} taxRate={inv.taxRate} notes={inv.notes} showValidity={false} />
        </SheetPreview>
      </main>
    </div>
  );
}
