import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { PageHeader, Card } from "@/components/ui";
import { ProjectForm } from "../form";

export default async function NewProject() {
  await requireUser("projects");
  const [clients, users] = await Promise.all([db.client.findMany({ orderBy: { name: "asc" } }), db.user.findMany({ where: { active: true } })]);
  return (<><PageHeader title="新增專案" back="/projects" /><Card><ProjectForm clients={clients} users={users} /></Card></>);
}
