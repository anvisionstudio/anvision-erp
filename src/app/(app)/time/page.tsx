import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { date, num, isoDate } from "@/lib/format";
import { saveTime, deleteTime } from "@/app/actions/projects";
import { PageHeader, Card, Empty, Field, Select } from "@/components/ui";
import { ConfirmButton, SubmitButton } from "@/components/client";

export default async function TimePage({ searchParams }: { searchParams: Promise<{ week?: string; user?: string }> }) {
  const me = await requireUser("time");
  const sp = await searchParams;
  const canAll = me.role !== "STAFF";
  const userId = canAll && sp.user ? sp.user : me.id;
  const ref = sp.week ? new Date(sp.week) : new Date();
  const start = new Date(ref); start.setDate(ref.getDate() - ((ref.getDay() + 6) % 7)); start.setHours(0, 0, 0, 0);
  const end = new Date(start); end.setDate(start.getDate() + 7);
  const prev = new Date(start); prev.setDate(start.getDate() - 7);
  const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d; });

  const [entries, projects, users] = await Promise.all([
    db.timeEntry.findMany({ where: { userId, date: { gte: start, lt: end } }, include: { project: true }, orderBy: { date: "asc" } }),
    db.project.findMany({ where: { status: { in: ["ACTIVE", "PLANNING"] } }, orderBy: { name: "asc" } }),
    canAll ? db.user.findMany({ where: { active: true }, orderBy: { name: "asc" } }) : Promise.resolve([]),
  ]);
  const byProject = new Map<string, { name: string; days: number[] }>();
  for (const e of entries) {
    const row = byProject.get(e.projectId) ?? { name: e.project.name, days: Array(7).fill(0) };
    row.days[(e.date.getDay() + 6) % 7] += e.hours;
    byProject.set(e.projectId, row);
  }
  const dayTotals = days.map((_, i) => [...byProject.values()].reduce((s, r) => s + r.days[i], 0));
  const q = (w: Date) => `/time?week=${isoDate(w)}${canAll && sp.user ? `&user=${sp.user}` : ""}`;
  const W = ["一", "二", "三", "四", "五", "六", "日"];

  return (
    <>
      <PageHeader title="工時紀錄" sub={`${date(start)} – ${date(new Date(end.getTime() - 864e5))}　合計 ${num(dayTotals.reduce((a, b) => a + b, 0), 2)} 小時`}
        actions={<>
          {canAll && (
            <form className="flex gap-2"><input type="hidden" name="week" value={isoDate(start)} />
              <Select name="user" defaultValue={userId} options={users.map((u) => ({ value: u.id, label: u.name }))} /><button className="btn-secondary">切換</button></form>
          )}
          <Link className="btn-secondary" href={q(prev)}>← 上週</Link>
          <Link className="btn-secondary" href="/time">本週</Link>
          <Link className="btn-secondary" href={q(end)}>下週 →</Link>
        </>} />

      <Card title="登錄工時" className="mb-6">
        <form action={saveTime} className="grid gap-3 md:grid-cols-6">
          {canAll && <input type="hidden" name="userId" value={userId} />}
          <Field label="專案 *" className="md:col-span-2"><Select name="projectId" required placeholder="選擇專案" options={projects.map((p) => ({ value: p.id, label: `${p.code} ${p.name}` }))} /></Field>
          <Field label="日期"><input name="date" type="date" defaultValue={isoDate(new Date())} className="input" /></Field>
          <Field label="時數 *"><input name="hours" type="number" step="0.25" required className="input" /></Field>
          <Field label="內容"><input name="note" className="input" /></Field>
          <div className="flex items-end"><SubmitButton>登錄</SubmitButton></div>
        </form>
      </Card>

      <Card title="週報表" pad={false} className="mb-6">
        {byProject.size === 0 ? <Empty>本週尚無工時</Empty> : (
          <table className="tbl">
            <thead><tr><th>專案</th>{days.map((d, i) => <th key={i} className="text-right">週{W[i]} {d.getMonth() + 1}/{d.getDate()}</th>)}<th className="text-right">合計</th></tr></thead>
            <tbody>
              {[...byProject.entries()].map(([pid, r]) => (
                <tr key={pid}><td><Link className="link" href={`/projects/${pid}?tab=time`}>{r.name}</Link></td>{r.days.map((h, i) => <td key={i} className="num">{h ? num(h, 2) : "·"}</td>)}<td className="num font-medium">{num(r.days.reduce((a, b) => a + b, 0), 2)}</td></tr>
              ))}
              <tr className="font-medium"><td>合計</td>{dayTotals.map((h, i) => <td key={i} className="num">{num(h, 2)}</td>)}<td className="num">{num(dayTotals.reduce((a, b) => a + b, 0), 2)}</td></tr>
            </tbody>
          </table>
        )}
      </Card>

      <Card title="明細" pad={false}>
        {entries.length === 0 ? <Empty /> : (
          <table className="tbl"><tbody>{entries.map((e) => (
            <tr key={e.id}><td>{date(e.date)}</td><td>{e.project.name}</td><td>{e.note}</td><td className="num">{num(e.hours, 2)} h</td>
              <td className="text-right"><ConfirmButton action={deleteTime.bind(null, e.id)} message="刪除這筆工時？">刪除</ConfirmButton></td></tr>
          ))}</tbody></table>
        )}
      </Card>
    </>
  );
}
