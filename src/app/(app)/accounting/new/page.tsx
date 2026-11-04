import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { isoDate } from "@/lib/format";
import { saveJournal } from "@/app/actions/finance";
import { PageHeader, Card, Field } from "@/components/ui";
import { JournalLines, SubmitButton } from "@/components/client";

export default async function NewJournal() {
  await requireUser("finance");
  const accounts = await db.account.findMany({ where: { active: true }, orderBy: { code: "asc" } });
  return (
    <>
      <PageHeader title="手動傳票" sub="例如：股東增資、設備購置、折舊、期初開帳" back="/accounting" />
      <Card>
        <form action={saveJournal} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-4">
            <Field label="日期"><input type="date" name="date" defaultValue={isoDate(new Date())} className="input" /></Field>
            <Field label="摘要 *" className="md:col-span-3"><input name="memo" required className="input" /></Field>
          </div>
          <JournalLines accounts={accounts.map((a) => ({ id: a.id, label: `${a.code} ${a.name}` }))} />
          <SubmitButton>儲存傳票</SubmitButton>
        </form>
      </Card>
    </>
  );
}
