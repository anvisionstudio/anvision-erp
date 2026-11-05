import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { twd, date, totals } from "@/lib/format";
import { PageHeader, Card, Badge, Empty, Tabs } from "@/components/ui";
import { FilterBar } from "@/components/filters";
import { dateRange, href, pick } from "@/lib/filters";

const TABS = [["ALL", "全部"], ["DRAFT", "草稿"], ["SENT", "已送出"], ["ACCEPTED", "已成交"], ["REJECTED", "未成交"]];

export default async function Quotes({ searchParams }: { searchParams: Promise<{ status?: string; q?: string; client?: string; from?: string; to?: string }> }) {
  await requireUser("sales");
  const sp = await searchParams;
  const { status = "ALL" } = sp;
  const f = pick(sp, ["q", "client", "from", "to"]);
  const clients = await db.client.findMany({ where: { quotes: { some: {} } }, orderBy: { name: "asc" }, select: { id: true, name: true } });
  const quotes = await db.quote.findMany({
    where: {
      ...(status === "ALL" ? {} : { status }),
      ...(f.client ? { clientId: f.client } : {}),
      ...(dateRange(f.from, f.to) ? { issueDate: dateRange(f.from, f.to) } : {}),
      ...(f.q ? { OR: [{ number: { contains: f.q } }, { title: { contains: f.q } }, { client: { name: { contains: f.q } } }] } : {}),
    },
    include: { client: true, items: true },
    orderBy: { issueDate: "desc" },
  });
  const sum = quotes.reduce((s, q) => s + totals(q.items, q.taxRate).subtotal, 0);
  return (
    <>
      <PageHeader title="報價單" sub={`${quotes.length} 張，合計未稅 ${twd(sum)}`} actions={<Link href="/quotes/new" className="btn-primary">＋ 新增報價</Link>} />
      <Tabs active={status} tabs={TABS.map(([k, l]) => ({ key: k, label: l, href: href("/quotes", f, { status: k }) }))} />
      <FilterBar path="/quotes" values={f} keep={{ status }} fields={[
        { type: "search", name: "q", label: "搜尋", placeholder: "單號、主旨、客戶…" },
        { type: "select", name: "client", label: "客戶", options: clients.map((c) => ({ value: c.id, label: c.name })) },
        { type: "date", name: "from", label: "開立日（起）" },
        { type: "date", name: "to", label: "開立日（迄）" },
      ]} />
      <Card pad={false}>
        {quotes.length === 0 ? <Empty /> : (
          <table className="tbl">
            <thead><tr><th>單號</th><th>主旨</th><th>客戶</th><th>日期</th><th className="text-right">總計(含稅)</th><th>狀態</th></tr></thead>
            <tbody>{quotes.map((q) => (
              <tr key={q.id}>
                <td><Link href={`/quotes/${q.id}`} className="link">{q.number}</Link></td>
                <td>{q.title}</td><td>{q.client.name}</td><td>{date(q.issueDate)}</td>
                <td className="num">{twd(totals(q.items, q.taxRate).total)}</td>
                <td><Badge status={q.status} /></td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </Card>
    </>
  );
}
