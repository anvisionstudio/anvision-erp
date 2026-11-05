import Link from "next/link";
import { ArrowRight, ChevronLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser, can } from "@/lib/auth";
import { twd, date, num, isoDate, totals } from "@/lib/format";
import { projectProfit } from "@/lib/reports";
import { saveTask, setTaskStatus, deleteTask, saveTime, deleteProject } from "@/app/actions/projects";
import { PageHeader, Card, Badge, Empty, Stat, Field, Select, Tabs } from "@/components/ui";
import { ConfirmButton, SubmitButton } from "@/components/client";
import { ProjectForm } from "../form";

const FLOW = ["TODO", "DOING", "REVIEW", "DONE"];

export default async function ProjectDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const user = await requireUser("projects");
  const { id } = await params;
  const { tab = "tasks" } = await searchParams;
  const p = await db.project.findUnique({
    where: { id },
    include: {
      client: true, manager: true, quote: true,
      tasks: { include: { assignee: true }, orderBy: [{ status: "asc" }, { dueDate: "asc" }] },
      timeEntries: { include: { user: true }, orderBy: { date: "desc" } },
      invoices: { include: { items: true }, orderBy: { issueDate: "desc" } },
      expenses: { include: { vendor: true }, orderBy: { date: "desc" } },
    },
  });
  if (!p) notFound();
  const finance = can(user, "finance");
  const [profit] = finance ? await projectProfit(p.id) : [null];
  const [users, clients] = await Promise.all([db.user.findMany({ where: { active: true }, orderBy: { name: "asc" } }), db.client.findMany({ orderBy: { name: "asc" } })]);
  const hours = p.timeEntries.reduce((s, t) => s + t.hours, 0);
  const est = p.tasks.reduce((s, t) => s + t.estimateHours, 0);
  const base = `/projects/${p.id}?tab=`;
  const tabs = [
    { key: "tasks", label: `任務 (${p.tasks.length})`, href: base + "tasks" },
    { key: "time", label: `工時 (${num(hours, 1)}h)`, href: base + "time" },
    ...(finance ? [{ key: "finance", label: "財務", href: base + "finance" }] : []),
    ...(user.role !== "STAFF" ? [{ key: "settings", label: "專案設定", href: base + "settings" }] : []),
  ];

  return (
    <>
      <PageHeader title={p.name} back="/projects"
        sub={<span className="flex flex-wrap items-center gap-2"><span className="font-mono">{p.code}</span><Badge status={p.status} />{p.client && <Link className="link" href={`/clients/${p.client.id}`}>{p.client.name}</Link>}<span>負責人 {p.manager?.name ?? "—"}</span><span>交付 {date(p.dueDate)}</span></span>}
        actions={p.quote && <Link href={`/quotes/${p.quote.id}`} className="btn-secondary">報價單 {p.quote.number}</Link>} />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="合約金額" value={twd(p.budget)} />
        <Stat label="任務完成" value={`${p.tasks.filter((t) => t.status === "DONE").length} / ${p.tasks.length}`} />
        <Stat label="實際 / 預估工時" value={`${num(hours, 1)} / ${num(est, 1)}h`} tone={est > 0 && hours > est ? "bad" : undefined} />
        {profit ? <Stat label="專案毛利" value={twd(profit.profit)} hint={`毛利率 ${Math.round(profit.margin * 100)}%・已請款 ${Math.round(profit.billedPct * 100)}%`} tone={profit.profit >= 0 ? "good" : "bad"} />
          : <Stat label="專案成員" value={new Set(p.tasks.map((t) => t.assigneeId).filter(Boolean)).size} />}
      </div>

      <Tabs tabs={tabs} active={tab} />

      {tab === "tasks" && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {FLOW.map((s) => (
              <div key={s} className="rounded-lg bg-surface-muted p-2">
                <div className="mb-2 flex items-center justify-between px-1"><Badge status={s} /><span className="text-xs text-ink-muted">{p.tasks.filter((t) => t.status === s).length}</span></div>
                <div className="space-y-2">
                  {p.tasks.filter((t) => t.status === s).map((t) => {
                    const i = FLOW.indexOf(s);
                    return (
                      <div key={t.id} className="card p-3 text-sm">
                        <div className="font-medium">{t.title}</div>
                        <div className="mt-1 flex justify-between text-xs text-ink-muted">
                          <span>{t.assignee?.name ?? "未指派"}</span>
                          <span className={t.dueDate && t.dueDate < new Date() && s !== "DONE" ? "text-danger" : ""}>{t.dueDate ? date(t.dueDate) : ""}</span>
                        </div>
                        <div className="mt-2 flex gap-1">
                          {i > 0 && <ConfirmButton action={setTaskStatus.bind(null, t.id, FLOW[i - 1])} message="移回上一階段？" className="btn-secondary btn-sm" label="移回上一階段"><ChevronLeft className="h-4 w-4" aria-hidden /></ConfirmButton>}
                          {i < FLOW.length - 1 && <ConfirmButton action={setTaskStatus.bind(null, t.id, FLOW[i + 1])} message={`移到「${FLOW[i + 1]}」？`} className="btn-secondary btn-sm flex-1">下一步<ArrowRight className="h-3.5 w-3.5" aria-hidden /></ConfirmButton>}
                          {user.role !== "STAFF" && <ConfirmButton action={deleteTask.bind(null, t.id)} message="刪除此任務？">✕</ConfirmButton>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          <Card title="新增任務">
            <form action={saveTask} className="grid gap-3 md:grid-cols-6">
              <input type="hidden" name="projectId" value={p.id} />
              <Field label="任務名稱 *" className="md:col-span-2"><input name="title" required className="input" /></Field>
              <Field label="指派給"><Select name="assigneeId" placeholder="未指派" options={users.map((u) => ({ value: u.id, label: u.name }))} /></Field>
              <Field label="截止日"><input name="dueDate" type="date" className="input" /></Field>
              <Field label="預估工時"><input name="estimateHours" type="number" step="0.5" defaultValue={0} className="input" /></Field>
              <div className="flex items-end"><SubmitButton>新增</SubmitButton></div>
            </form>
          </Card>
        </div>
      )}

      {tab === "time" && (
        <div className="space-y-6">
          <Card title="登錄工時">
            <form action={saveTime} className="grid gap-3 md:grid-cols-6">
              <input type="hidden" name="projectId" value={p.id} />
              <input type="hidden" name="back" value={`/projects/${p.id}`} />
              {user.role !== "STAFF" && <Field label="成員"><Select name="userId" defaultValue={user.id} options={users.map((u) => ({ value: u.id, label: u.name }))} /></Field>}
              <Field label="日期"><input name="date" type="date" defaultValue={isoDate(new Date())} className="input" /></Field>
              <Field label="時數"><input name="hours" type="number" step="0.25" required className="input" /></Field>
              <Field label="工作內容" className="md:col-span-2"><input name="note" className="input" /></Field>
              <div className="flex items-end"><SubmitButton>登錄</SubmitButton></div>
            </form>
          </Card>
          <Card pad={false}>
            {p.timeEntries.length === 0 ? <Empty /> : (
              <table className="tbl"><thead><tr><th>日期</th><th>成員</th><th>內容</th><th className="text-right">時數</th></tr></thead>
                <tbody>{p.timeEntries.map((t) => (<tr key={t.id}><td>{date(t.date)}</td><td>{t.user.name}</td><td>{t.note}</td><td className="num">{num(t.hours, 2)}</td></tr>))}</tbody></table>
            )}
          </Card>
        </div>
      )}

      {tab === "finance" && profit && (
        <div className="grid gap-6 lg:grid-cols-3">
          <Card title="損益試算">
            <dl className="space-y-2 text-sm">
              {[["合約金額（未稅）", p.budget], [profit.fromLedger ? "帳上收入" : "已請款（未稅）", profit.invoiced], [profit.fromLedger ? "帳上成本" : "直接費用 / 外包", -profit.expenses], [`人工成本（${num(profit.hours, 1)}h）`, -profit.labor]].map(([k, v]) => (
                <div key={k as string} className="flex justify-between"><dt className="text-ink-muted">{k}</dt><dd className="tabular-nums">{twd(v as number)}</dd></div>
              ))}
              <div className="flex justify-between border-t pt-2 font-semibold"><dt>毛利</dt><dd className={profit.profit >= 0 ? "text-success" : "text-danger"}>{twd(profit.profit)}</dd></div>
            </dl>
            <p className="mt-3 text-xs text-ink-muted">{profit.fromLedger ? `收入與直接成本取自 Excel 日記簿（專案：${p.ref}）。` : ""}人工成本 = 工時 × 員工資料中設定的「時薪成本」</p>
          </Card>
          <Card title="請款單" className="lg:col-span-2" pad={false} actions={<Link href={`/invoices/new?projectId=${p.id}`} className="btn-primary btn-sm">＋ 請款</Link>}>
            {p.invoices.length === 0 ? <Empty /> : <table className="tbl"><tbody>{p.invoices.map((i) => (
              <tr key={i.id}><td><Link className="link" href={`/invoices/${i.id}`}>{i.number}</Link></td><td>{date(i.issueDate)}</td><td className="num">{twd(totals(i.items, i.taxRate).total)}</td><td><Badge status={i.status} /></td></tr>
            ))}</tbody></table>}
          </Card>
          <Card title="專案費用" className="lg:col-span-3" pad={false} actions={<Link href={`/expenses?new=1&projectId=${p.id}`} className="btn-secondary btn-sm">＋ 費用</Link>}>
            {p.expenses.length === 0 ? <Empty /> : <table className="tbl"><tbody>{p.expenses.map((e) => (
              <tr key={e.id}><td>{date(e.date)}</td><td>{e.description}</td><td>{e.vendor?.name}</td><td className="num">{twd(e.amount)}</td><td><Badge status={e.status} /></td></tr>
            ))}</tbody></table>}
          </Card>
        </div>
      )}

      {tab === "settings" && user.role !== "STAFF" && (
        <Card title="專案設定" actions={<ConfirmButton action={deleteProject.bind(null, p.id)} message="確定刪除此專案？所有任務與工時將一併刪除。">刪除專案</ConfirmButton>}>
          <ProjectForm p={p} clients={clients} users={users} />
        </Card>
      )}
    </>
  );
}
