import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { PageHeader, Card } from "@/components/ui";
import { POForm } from "../form";

export default async function NewPO() {
  await requireUser("purchasing");
  const [vendors, projects, catalog] = await Promise.all([
    db.vendor.findMany({ orderBy: { name: "asc" } }),
    db.project.findMany({ where: { status: { in: ["ACTIVE", "PLANNING"] } }, orderBy: { createdAt: "desc" } }),
    db.inventoryItem.findMany({ orderBy: { sku: "asc" } }),
  ]);
  return (<><PageHeader title="新增採購單" back="/purchases" /><Card><POForm vendors={vendors} projects={projects} catalog={catalog} /></Card></>);
}
