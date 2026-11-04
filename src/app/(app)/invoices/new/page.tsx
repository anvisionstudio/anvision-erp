import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { PageHeader, Card } from "@/components/ui";
import { InvoiceForm } from "../form";

export default async function NewInvoice({ searchParams }: { searchParams: Promise<{ projectId?: string; clientId?: string }> }) {
  await requireUser("finance");
  const sp = await searchParams;
  const [clients, projects] = await Promise.all([db.client.findMany({ orderBy: { name: "asc" } }), db.project.findMany({ orderBy: { createdAt: "desc" } })]);
  const proj = sp.projectId ? projects.find((p) => p.id === sp.projectId) : undefined;
  const preset = { clientId: proj?.clientId ?? sp.clientId, projectId: proj?.id, items: proj ? [{ description: proj.name, quantity: 1, unitPrice: proj.budget }] : undefined };
  return (<><PageHeader title="新增請款單" back="/invoices" /><Card><InvoiceForm clients={clients} projects={projects} preset={preset} /></Card></>);
}
