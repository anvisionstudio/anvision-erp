import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { twd, date } from "@/lib/format";
import { clientStats } from "@/lib/client-stats";
import { IMPORT_CLIENT } from "@/lib/client-match";
import { PageHeader, Card, Empty, Stat } from "@/components/ui";
import { ClientCsvForm } from "./csv";

export default async function Clients({ searchParams }: { searchParams: Promise<{ q?: string; sort?: string }> }) {
  await requireUser("sales");
  const { q, sort = "revenue" } = await searchParams;
  const [clients, stats, unassigned] = await Promise.all([
    db.client.findMany({
      where: q ? { OR: [{ name: { contains: q } }, { contact: { contains: q } }, { taxId: { contains: q } }, { aliases: { contains: q } }] } : undefined,
      include: { _count: { select: { quotes: true, invoices: true } } },
    }),
    clientStats(),
    db.project.count({ where: { OR: [{ clientId: null }, { client: { name: IMPORT_CLIENT } }] } }),
  ]);
  const rows = clients
    .map((c) => ({ c, s: stats.get(c.id) ?? { projects: 0, revenue: 0, outstanding: 0, last: null } }))
    .filter(({ c, s }) => c.name !== IMPORT_CLIENT || s.outstanding > 0 || c._count.invoices > 0)
    .sort((a, b) => (sort === "name" ? a.c.name.localeCompare(b.c.name, "zh-TW") : sort === "recent" ? (b.s.last?.getTime() ?? 0) - (a.s.last?.getTime() ?? 0) : b.s.revenue - a.s.revenue));
  const total = rows.reduce((t, r) => t + r.s.revenue, 0);
  const outstanding = rows.reduce((t, r) => t + r.s.outstanding, 0);
  const sortLink = (k: string, label: string) => (
    <Link href={`/clients?sort=${k}${q ? `&q=${encodeURIComponent(q)}` : ""}`} className={`rounded-full px-3 py-1 text-xs ${sort === k ? "bg-brand-600 text-white" : "bg-slate-200 text-slate-600"}`}>{label}</Link>
  );
  return (
    <>
      <PageHeader title="客戶" sub={`共 ${rows.length} 位客戶`} actions={<Link href="/clients/new" className="btn-primary">＋ 新增客戶</Link>} />
      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="客戶數" value={rows.length} />
        <Stat label="帳上營收合計" value={twd(total)} hint="依專案歸戶的日記簿收入" />
        <Stat label="未收款" value={twd(outstanding)} />
        <Stat label="未歸戶專案" value={unassigned} tone={unassigned ? "bad" : undefined} hint={unassigned ? <Link className="link" href="/projects?status=ALL&noclient=1">查看</Link> : "全部專案皆已對應客戶"} />
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {sortLink("revenue", "依營收")}{sortLink("recent", "依最近專案")}{sortLink("name", "依名稱")}
        <form className="ml-auto"><input type="hidden" name="sort" value={sort} /><input name="q" defaultValue={q} placeholder="搜尋名稱、別名、統編…" className="input w-56" /></form>
      </div>
      <Card pad={false} className="mb-6">
        {rows.length === 0 ? <Empty>尚無客戶，可用下方「匯入 CSV」批次建立</Empty> : (
          <table className="tbl">
            <thead><tr><th>客戶</th><th>統編</th><th>聯絡人</th><th className="text-right">專案</th><th className="text-right">帳上營收</th><th className="text-right">未收款</th><th>最近專案</th></tr></thead>
            <tbody>{rows.map(({ c, s }) => (
              <tr key={c.id}>
                <td><Link href={`/clients/${c.id}`} className="link">{c.name}</Link>{c.aliases && <div className="max-w-xs truncate text-xs text-slate-400">{c.aliases}</div>}</td>
                <td>{c.taxId}</td>
                <td className="text-xs">{c.contact}{c.phone && <div className="text-slate-500">{c.phone}</div>}</td>
                <td className="num">{s.projects}</td>
                <td className="num font-medium">{twd(s.revenue)}</td>
                <td className={`num ${s.outstanding ? "text-amber-700" : ""}`}>{s.outstanding ? twd(s.outstanding) : "—"}</td>
                <td className="text-xs">{date(s.last)}</td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </Card>
      <Card title="批次匯入 / 更新客戶（CSV）">
        <p className="mb-3 text-sm text-slate-500">第一列為欄位名稱：名稱、別名、統編、聯絡人、電話、Email、地址、備註（只有「名稱」必填）。同名客戶會更新；匯入後會依別名自動把專案與請款單歸給客戶。</p>
        <ClientCsvForm />
      </Card>
    </>
  );
}
