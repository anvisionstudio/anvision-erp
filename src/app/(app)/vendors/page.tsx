import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { twd } from "@/lib/format";
import { saveVendor, deleteVendor } from "@/app/actions/purchasing";
import { PageHeader, Card, Empty, Field } from "@/components/ui";
import { ConfirmButton, SubmitButton } from "@/components/client";

export default async function Vendors({ searchParams }: { searchParams: Promise<{ edit?: string; new?: string }> }) {
  await requireUser("purchasing");
  const sp = await searchParams;
  const vendors = await db.vendor.findMany({ include: { expenses: true }, orderBy: { name: "asc" } });
  const v = sp.edit ? vendors.find((x) => x.id === sp.edit) : undefined;
  return (
    <>
      <PageHeader title="供應商" sub="外包夥伴、印刷廠、器材商、軟體服務" actions={<Link href="/vendors?new=1" className="btn-primary">＋ 新增供應商</Link>} />
      {(sp.new || v) && (
        <Card title={v ? `編輯 ${v.name}` : "新增供應商"} className="mb-6">
          <form action={saveVendor} className="grid gap-4 md:grid-cols-3">
            {v && <input type="hidden" name="id" value={v.id} />}
            <Field label="名稱 *"><input name="name" required defaultValue={v?.name} className="input" /></Field>
            <Field label="統一編號"><input name="taxId" defaultValue={v?.taxId ?? ""} className="input" /></Field>
            <Field label="聯絡人"><input name="contact" defaultValue={v?.contact ?? ""} className="input" /></Field>
            <Field label="Email"><input name="email" defaultValue={v?.email ?? ""} className="input" /></Field>
            <Field label="電話"><input name="phone" defaultValue={v?.phone ?? ""} className="input" /></Field>
            <Field label="地址"><input name="address" defaultValue={v?.address ?? ""} className="input" /></Field>
            <Field label="匯款帳戶" className="md:col-span-3"><input name="bankInfo" defaultValue={v?.bankInfo ?? ""} className="input" placeholder="銀行 / 分行 / 帳號 / 戶名" /></Field>
            <Field label="備註" className="md:col-span-3"><textarea name="notes" defaultValue={v?.notes ?? ""} className="input" rows={2} /></Field>
            <div className="flex gap-2"><SubmitButton>儲存</SubmitButton><Link href="/vendors" className="btn-secondary">取消</Link></div>
          </form>
        </Card>
      )}
      <Card pad={false}>
        {vendors.length === 0 ? <Empty /> : (
          <table className="tbl">
            <thead><tr><th>名稱</th><th>統編</th><th>聯絡人</th><th>電話 / Email</th><th className="text-right">未付帳款</th><th className="text-right">累計交易</th><th /></tr></thead>
            <tbody>{vendors.map((x) => (
              <tr key={x.id}>
                <td className="font-medium">{x.name}</td><td>{x.taxId}</td><td>{x.contact}</td>
                <td className="text-xs text-slate-500">{x.phone}<br />{x.email}</td>
                <td className="num">{twd(x.expenses.filter((e) => e.status === "UNPAID").reduce((s, e) => s + e.amount + e.tax, 0))}</td>
                <td className="num">{twd(x.expenses.reduce((s, e) => s + e.amount, 0))}</td>
                <td className="whitespace-nowrap text-right"><Link href={`/vendors?edit=${x.id}`} className="btn-secondary btn-sm">編輯</Link>{" "}<ConfirmButton action={deleteVendor.bind(null, x.id)} message="刪除此供應商？">✕</ConfirmButton></td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </Card>
    </>
  );
}
