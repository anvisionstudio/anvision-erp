import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { twd, date, totals } from "@/lib/format";
import { PageHeader, Card, Badge, Empty, Tabs } from "@/components/ui";
import { FilterBar } from "@/components/filters";
import { dateRange, href, pick } from "@/lib/filters";

export default async function Purchases({ searchParams }: { searchParams: Promise<{ status?: string; q?: string; vendor?: string; project?: string; from?: string; to?: string }> }) {
  await requireUser("purchasing");
  const sp = await searchParams;
  const { status = "OPEN" } = sp;
  const f = pick(sp, ["q", "vendor", "project", "from", "to"]);
  const [vendors, projects] = await Promise.all([
    db.vendor.findMany({ where: { purchaseOrders: { some: {} } }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.project.findMany({ where: { purchaseOrders: { some: {} } }, orderBy: { createdAt: "desc" }, select: { id: true, name: true } }),
  ]);
  const where = {
    ...(status === "ALL" ? {} : status === "OPEN" ? { status: { in: ["DRAFT", "ORDERED"] } } : { status }),
    ...(f.vendor ? { vendorId: f.vendor } : {}),
    ...(f.project ? { projectId: f.project } : {}),
    ...(dateRange(f.from, f.to) ? { orderDate: dateRange(f.from, f.to) } : {}),
    ...(f.q ? { OR: [{ number: { contains: f.q } }, { vendor: { name: { contains: f.q } } }, { notes: { contains: f.q } }] } : {}),
  };
  const pos = await db.purchaseOrder.findMany({ where, include: { vendor: true, project: true, items: true }, orderBy: { orderDate: "desc" } });
  return (
    <>
      <PageHeader title="採購單" actions={<Link href="/purchases/new" className="btn-primary">＋ 新增採購單</Link>} />
      <Tabs active={status} tabs={[["OPEN", "處理中"], ["RECEIVED", "已到貨"], ["CANCELLED", "已取消"], ["ALL", "全部"]].map(([k, l]) => ({ key: k, label: l, href: href("/purchases", f, { status: k }) }))} />
      <FilterBar path="/purchases" values={f} keep={{ status }} fields={[
        { type: "search", name: "q", label: "搜尋", placeholder: "單號、供應商、備註…" },
        { type: "select", name: "vendor", label: "供應商", options: vendors.map((v) => ({ value: v.id, label: v.name })) },
        { type: "select", name: "project", label: "專案", options: projects.map((p) => ({ value: p.id, label: p.name })) },
        { type: "date", name: "from", label: "訂購日（起）" },
        { type: "date", name: "to", label: "訂購日（迄）" },
      ]} />
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
