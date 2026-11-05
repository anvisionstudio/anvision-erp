import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { date } from "@/lib/format";
import { PRIORITY } from "@/lib/perm";
import { setTaskStatus } from "@/app/actions/projects";
import { PageHeader, Card, Badge, Empty, Tabs, Chip } from "@/components/ui";
import { ConfirmButton } from "@/components/client";

const NEXT: Record<string, string> = { TODO: "DOING", DOING: "REVIEW", REVIEW: "DONE" };
const NEXT_LABEL: Record<string, string> = { TODO: "開始進行", DOING: "送審", REVIEW: "完成" };

export default async function MyTasks({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const user = await requireUser("projects");
  const { show = "open" } = await searchParams;
  const now = new Date();
  const tasks = await db.task.findMany({
    where: { assigneeId: user.id, ...(show === "open" ? { status: { not: "DONE" } } : show === "done" ? { status: "DONE" } : {}) },
    include: { project: true, _count: { select: { comments: { where: { kind: "COMMENT" } } } } },
    orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
  });
  const overdue = (d: Date | null, s: string) => s !== "DONE" && !!d && d.getTime() < now.getTime() - 864e5;
  return (
    <>
      <PageHeader title="我的任務" sub={`${tasks.length} 項${show === "open" ? "未完成" : ""}・${tasks.filter((t) => overdue(t.dueDate, t.status)).length} 項逾期`} />
      <Tabs active="mine" tabs={[{ key: "mine", label: "我的任務", href: "/tasks" }, { key: "team", label: "團隊總覽", href: "/tasks/team" }, { key: "timeline", label: "時間軸", href: "/timeline?user=me" }]} />
      <div className="mb-4 flex flex-wrap gap-2">
        <Chip href="/tasks?show=open" active={show === "open"}>未完成</Chip>
        <Chip href="/tasks?show=done" active={show === "done"}>已完成</Chip>
        <Chip href="/tasks?show=all" active={show === "all"}>全部</Chip>
      </div>
      <Card pad={false} title="任務">
        {tasks.length === 0 ? <Empty>沒有任務</Empty> : (
          <table className="tbl">
            <thead><tr><th>任務</th><th>優先度</th><th>期間</th><th>狀態</th><th /></tr></thead>
            <tbody>{tasks.map((t) => {
              const pr = PRIORITY[t.priority] ?? PRIORITY.NORMAL;
              const late = overdue(t.dueDate, t.status);
              return (
                <tr key={t.id}>
                  <td>
                    <Link className="link" href={`/tasks/${t.id}`}>{t.title}</Link>
                    <div className="text-xs text-ink-muted">{t.project.name}{t._count.comments > 0 && `・${t._count.comments} 則留言`}</div>
                  </td>
                  <td><Badge label={pr.label} tone={pr.tone} /></td>
                  <td className={`whitespace-nowrap ${late ? "font-medium text-danger" : ""}`}>{t.startDate ? `${date(t.startDate)} – ` : ""}{date(t.dueDate)}{late && <span className="ml-1 text-xs">逾期</span>}</td>
                  <td><Badge status={t.status} /></td>
                  <td className="text-right">{NEXT[t.status] && <ConfirmButton action={setTaskStatus.bind(null, t.id, NEXT[t.status])} message={`將「${t.title}」標記為${NEXT_LABEL[t.status]}？`} className="btn-secondary btn-sm">{NEXT_LABEL[t.status]}<ArrowRight className="h-3.5 w-3.5" aria-hidden /></ConfirmButton>}</td>
                </tr>
              );
            })}</tbody>
          </table>
        )}
      </Card>
    </>
  );
}
