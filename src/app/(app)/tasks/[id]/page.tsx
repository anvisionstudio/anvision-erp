import Link from "next/link";
import { notFound } from "next/navigation";
import { Activity, MessageSquare, ShieldCheck, ListTree } from "lucide-react";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { date, isoDate, num } from "@/lib/format";
import { canManageProject, canUpdateTask, PRIORITY, PRIORITY_OPTIONS, signActions, SIGN_LABEL, type SignAction } from "@/lib/perm";
import { saveTask, addTaskComment, deleteTaskComment, deleteTask, saveTime, deleteTime, signTaskForm } from "@/app/actions/projects";
import { PageHeader, Card, Badge, Field, Select, Empty, statusOptions } from "@/components/ui";
import { ConfirmButton, SubmitButton } from "@/components/client";

const when = (d: Date) => d.toLocaleString("zh-TW", { timeZone: "Asia/Taipei", hour12: false, month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });

export default async function TaskPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireUser("projects");
  const { id } = await params;
  const t = await db.task.findUnique({
    where: { id },
    include: {
      project: { include: { client: true } }, assignee: true, createdBy: true,
      parent: { select: { id: true, title: true } },
      children: { include: { assignee: { select: { name: true } } }, orderBy: [{ startDate: "asc" }, { createdAt: "asc" }] },
      approvals: { include: { user: { select: { name: true } } }, orderBy: { createdAt: "desc" } },
      comments: { include: { user: true }, orderBy: { createdAt: "asc" } },
      timeEntries: { include: { user: true }, orderBy: { date: "desc" } },
    },
  });
  if (!t) notFound();
  const manage = canManageProject(me, t.project);
  const update = canUpdateTask(me, t, t.project);
  const users = await db.user.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } });
  const hours = t.timeEntries.reduce((s, e) => s + e.hours, 0);
  const overdue = t.status !== "DONE" && t.dueDate && t.dueDate.getTime() < Date.now() - 864e5;
  const pr = PRIORITY[t.priority] ?? PRIORITY.NORMAL;
  const actions = signActions(me, t, t.project);
  const canAddChild = manage || t.assigneeId === me.id;
  const STATUS_TXT: Record<string, string> = { TODO: "待辦", DOING: "進行中", REVIEW: "審核中", DONE: "已完成" };

  return (
    <>
      <PageHeader
        title={t.title}
        back={t.parent ? `/tasks/${t.parent.id}` : `/projects/${t.projectId}`}
        sub={
          <span className="flex flex-wrap items-center gap-2">
            <Link className="link" href={`/projects/${t.projectId}`}>{t.project.name}</Link>
            {t.parent && <span>↳ <Link className="link" href={`/tasks/${t.parent.id}`}>{t.parent.title}</Link></span>}
            <Badge status={t.status} />
            <Badge label={`優先度：${pr.label}`} tone={pr.tone} />
            {overdue && <Badge label="已逾期" tone="red" />}
          </span>
        }
        actions={manage && <ConfirmButton action={deleteTask.bind(null, t.id)} message="刪除此任務？留言與活動紀錄會一併刪除。" className="btn-danger">刪除任務</ConfirmButton>}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="min-w-0 space-y-6 lg:col-span-2">
          <Card title="簽核" actions={<ShieldCheck className="h-5 w-5 text-ink-muted" aria-hidden />}>
            <p className="mb-3 text-sm">目前狀態：<Badge status={t.status} />{t.status === "REVIEW" && <span className="ml-2 text-ink-muted">等待專案經理核准</span>}</p>
            {actions.length > 0 ? (
              <form action={signTaskForm} className="space-y-3">
                <input type="hidden" name="id" value={t.id} />
                <Field label="簽核意見" help={actions.includes("REJECT") ? "退回時必填，會記錄在簽核紀錄中" : "選填，會記錄在簽核紀錄中"}><textarea name="note" rows={2} maxLength={1000} className="input" /></Field>
                <div className="flex flex-wrap gap-2">
                  {actions.map((a: SignAction) => (
                    <button key={a} name="action" value={a} className={`${a === "APPROVE" || a === "SUBMIT" ? "btn-primary" : a === "REJECT" ? "btn-danger" : "btn-secondary"}`}>{SIGN_LABEL[a]}</button>
                  ))}
                </div>
              </form>
            ) : <p className="text-sm text-ink-muted">您目前沒有可執行的簽核動作。負責人可送審，專案經理 / 專案負責人可核准、退回或重新開啟。</p>}
            <div className="mt-4 border-t border-line pt-3">
              <h3 className="mb-2 text-sm font-medium text-ink-muted">簽核紀錄（{t.approvals.length}）</h3>
              {t.approvals.length === 0 ? <p className="text-sm text-ink-muted">尚無簽核紀錄</p> : (
                <div className="-mx-4 overflow-x-auto" tabIndex={0} role="region" aria-label="簽核紀錄">
                  <table className="tbl">
                    <thead><tr><th>時間</th><th>簽核人</th><th>動作</th><th>狀態變化</th><th>意見</th></tr></thead>
                    <tbody>{t.approvals.map((a) => (
                      <tr key={a.id}>
                        <td className="whitespace-nowrap text-xs">{when(a.createdAt)}</td>
                        <td className="whitespace-nowrap font-medium">{a.user.name}</td>
                        <td><Badge label={SIGN_LABEL[a.action as SignAction] ?? a.action} tone={a.action === "APPROVE" ? "green" : a.action === "REJECT" ? "red" : a.action === "SUBMIT" ? "amber" : "gray"} /></td>
                        <td className="whitespace-nowrap text-xs">{STATUS_TXT[a.fromStatus] ?? a.fromStatus} → {STATUS_TXT[a.toStatus] ?? a.toStatus}</td>
                        <td className="text-sm">{a.note}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              )}
            </div>
          </Card>

          <Card title={`子項目（${t.children.length}）`} actions={<ListTree className="h-5 w-5 text-ink-muted" aria-hidden />}>
            {t.children.length === 0 ? <p className="text-sm text-ink-muted">尚無子項目</p> : (
              <ul className="divide-y divide-line">
                {t.children.map((c) => (
                  <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <Link href={`/tasks/${c.id}`} className={`link min-w-0 ${c.status === "DONE" ? "line-through opacity-70" : ""}`}>{c.title}</Link>
                    <span className="flex items-center gap-2 text-xs text-ink-muted">{c.assignee?.name ?? "未指派"}・{date(c.dueDate)}<Badge status={c.status} /></span>
                  </li>
                ))}
              </ul>
            )}
            {canAddChild && (
              <form action={saveTask} className="mt-3 flex flex-col gap-2 border-t border-line pt-3 sm:flex-row sm:items-end">
                <input type="hidden" name="projectId" value={t.projectId} />
                <input type="hidden" name="parentId" value={t.id} />
                {t.assigneeId && <input type="hidden" name="assigneeId" value={t.assigneeId} />}
                <input type="hidden" name="startDate" value={isoDate(t.startDate)} />
                <input type="hidden" name="dueDate" value={isoDate(t.dueDate)} />
                <Field label="新增子項目" className="flex-1"><input name="title" required className="input" placeholder="例如：分鏡腳本" /></Field>
                <SubmitButton className="btn-secondary">新增</SubmitButton>
              </form>
            )}
          </Card>

          <Card title="說明">
            {t.description ? <div className="whitespace-pre-wrap break-words text-sm leading-relaxed">{t.description}</div> : <p className="text-sm text-ink-muted">尚未填寫說明</p>}
          </Card>

          <Card title={`留言與活動（${t.comments.length}）`}>
            {t.comments.length === 0 ? <Empty>還沒有留言</Empty> : (
              <ol className="space-y-4">
                {t.comments.map((c) =>
                  c.kind === "ACTIVITY" ? (
                    <li key={c.id} className="flex items-start gap-2 text-sm text-ink-muted">
                      <Activity className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                      <span><span className="font-medium text-ink">{c.user?.name ?? "系統"}</span> {c.body}<span className="ml-2 text-xs">{when(c.createdAt)}</span></span>
                    </li>
                  ) : (
                    <li key={c.id} className="rounded-lg border border-line p-3">
                      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                        <span className="flex items-center gap-2 text-sm font-medium"><MessageSquare className="h-4 w-4 text-ink-muted" aria-hidden />{c.user?.name ?? "—"}<span className="text-xs font-normal text-ink-muted">{when(c.createdAt)}</span></span>
                        {(c.userId === me.id || me.role === "ADMIN") && <ConfirmButton action={deleteTaskComment.bind(null, c.id)} message="刪除這則留言？" label="刪除留言">✕</ConfirmButton>}
                      </div>
                      <div className="whitespace-pre-wrap break-words text-sm">{c.body}</div>
                    </li>
                  ),
                )}
              </ol>
            )}
            <form action={addTaskComment} className="mt-4 space-y-2 border-t border-line pt-4">
              <input type="hidden" name="taskId" value={t.id} />
              <Field label="新增留言"><textarea name="body" required rows={3} maxLength={4000} className="input" placeholder="回報進度、提出問題，或 @ 同事…" /></Field>
              <SubmitButton>送出留言</SubmitButton>
            </form>
          </Card>
        </div>

        <div className="min-w-0 space-y-6">
          <Card title="任務資訊">
            {update ? (
              <form action={saveTask} className="space-y-3">
                <input type="hidden" name="id" value={t.id} />
                <input type="hidden" name="projectId" value={t.projectId} />
                <Field label="標題 *"><input name="title" required defaultValue={t.title} className="input" /></Field>
                {!manage && t.status === "DONE" ? (
                  <div><span className="label">狀態</span><input type="hidden" name="status" value="DONE" /><Badge status="DONE" /><span className="help">已核准，如需修改請專案經理重新開啟</span></div>
                ) : (
                  <Field label="狀態" help={manage ? undefined : "完成需由專案經理在上方「簽核」核准"}><Select name="status" defaultValue={t.status} options={statusOptions(manage ? ["TODO", "DOING", "REVIEW", "DONE"] : ["TODO", "DOING", "REVIEW"])} /></Field>
                )}
                {manage ? (
                  <>
                    <Field label="負責人" help="只有專案經理或專案負責人可以指派"><Select name="assigneeId" placeholder="未指派" defaultValue={t.assigneeId} options={users.map((u) => ({ value: u.id, label: u.name }))} /></Field>
                    <Field label="優先度"><Select name="priority" defaultValue={t.priority} options={PRIORITY_OPTIONS} /></Field>
                  </>
                ) : (
                  <dl className="grid grid-cols-[5rem_1fr] gap-y-1 text-sm">
                    <dt className="text-ink-muted">負責人</dt><dd>{t.assignee?.name ?? "未指派"}</dd>
                    <dt className="text-ink-muted">優先度</dt><dd>{pr.label}</dd>
                  </dl>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <Field label="開始日"><input type="date" name="startDate" defaultValue={isoDate(t.startDate)} className="input" /></Field>
                  <Field label="截止日"><input type="date" name="dueDate" defaultValue={isoDate(t.dueDate)} className="input" /></Field>
                </div>
                {manage && <Field label="預估工時（小時）"><input type="number" inputMode="decimal" step="0.5" min={0} name="estimateHours" defaultValue={t.estimateHours} className="input" /></Field>}
                <Field label="說明"><textarea name="description" rows={4} defaultValue={t.description ?? ""} className="input" /></Field>
                <SubmitButton>儲存</SubmitButton>
              </form>
            ) : (
              <dl className="grid grid-cols-[5rem_1fr] gap-y-2 text-sm">
                <dt className="text-ink-muted">負責人</dt><dd>{t.assignee?.name ?? "未指派"}</dd>
                <dt className="text-ink-muted">期間</dt><dd>{date(t.startDate)} – {date(t.dueDate)}</dd>
                <dt className="text-ink-muted">預估</dt><dd>{num(t.estimateHours, 1)} 小時</dd>
              </dl>
            )}
            <p className="mt-3 text-xs text-ink-muted">由 {t.createdBy?.name ?? "—"} 建立於 {date(t.createdAt)}{t.completedAt && `・完成於 ${date(t.completedAt)}`}</p>
          </Card>

          <Card title={`工時（${num(hours, 1)} / ${num(t.estimateHours, 1)} 小時）`}>
            {t.estimateHours > 0 && (
              <div className="mb-3 h-2 rounded-full bg-surface-muted" role="progressbar" aria-valuemin={0} aria-valuemax={t.estimateHours} aria-valuenow={hours} aria-label="已用工時">
                <div className={`h-2 rounded-full ${hours > t.estimateHours ? "bg-danger" : "bg-primary"}`} style={{ width: `${Math.min(100, (hours / t.estimateHours) * 100)}%` }} />
              </div>
            )}
            {t.timeEntries.length > 0 && (
              <ul className="mb-4 divide-y divide-line text-sm">
                {t.timeEntries.map((e) => (
                  <li key={e.id} className="flex items-center justify-between gap-2 py-2">
                    <span className="min-w-0"><span className="font-medium">{e.user.name}</span> <span className="text-ink-muted">{date(e.date)}</span>{e.note && <span className="block truncate text-xs text-ink-muted">{e.note}</span>}</span>
                    <span className="flex items-center gap-1"><span className="num">{num(e.hours, 2)}h</span>
                      {(e.userId === me.id || manage) && <ConfirmButton action={deleteTime.bind(null, e.id)} message="刪除這筆工時？" label="刪除工時">✕</ConfirmButton>}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <form action={saveTime} className="grid grid-cols-2 gap-3">
              <input type="hidden" name="projectId" value={t.projectId} />
              <input type="hidden" name="taskId" value={t.id} />
              <input type="hidden" name="back" value={`/tasks/${t.id}`} />
              <Field label="日期"><input type="date" name="date" defaultValue={isoDate(new Date())} className="input" /></Field>
              <Field label="時數 *"><input type="number" inputMode="decimal" step="0.25" min={0.25} max={24} name="hours" required className="input" /></Field>
              <Field label="內容" className="col-span-2"><input name="note" className="input" /></Field>
              <div className="col-span-2"><SubmitButton className="btn-secondary">登錄工時</SubmitButton></div>
            </form>
          </Card>
        </div>
      </div>
    </>
  );
}
