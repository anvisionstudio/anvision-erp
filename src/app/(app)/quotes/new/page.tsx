import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { PageHeader, Card } from "@/components/ui";
import { getCompany } from "@/lib/settings";
import { QuoteForm } from "../form";

export default async function NewQuote({ searchParams }: { searchParams: Promise<{ clientId?: string }> }) {
  await requireUser("sales");
  const co = await getCompany();
  const { clientId } = await searchParams;
  const clients = await db.client.findMany({ orderBy: { name: "asc" } });
  return (<><PageHeader title="新增報價單" back="/quotes" /><Card><QuoteForm defaults={{ validDays: co.validDays, terms: co.quoteTerms }} clients={clients} clientId={clientId} /></Card></>);
}
