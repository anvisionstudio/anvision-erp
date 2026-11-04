import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { PageHeader, Card, Empty } from "@/components/ui";

export default async function Clients({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireUser("sales");
  const { q } = await searchParams;
  const clients = await db.client.findMany({
    where: q ? { OR: [{ name: { contains: q } }, { contact: { contains: q } }, { taxId: { contains: q } }] } : undefined,
    include: { _count: { select: { projects: true, quotes: true } } },
    orderBy: { name: "asc" },
  });
  return (
    <>
      <PageHeader title="客戶" sub={`共 ${clients.length} 位客戶`} actions={<Link href="/clients/new" className="btn-primary">＋ 新增客戶</Link>} />
      <form className="mb-4"><input name="q" defaultValue={q} placeholder="搜尋名稱、聯絡人、統編…" className="input max-w-sm" /></form>
      <Card pad={false}>
        {clients.length === 0 ? <Empty /> : (
          <table className="tbl">
            <thead><tr><th>名稱</th><th>統編</th><th>聯絡人</th><th>Email / 電話</th><th className="text-right">報價</th><th className="text-right">專案</th></tr></thead>
            <tbody>
              {clients.map((c) => (
                <tr key={c.id}>
                  <td><Link href={`/clients/${c.id}`} className="link">{c.name}</Link></td>
                  <td>{c.taxId}</td>
                  <td>{c.contact}</td>
                  <td className="text-xs text-slate-500">{c.email}<br />{c.phone}</td>
                  <td className="num">{c._count.quotes}</td>
                  <td className="num">{c._count.projects}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}
