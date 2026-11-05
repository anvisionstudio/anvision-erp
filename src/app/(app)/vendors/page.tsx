import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { twd, date } from "@/lib/format";
import { vendorLedger } from "@/lib/vendor-ledger";
import { PageHeader, Card, Empty, Badge, Stat, Chip } from "@/components/ui";
import { VendorForm } from "./form";
import { VendorCsvForm } from "./csv";

export default async function Vendors({ searchParams }: { searchParams: Promise<{ new?: string; cat?: string; q?: string }> }) {
  await requireUser("purchasing");
  const sp = await searchParams;
  const [all, { stats }] = await Promise.all([db.vendor.findMany({ include: { expenses: true }, orderBy: { name: "asc" } }), vendorLedger()]);
  const categories = [...new Set(all.map((v) => v.category).filter((c): c is string => !!c))].sort();
  const vendors = all
    .filter((v) => !sp.cat || v.category === sp.cat)
    .filter((v) => !sp.q || [v.name, v.aliases, v.contact, v.taxId].some((x) => x?.includes(sp.q!)))
    .map((v) => ({ v, s: stats.get(v.id)!, unpaid: v.expenses.filter((e) => e.status === "UNPAID").reduce((t, e) => t + e.amount + e.tax, 0), erp: v.expenses.reduce((t, e) => t + e.amount, 0) }))
    .sort((a, b) => b.s.spend + b.erp - (a.s.spend + a.erp));
  const total = vendors.reduce((t, x) => t + x.s.spend + x.erp, 0);
  const prepaid = vendors.reduce((t, x) => t + x.s.prepaid, 0);
  return (
    <>
      <PageHeader title="供應商" sub="外包夥伴、印刷廠、材料商、軟體服務" actions={<Link href="/vendors?new=1" className="btn-primary">＋ 新增供應商</Link>} />
      {sp.new && <Card title="新增供應商" className="mb-6"><VendorForm categories={categories} /></Card>}
      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="供應商" value={vendors.length} />
        <Stat label="帳上成本 / 費用合計" value={twd(total)} hint="依日記簿摘要別名比對" />
        <Stat label="預付儲值餘額" value={twd(prepaid)} />
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Chip href="/vendors" active={!sp.cat}>全部</Chip>
        {categories.map((c) => (
          <Chip key={c} href={`/vendors?cat=${encodeURIComponent(c)}`} active={sp.cat === c}>{c}</Chip>
        ))}
        <form className="w-full sm:ml-auto sm:w-auto"><input type="search" aria-label="搜尋供應商" name="q" defaultValue={sp.q} placeholder="搜尋供應商…" className="input w-full sm:w-48" /></form>
      </div>
      <Card pad={false} className="mb-6">
        {vendors.length === 0 ? <Empty>尚無供應商，可用下方「匯入 CSV」批次建立</Empty> : (
          <table className="tbl">
            <thead><tr><th>名稱</th><th>類別</th><th>聯絡</th><th className="text-right">帳上成本 / 費用</th><th className="text-right">預付餘額</th><th className="text-right">筆數</th><th className="text-right">專案</th><th>最近交易</th><th className="text-right">ERP 未付</th></tr></thead>
            <tbody>{vendors.map(({ v, s, unpaid, erp }) => (
              <tr key={v.id}>
                <td><Link href={`/vendors/${v.id}`} className="link">{v.name}</Link>{v.taxId && <div className="text-xs text-ink-muted">統編 {v.taxId}</div>}</td>
                <td>{v.category && <Badge label={v.category} />}</td>
                <td className="text-xs text-ink-muted">{v.contact}{v.phone && <div>{v.phone}</div>}</td>
                <td className="num font-medium">{twd(s.spend + erp)}</td>
                <td className="num">{s.prepaid ? twd(s.prepaid) : "—"}</td>
                <td className="num">{s.lines}</td>
                <td className="num">{s.projects.size || "—"}</td>
                <td className="text-xs">{date(s.last)}</td>
                <td className="num">{unpaid ? twd(unpaid) : "—"}</td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </Card>
      <Card title="批次匯入 / 更新供應商（CSV）">
        <p className="mb-3 text-sm text-ink-muted">第一列為欄位名稱：名稱、類別、別名、統編、聯絡人、電話、Email、地址、匯款帳戶、備註（只有「名稱」必填）。同名供應商會更新，其餘新增。別名請用逗號或「、」分隔。</p>
        <VendorCsvForm />
      </Card>
    </>
  );
}
