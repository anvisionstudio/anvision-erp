import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { PageHeader, Card } from "@/components/ui";
import { InvoiceForm } from "../../form";

export default async function EditInvoice({ params }: { params: Promise<{ id: string }> }) {
  await requireUser("finance");
  const { id } = await params;
  const [inv, clients, projects] = await Promise.all([
    db.invoice.findUnique({ where: { id }, include: { items: { orderBy: { sort: "asc" } } } }),
    db.client.findMany({ orderBy: { name: "asc" } }),
    db.project.findMany({ orderBy: { createdAt: "desc" } }),
  ]);
  if (!inv) notFound();
  return (<><PageHeader title={`編輯 ${inv.number}`} back={`/invoices/${id}`} /><Card><InvoiceForm inv={inv} clients={clients} projects={projects} /></Card></>);
}
