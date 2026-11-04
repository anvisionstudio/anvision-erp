import { requireUser } from "@/lib/auth";
import { PageHeader, Card } from "@/components/ui";
import { ClientForm } from "../form";

export default async function NewClient() {
  await requireUser("sales");
  return (<><PageHeader title="新增客戶" back="/clients" /><Card><ClientForm /></Card></>);
}
