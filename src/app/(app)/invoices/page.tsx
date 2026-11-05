import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { twd, date } from "@/lib/format";
import { invoiceAmounts } from "@/lib/reports";
import { PageHeader, Card, Badge, Empty, Tabs, Stat } from "@/components/ui";
import { FilterBar } from "@/components/filters";
import { dateRange, href, pick } from "@/lib/filters";

const TABS = [["OPEN", "未收款"], ["DRAFT", "草稿"], ["PAID", "已付清"], ["VOID", "作廢"], ["ALL", "全部"]];

export default async function Invoices({ searchParams }: { searchParams: Promise<{ status?: string; q?: string; client?: string; project?: string; from?: string; to?: string; due?: string }> }) {
  await requireUser("finance");
  const sp = await searchParams;
  const { status = "OPEN" } = sp;
  const f = pick(sp, ["q", "client", "project", "from", "to", "due"]);
  const [clients, projects] = await Promise.all([
    db.client.findMany({ where: { invoices: { some: {} } }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.project.findMany({ where: { invoices: { some: {} }, ...(f.client ? { clientId: f.client } : {}) }, orderBy: { createdAt: "desc" }, select: { id: true, name: true } }),
  ]);
  const where = {
    ...(status === "ALL" ? {} : status === "OPEN" ? { status: { in: ["ISSUED", "PARTIAL"] } } : { status }),
    ...(f.client ? { clientId: f.client } : {}),
    ...(f.project ? { projectId: f.project } : {}),
    ...(dateRange(f.from, f.to) ? { issueDate: dateRange(f.from, f.to) } : {}),
    ...(f.due === "overdue" ? { dueDate: { lt: new Date() }, status: { in: ["ISSUED", "PARTIAL"] } } : f.due === "30" ? { dueDate: { gte: new Date(), lt: new Date(Date.now() + 30 * 864e5) } } : {}),
    ...(f.q ? { OR: [{ number: { contains: f.q } }, { gui: { contains: f.q } }, { client: { name: { contains: f.q } } }, { project: { name: { contains: f.q } } }] } : {}),
  };
  const invs = await db.invoice.findMany({ where, include: { client: true, project: true, items: true, payments: true }, orderBy: { issueDate: "desc" } });
  const rows = invs.map((i) => ({ i, a: invoiceAmounts(i) }));
  const now = new Date();
  const outstanding = rows.reduce((s, r) => s + (["ISSUED", "PARTIAL"].includes(r.i.status) ? r.a.balance : 0), 0);
  return (
    <>
      <PageHeader title="請款 / 應收帳款" actions={<Link href="/invoices/new" className="btn-primary">＋ 新增請款單</Link>} />
      {status === "OPEN" && (
        <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-3">
          <Stat label="未收款金額" value={twd(outstanding)} />
          <Stat label="逾期張數" value={rows.filter((r) => r.i.dueDate && r.i.dueDate < now).length} tone="bad" />
        </div>
      )}
      <Tabs active={status} tabs={TABS.map(([k, l]) => ({ key: k, label: l, href: href("/invoices", f, { status: k }) }))} />
      <FilterBar path="/invoices" values={f} keep={{ status }} fields={[
        { type: "search", name: "q", label: "搜尋", placeholder: "單號、發票號碼、客戶、專案…" },
        { type: "select", name: "client", label: "客戶", options: clients.map((c) => ({ value: c.id, label: c.name })) },
        { type: "select", name: "project", label: "專案", options: projects.map((p) => ({ value: p.id, label: p.name })) },
        { type: "select", name: "due", label: "到期", options: [{ value: "overdue", label: "已逾期" }, { value: "30", label: "30 天內到期" }] },
        { type: "date", name: "from", label: "開立日（起）" },
        { type: "date", name: "to", label: "開立日（迄）" },
      ]} />
      <Card pad={false}>
        {rows.length === 0 ? <Empty /> : (
          <table className="tbl">
            <thead><tr><th>單號</th><th>發票號碼</th><th>客戶 / 專案</th><th>開立日</th><th>到期日</th><th className="text-right">總計</th><th className="text-right">未收</th><th>狀態</th></tr></thead>
            <tbody>{rows.map(({ i, a }) => (
              <tr key={i.id}>
                <td><Link href={`/invoices/${i.id}`} className="link">{i.number}</Link></td>
                <td className="font-mono text-xs">{i.gui}</td>
                <td>{i.client.name}<div className="text-xs text-ink-muted">{i.project?.name}</div></td>
                <td>{date(i.issueDate)}</td>
                <td className={i.dueDate && i.dueDate < now && a.balance > 0 && i.status !== "DRAFT" ? "font-medium text-danger" : ""}>{date(i.dueDate)}</td>
                <td className="num">{twd(a.total)}</td>
                <td className="num">{i.status === "VOID" ? "—" : twd(a.balance)}</td>
                <td><Badge status={i.status} /></td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </Card>
    </>
  );
}
