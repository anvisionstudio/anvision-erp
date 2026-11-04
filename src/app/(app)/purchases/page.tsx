import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { twd, date, totals } from "@/lib/format";
import { PageHeader, Card, Badge, Empty, Tabs } from "@/components/ui";

export default async function Purchases({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireUser("purchasing");
  const { status = "OPEN" } = await searchParams;
  const where = status === "ALL" ? {} : status === "OPEN" ? { status: { in: ["DRAFT", "ORDERED"] } } : { status };
  const pos = await db.purchaseOrder.findMany({ where, include: { vendor: true, project: true, items: true }, orderBy: { orderDate: "desc" } });
  return (
    <>
      <PageHeader title="採購單" actions={<Link href="/purchases/new" className="btn-primary">＋ 新增採購單</Link>} />
      <Tabs active={status} tabs={[["OPEN", "處理中"], ["RECEIVED", "已到貨"], ["CANCELLED", "已取消"], ["ALL", "全部"]].map(([k, l]) => ({ key: k, label: l, href: `/purchases?status=${k}` }))} />
      <Card pad={false}>
        {pos.length === 0 ? <Empty /> : (
          <table className="tbl">
            <thead><tr><th>單號</th><th>供應商</th><th>專案</th><th>日期</th><th className="text-right">總計</th><th>狀態</th></tr></thead>
            <tbody>{pos.map((p) => (
              <tr key={p.id}><td><Link className="link" href={`/purchases/${p.id}`}>{p.number}</Link></td><td>{p.vendor.name}</td><td>{p.project?.name}</td><td>{date(p.orderDate)}</td><td className="num">{twd(totals(p.items, p.taxRate).total)}</td><td><Badge status={p.status} /></td></tr>
            ))}</tbody>
          </table>
        )}
      </Card>
    </>
  );
}
