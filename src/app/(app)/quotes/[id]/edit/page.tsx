import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { PageHeader, Card } from "@/components/ui";
import { QuoteForm } from "../../form";

export default async function EditQuote({ params }: { params: Promise<{ id: string }> }) {
  await requireUser("sales");
  const { id } = await params;
  const [q, clients] = await Promise.all([
    db.quote.findUnique({ where: { id }, include: { items: { orderBy: { sort: "asc" } } } }),
    db.client.findMany({ orderBy: { name: "asc" } }),
  ]);
  if (!q) notFound();
  return (<><PageHeader title={`編輯 ${q.number}`} back={`/quotes/${id}`} /><Card><QuoteForm q={q} clients={clients} /></Card></>);
}
