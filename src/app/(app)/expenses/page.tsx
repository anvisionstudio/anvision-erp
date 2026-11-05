import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { twd, date, isoDate } from "@/lib/format";
import { saveExpense, payExpense, deleteExpense } from "@/app/actions/finance";
import { resolveAccount, ACC } from "@/lib/ledger";
import { PageHeader, Card, Badge, Empty, Tabs, Field, Select, Stat, statusOptions } from "@/components/ui";
import { ConfirmButton, SubmitButton } from "@/components/client";
import { FilterBar } from "@/components/filters";
import { dateRange, href, pick } from "@/lib/filters";

export default async function Expenses({ searchParams }: { searchParams: Promise<{ status?: string; new?: string; edit?: string; projectId?: string; month?: string; q?: string; vendor?: string; project?: string; account?: string; from?: string; to?: string }> }) {
  await requireUser("finance");
  const sp = await searchParams;
  const status = sp.status ?? "UNPAID";
  const f = pick(sp, ["q", "vendor", "project", "account", "month", "from", "to"]);
  const mStart = sp.month ? new Date(sp.month + "-01") : null;
  const mEnd = mStart ? new Date(mStart.getFullYear(), mStart.getMonth() + 1, 1) : null;
  const [expenses, vendors, projects, accounts, editing] = await Promise.all([
    db.expense.findMany({
      where: {
        ...(status === "ALL" ? {} : { status }), ...(mStart && mEnd ? { date: { gte: mStart, lt: mEnd } } : {}),
        ...(f.vendor ? { vendorId: f.vendor } : {}), ...(f.project ? { projectId: f.project } : {}), ...(f.account ? { accountId: f.account } : {}),
        ...(dateRange(f.from, f.to) ? { date: dateRange(f.from, f.to) } : {}),
        ...(f.q ? { OR: [{ description: { contains: f.q } }, { vendor: { name: { contains: f.q } } }, { project: { name: { contains: f.q } } }] } : {}),
      },
      include: { vendor: true, project: true, account: true }, orderBy: { date: "desc" },
    }),
    db.vendor.findMany({ orderBy: { name: "asc" } }),
    db.project.findMany({ where: { status: { not: "CANCELLED" } }, orderBy: { createdAt: "desc" } }),
    db.account.findMany({ where: { active: true, type: { in: ["EXPENSE", "ASSET"] } }, orderBy: { code: "asc" } }),
    sp.edit ? db.expense.findUnique({ where: { id: sp.edit } }) : Promise.resolve(null),
  ]);
  const showForm = sp.new || editing;
  const e = editing;
  const unpaid = expenses.filter((x) => x.status === "UNPAID").reduce((s, x) => s + x.amount + x.tax, 0);
  const defaultAcc = (await resolveAccount(db, ACC.MISC))?.id;

  return (
    <>
      <PageHeader title="費用 / 應付帳款" sub="供應商帳單、外包、日常支出" actions={<Link href="/expenses?new=1" className="btn-primary">＋ 新增費用</Link>} />
      {showForm && (
        <Card title={e ? "編輯費用" : "新增費用"} className="mb-6">
          <form action={saveExpense} className="grid gap-4 md:grid-cols-4">
            {e && <input type="hidden" name="id" value={e.id} />}
            <Field label="日期"><input type="date" name="date" defaultValue={isoDate(e?.date ?? new Date())} className="input" /></Field>
            <Field label="說明 *" className="md:col-span-3"><input name="description" required defaultValue={e?.description} className="input" placeholder="例如：攝影外包、Adobe 年費、11 月房租" /></Field>
            <Field label="會計科目 *"><Select name="accountId" required defaultValue={e?.accountId ?? defaultAcc} options={accounts.map((a) => ({ value: a.id, label: `${a.code} ${a.name}` }))} /></Field>
            <Field label="供應商"><Select name="vendorId" placeholder="（無）" defaultValue={e?.vendorId} options={vendors.map((v) => ({ value: v.id, label: v.name }))} /></Field>
            <Field label="歸屬專案"><Select name="projectId" placeholder="（公司費用）" defaultValue={e?.projectId ?? sp.projectId} options={projects.map((p) => ({ value: p.id, label: `${p.code} ${p.name}` }))} /></Field>
            <Field label="發票 / 收據號碼"><input name="receiptNo" defaultValue={e?.receiptNo ?? ""} className="input" /></Field>
            <Field label="金額（未稅）*"><input type="number" name="amount" required defaultValue={e?.amount} className="input" /></Field>
            <Field label="進項稅額"><input type="number" name="tax" defaultValue={e?.tax ?? 0} className="input" /></Field>
            <Field label="付款期限"><input type="date" name="dueDate" defaultValue={isoDate(e?.dueDate)} className="input" /></Field>
            <Field label="狀態"><Select name="status" defaultValue={e?.status ?? "UNPAID"} options={statusOptions(["UNPAID", "PAID"])} /></Field>
            <div className="flex gap-2 md:col-span-4"><SubmitButton>儲存</SubmitButton><Link href="/expenses" className="btn-secondary">取消</Link></div>
          </form>
        </Card>
      )}
      <div className="mb-4 grid grid-cols-2 gap-4 md:grid-cols-4"><Stat label="列表中未付金額（含稅）" value={twd(unpaid)} /></div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Tabs active={status} tabs={[["UNPAID", "未付款"], ["PAID", "已付款"], ["ALL", "全部"]].map(([k, l]) => ({ key: k, label: l, href: href("/expenses", f, { status: k }) }))} />
      </div>
      <FilterBar path="/expenses" values={f} keep={{ status }} fields={[
        { type: "search", name: "q", label: "搜尋", placeholder: "說明、供應商、專案…" },
        { type: "select", name: "vendor", label: "供應商", options: vendors.map((v) => ({ value: v.id, label: v.name })) },
        { type: "select", name: "project", label: "專案", options: projects.map((p) => ({ value: p.id, label: p.name })) },
        { type: "select", name: "account", label: "科目", options: accounts.map((a) => ({ value: a.id, label: `${a.code} ${a.name}` })) },
        { type: "month", name: "month", label: "月份" },
        { type: "date", name: "from", label: "日期（起）" },
        { type: "date", name: "to", label: "日期（迄）" },
      ]} />
      <Card pad={false}>
        {expenses.length === 0 ? <Empty /> : (
          <table className="tbl">
            <thead><tr><th>日期</th><th>說明</th><th>科目</th><th>供應商 / 專案</th><th className="text-right">未稅</th><th className="text-right">稅額</th><th>到期</th><th>狀態</th><th /></tr></thead>
            <tbody>{expenses.map((x) => (
              <tr key={x.id}>
                <td>{date(x.date)}</td>
                <td>{x.description}<div className="text-xs text-ink-muted">{x.receiptNo}</div></td>
                <td className="text-xs">{x.account.code} {x.account.name}</td>
                <td>{x.vendor?.name}<div className="text-xs text-ink-muted">{x.project?.name}</div></td>
                <td className="num">{twd(x.amount)}</td><td className="num">{twd(x.tax)}</td>
                <td className={x.status === "UNPAID" && x.dueDate && x.dueDate < new Date() ? "text-danger" : ""}>{date(x.dueDate)}</td>
                <td><Badge status={x.status} /></td>
                <td className="whitespace-nowrap text-right">
                  {x.status === "UNPAID" && <ConfirmButton action={payExpense.bind(null, x.id)} message="標記為已付款？將自動產生付款傳票。" className="btn-secondary btn-sm">付款</ConfirmButton>}{" "}
                  <Link href={`/expenses?edit=${x.id}&status=${status}`} className="btn-secondary btn-sm">編輯</Link>{" "}
                  <ConfirmButton action={deleteExpense.bind(null, x.id)} message="刪除此費用與相關傳票？">✕</ConfirmButton>
                </td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </Card>
    </>
  );
}
