import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { twd, date, totals } from "@/lib/format";
import { deleteClient } from "@/app/actions/sales";
import { PageHeader, Card, Badge, Empty } from "@/components/ui";
import { ConfirmButton } from "@/components/client";
import { ClientForm } from "../form";

export default async function ClientDetail({ params }: { params: Promise<{ id: string }> }) {
  await requireUser("sales");
  const { id } = await params;
  const c = await db.client.findUnique({
    where: { id },
    include: {
      quotes: { include: { items: true }, orderBy: { issueDate: "desc" } },
      projects: { orderBy: { createdAt: "desc" } },
      invoices: { include: { items: true }, orderBy: { issueDate: "desc" } },
    },
  });
  if (!c) notFound();
  const del = deleteClient.bind(null, c.id);
  return (
    <>
      <PageHeader title={c.name} sub={c.taxId ? `統編 ${c.taxId}` : undefined} back="/clients"
        actions={<>
          <Link href={`/quotes/new?clientId=${c.id}`} className="btn-primary">＋ 建立報價</Link>
          <ConfirmButton action={del} message="確定刪除此客戶？" className="btn-danger">刪除</ConfirmButton>
        </>} />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="基本資料" className="lg:col-span-2"><ClientForm c={c} /></Card>
        <div className="space-y-6">
          <Card title="專案" pad={false}>
            {c.projects.length === 0 ? <Empty /> : <table className="tbl"><tbody>{c.projects.map((p) => (
              <tr key={p.id}><td><Link className="link" href={`/projects/${p.id}`}>{p.name}</Link></td><td className="text-right"><Badge status={p.status} /></td></tr>
            ))}</tbody></table>}
          </Card>
          <Card title="報價單" pad={false}>
            {c.quotes.length === 0 ? <Empty /> : <table className="tbl"><tbody>{c.quotes.map((q) => (
              <tr key={q.id}><td><Link className="link" href={`/quotes/${q.id}`}>{q.number}</Link><div className="text-xs text-slate-500">{q.title}</div></td><td className="num">{twd(totals(q.items, q.taxRate).total)}</td><td><Badge status={q.status} /></td></tr>
            ))}</tbody></table>}
          </Card>
          <Card title="請款單" pad={false}>
            {c.invoices.length === 0 ? <Empty /> : <table className="tbl"><tbody>{c.invoices.map((i) => (
              <tr key={i.id}><td><Link className="link" href={`/invoices/${i.id}`}>{i.number}</Link><div className="text-xs text-slate-500">{date(i.issueDate)}</div></td><td className="num">{twd(totals(i.items, i.taxRate).total)}</td><td><Badge status={i.status} /></td></tr>
            ))}</tbody></table>}
          </Card>
        </div>
      </div>
    </>
  );
}
