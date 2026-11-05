import { requireUser } from "@/lib/auth";
import { num } from "@/lib/format";
import { accountBalances } from "@/lib/reports";
import { ACCOUNT_TYPE_LABEL } from "@/lib/ledger";
import { saveAccount } from "@/app/actions/finance";
import { PageHeader, Card, Field, Select, Badge } from "@/components/ui";
import { SubmitButton } from "@/components/client";
import Link from "next/link";

export default async function Accounts() {
  await requireUser("finance");
  const rows = await accountBalances();
  const types = Object.entries(ACCOUNT_TYPE_LABEL).map(([value, label]) => ({ value, label }));
  return (
    <>
      <PageHeader title="會計科目" sub="科目代碼 1 資產、2 負債、3 權益、4 收入、5 成本、6 費用" />
      <Card title="新增科目" className="mb-6">
        <form action={saveAccount} className="grid gap-3 md:grid-cols-5">
          <Field label="代碼 *"><input name="code" required className="input" placeholder="6110" /></Field>
          <Field label="名稱 *" className="md:col-span-2"><input name="name" required className="input" /></Field>
          <Field label="類別"><Select name="type" options={types} defaultValue="EXPENSE" /></Field>
          <div className="flex items-end"><SubmitButton>新增</SubmitButton></div>
        </form>
      </Card>
      {types.map((t) => (
        <Card key={t.value} title={t.label} pad={false} className="mb-4">
          <table className="tbl">
            <thead><tr><th className="w-24">代碼</th><th>名稱</th><th className="text-right">借方累計</th><th className="text-right">貸方累計</th><th className="text-right">餘額</th><th /></tr></thead>
            <tbody>{rows.filter((r) => r.type === t.value).map((a) => (
              <tr key={a.id} className={a.active ? "" : "bg-surface-muted text-ink-muted"}>
                <td className="font-mono">{a.code}</td>
                <td><Link className="link" href={`/accounting?account=${a.id}`}>{a.name}</Link>{!a.active && <Badge label="停用" />}</td>
                <td className="num">{num(a.debit)}</td><td className="num">{num(a.credit)}</td><td className="num font-medium">{num(a.balance)}</td>
                <td className="text-right">
                  <form action={saveAccount}>
                    <input type="hidden" name="id" value={a.id} /><input type="hidden" name="code" value={a.code} /><input type="hidden" name="name" value={a.name} /><input type="hidden" name="type" value={a.type} />
                    <input type="hidden" name="active" value={a.active ? "false" : "true"} />
                    <button className="btn-secondary btn-sm">{a.active ? "停用" : "啟用"}</button>
                  </form>
                </td>
              </tr>
            ))}</tbody>
          </table>
        </Card>
      ))}
    </>
  );
}
