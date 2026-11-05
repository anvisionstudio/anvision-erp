import Link from "next/link";
import { Fragment } from "react";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { date, num } from "@/lib/format";
import { deleteJournal } from "@/app/actions/finance";
import { PageHeader, Card, Badge, Empty } from "@/components/ui";
import { ConfirmButton } from "@/components/client";
import { FilterBar } from "@/components/filters";

const SRC: Record<string, string> = { IMPORT: "Excel", MANUAL: "手動", INVOICE: "請款", PAYMENT: "收款", EXPENSE: "費用", EXPENSE_PAY: "付款", PAYROLL: "薪資", INVENTORY: "庫存" };

export default async function Journal({ searchParams }: { searchParams: Promise<{ q?: string; from?: string; to?: string; account?: string }> }) {
  await requireUser("finance");
  const sp = await searchParams;
  const accounts = await db.account.findMany({ orderBy: { code: "asc" } });
  const entries = await db.journalEntry.findMany({
    where: {
      ...(sp.q ? { OR: [{ number: { contains: sp.q } }, { memo: { contains: sp.q } }, { lines: { some: { OR: [{ project: { contains: sp.q } }, { memo: { contains: sp.q } }] } } }] } : {}),
      ...(sp.from || sp.to ? { date: { gte: sp.from ? new Date(sp.from) : undefined, lte: sp.to ? new Date(sp.to + "T23:59:59") : undefined } } : {}),
      ...(sp.account ? { lines: { some: { accountId: sp.account } } } : {}),
    },
    include: { lines: { include: { account: true } } },
    orderBy: [{ date: "desc" }, { number: "desc" }],
    take: sp.q || sp.account || sp.from ? 500 : 200,
  });
  return (
    <>
      <PageHeader title="傳票 / 總帳" sub="Excel 日記簿同步的傳票、ERP 自動產生的傳票與手動傳票" actions={<Link href="/accounting/new" className="btn-primary">＋ 手動傳票</Link>} />
      <FilterBar path="/accounting" values={{ q: sp.q, from: sp.from, to: sp.to, account: sp.account }} fields={[
        { type: "search", name: "q", label: "搜尋", placeholder: "傳票號 / 摘要 / 專案" },
        { type: "select", name: "account", label: "會計科目", all: "所有科目", options: accounts.map((a) => ({ value: a.id, label: `${a.code} ${a.name}` })) },
        { type: "date", name: "from", label: "日期（起）" },
        { type: "date", name: "to", label: "日期（迄）" },
      ]} />
      <Card pad={false}>
        {entries.length === 0 ? <Empty /> : (
          <table className="tbl">
            <thead><tr><th>日期</th><th>傳票號</th><th>來源</th><th>摘要 / 科目</th><th className="text-right">借方</th><th className="text-right">貸方</th><th /></tr></thead>
            <tbody>{entries.map((e) => (
              <Fragment key={e.id}>
                <tr className="bg-surface-muted">
                  <td className="font-medium">{date(e.date)}</td><td className="font-mono text-xs">{e.number}</td>
                  <td><Badge label={SRC[e.source] ?? e.source} tone={e.source === "MANUAL" ? "gray" : e.source === "IMPORT" ? "green" : "blue"} /></td>
                  <td colSpan={3} className="font-medium">
                    {e.memo}
                    {Math.abs(e.lines.reduce((s, l) => s + l.debit - l.credit, 0)) > 0.5 && <span className="ml-2"><Badge label="借貸不平" tone="red" /></span>}
                  </td>
                  <td className="text-right">{e.source === "MANUAL" && <ConfirmButton action={deleteJournal.bind(null, e.id)} message="刪除此傳票？">✕</ConfirmButton>}</td>
                </tr>
                {e.lines.map((l) => (
                  <tr key={l.id}>
                    <td /><td /><td />
                    <td className={l.credit ? "pl-10" : "pl-4"}>{l.account.code} {l.account.name}{l.memo && <span className="text-xs text-ink-muted">　{l.memo}</span>}{l.project && l.project !== "公司" && <span className="ml-2 rounded bg-brand-50 px-1.5 text-xs text-brand-700">{l.project}</span>}</td>
                    <td className="num">{l.debit ? num(l.debit) : ""}</td><td className="num">{l.credit ? num(l.credit) : ""}</td><td />
                  </tr>
                ))}
              </Fragment>
            ))}</tbody>
          </table>
        )}
      </Card>
    </>
  );
}
