import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { twd, date, num } from "@/lib/format";
import { vendorLedger } from "@/lib/vendor-ledger";
import { deleteVendor } from "@/app/actions/purchasing";
import { PageHeader, Card, Empty, Badge, Stat, Tabs } from "@/components/ui";
import { ConfirmButton } from "@/components/client";
import { VendorForm } from "../form";

export default async function VendorDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  await requireUser("purchasing");
  const { id } = await params;
  const { tab = "ledger" } = await searchParams;
  const v = await db.vendor.findUnique({ where: { id }, include: { expenses: { orderBy: { date: "desc" } }, purchaseOrders: { orderBy: { orderDate: "desc" } } } });
  if (!v) notFound();
  const [{ stats, lines }, categories] = await Promise.all([
    vendorLedger(id),
    db.vendor.findMany({ select: { category: true }, distinct: ["category"] }).then((r) => r.map((x) => x.category).filter((c): c is string => !!c)),
  ]);
  const s = stats.get(id)!;
  const costLines = lines.filter((l) => l.account.type === "EXPENSE");
  const byProject = new Map<string, number>();
  for (const l of costLines) if (l.project && l.project !== "公司") byProject.set(l.project, (byProject.get(l.project) ?? 0) + l.debit - l.credit);
  const base = `/vendors/${id}?tab=`;
  return (
    <>
      <PageHeader title={v.name} back="/vendors"
        sub={<span className="flex flex-wrap items-center gap-2">{v.category && <Badge label={v.category} />}{v.aliases && <span className="text-xs">別名：{v.aliases}</span>}</span>}
        actions={<ConfirmButton action={deleteVendor.bind(null, v.id)} message="刪除此供應商？（帳上的日記簿資料不受影響）" className="btn-danger">刪除</ConfirmButton>} />
      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="帳上成本 / 費用" value={twd(s.spend)} />
        <Stat label="預付儲值餘額" value={s.prepaid ? twd(s.prepaid) : "—"} />
        <Stat label="相關分錄" value={num(s.lines)} hint={`最近 ${date(s.last)}`} />
        <Stat label="服務專案" value={s.projects.size} />
      </div>
      <Tabs active={tab} tabs={[
        { key: "ledger", label: `帳上交易 (${lines.length})`, href: base + "ledger" },
        { key: "projects", label: `依專案 (${byProject.size})`, href: base + "projects" },
        { key: "info", label: "基本資料", href: base + "info" },
      ]} />
      {tab === "ledger" && (
        <Card pad={false}>
          {lines.length === 0 ? <Empty>日記簿中沒有找到符合別名的分錄，請到「基本資料」設定帳上別名</Empty> : (
            <table className="tbl">
              <thead><tr><th>日期</th><th>傳票</th><th>科目</th><th>摘要</th><th>專案</th><th className="text-right">借方</th><th className="text-right">貸方</th></tr></thead>
              <tbody>{lines.map((l) => (
                <tr key={l.id}>
                  <td className="whitespace-nowrap">{date(l.entry.date)}</td>
                  <td><Link className="link font-mono text-xs" href={`/accounting?q=${encodeURIComponent(l.entry.number)}`}>{l.entry.number}</Link></td>
                  <td className="whitespace-nowrap text-xs">{l.account.code} {l.account.name}</td>
                  <td className="text-xs">{l.memo}</td>
                  <td className="text-xs">{l.project !== "公司" && l.project}</td>
                  <td className="num">{l.debit ? num(l.debit) : ""}</td>
                  <td className="num">{l.credit ? num(l.credit) : ""}</td>
                </tr>
              ))}</tbody>
            </table>
          )}
        </Card>
      )}
      {tab === "projects" && (
        <Card pad={false}>
          {byProject.size === 0 ? <Empty /> : (
            <table className="tbl">
              <thead><tr><th>專案</th><th className="text-right">成本</th></tr></thead>
              <tbody>{[...byProject.entries()].sort((a, b) => b[1] - a[1]).map(([p, amt]) => (
                <tr key={p}><td>{p}</td><td className="num">{twd(amt)}</td></tr>
              ))}</tbody>
            </table>
          )}
        </Card>
      )}
      {tab === "info" && <Card><VendorForm v={v} categories={categories} /></Card>}
    </>
  );
}
