import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { PageHeader, Card } from "@/components/ui";
import { POForm } from "../../form";

export default async function EditPO({ params }: { params: Promise<{ id: string }> }) {
  await requireUser("purchasing");
  const { id } = await params;
  const [po, vendors, projects, catalog] = await Promise.all([
    db.purchaseOrder.findUnique({ where: { id }, include: { items: true } }),
    db.vendor.findMany({ orderBy: { name: "asc" } }),
    db.project.findMany({ orderBy: { createdAt: "desc" } }),
    db.inventoryItem.findMany({ orderBy: { sku: "asc" } }),
  ]);
  if (!po) notFound();
  return (<><PageHeader title={`編輯 ${po.number}`} back={`/purchases/${id}`} /><Card><POForm po={po} vendors={vendors} projects={projects} catalog={catalog} /></Card></>);
}
