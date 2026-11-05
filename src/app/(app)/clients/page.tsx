import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { twd, date } from "@/lib/format";
import { clientStats } from "@/lib/client-stats";
import { IMPORT_CLIENT } from "@/lib/client-match";
import { PageHeader, Card, Empty, Stat, Chip } from "@/components/ui";
import { ClientCsvForm } from "./csv";
import { FilterBar } from "@/components/filters";
import { href, pick } from "@/lib/filters";

export default async function Clients({ searchParams }: { searchParams: Promise<{ q?: string; sort?: string; has?: string; info?: string }> }) {
  await requireUser("sales");
  const sp = await searchParams;
  const { q, sort = "revenue" } = sp;
  const f = pick(sp, ["q", "has", "info"]);
  const [clients, stats, unassigned] = await Promise.all([
    db.client.findMany({
      where: q ? { OR: [{ name: { contains: q } }, { contact: { contains: q } }, { taxId: { contains: q } }, { aliases: { contains: q } }, { email: { contains: q } }, { phone: { contains: q } }] } : undefined,
      include: { _count: { select: { quotes: true, invoices: true } } },
    }),
    clientStats(),
    db.project.count({ where: { OR: [{ clientId: null }, { client: { name: IMPORT_CLIENT } }] } }),
  ]);
  const rows = clients
    .map((c) => ({ c, s: stats.get(c.id) ?? { projects: 0, revenue: 0, outstanding: 0, last: null } }))
    .filter(({ c, s }) => c.name !== IMPORT_CLIENT || s.outstanding > 0 || c._count.invoices > 0)
    .filter(({ s }) => (f.has === "outstanding" ? s.outstanding > 0 : f.has === "active" ? s.projects > 0 : f.has === "none" ? s.projects === 0 : true))
    .filter(({ c }) => (f.info === "missing" ? !c.taxId || !c.contact || !(c.phone || c.email) : f.info === "new" ? (c.notes ?? "").includes("新客戶") : true))
    .sort((a, b) => (sort === "name" ? a.c.name.localeCompare(b.c.name, "zh-TW") : sort === "recent" ? (b.s.last?.getTime() ?? 0) - (a.s.last?.getTime() ?? 0) : b.s.revenue - a.s.revenue));
  const total = rows.reduce((t, r) => t + r.s.revenue, 0);
  const outstanding = rows.reduce((t, r) => t + r.s.outstanding, 0);
  const sortLink = (k: string, label: string) => (
    <Chip href={href("/clients", f, { sort: k })} active={sort === k}>{label}</Chip>
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
      </div>
      <FilterBar path="/clients" values={f} keep={{ sort }} fields={[
        { type: "search", name: "q", label: "搜尋", placeholder: "名稱、別名、統編、聯絡人…" },
        { type: "select", name: "has", label: "往來", options: [{ value: "outstanding", label: "有未收款" }, { value: "active", label: "有專案" }, { value: "none", label: "尚無專案" }] },
        { type: "select", name: "info", label: "資料", options: [{ value: "missing", label: "缺統編或聯絡資料" }, { value: "new", label: "報價單匯入的新客戶" }] },
      ]} />
      <Card pad={false} className="mb-6">
        {rows.length === 0 ? <Empty>尚無客戶，可用下方「匯入 CSV」批次建立</Empty> : (
          <table className="tbl">
            <thead><tr><th>客戶</th><th>統編</th><th>聯絡人</th><th className="text-right">專案</th><th className="text-right">帳上營收</th><th className="text-right">未收款</th><th>最近專案</th></tr></thead>
            <tbody>{rows.map(({ c, s }) => (
              <tr key={c.id}>
                <td><Link href={`/clients/${c.id}`} className="link">{c.name}</Link>{c.aliases && <div className="max-w-xs truncate text-xs text-ink-muted">{c.aliases}</div>}</td>
                <td>{c.taxId}</td>
                <td className="text-xs">{c.contact}{c.phone && <div className="text-ink-muted">{c.phone}</div>}</td>
                <td className="num">{s.projects}</td>
                <td className="num font-medium">{twd(s.revenue)}</td>
                <td className={`num ${s.outstanding ? "text-accent" : ""}`}>{s.outstanding ? twd(s.outstanding) : "—"}</td>
                <td className="text-xs">{date(s.last)}</td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </Card>
      <Card title="批次匯入 / 更新客戶（CSV）">
        <p className="mb-3 text-sm text-ink-muted">第一列為欄位名稱：名稱、別名、統編、聯絡人、電話、Email、地址、網站、備註（只有「名稱」必填）。同名客戶會更新，空白欄位保留原資料；匯入後會依別名自動把專案與請款單歸給客戶。</p>
        <ClientCsvForm />
      </Card>
    </>
  );
}
