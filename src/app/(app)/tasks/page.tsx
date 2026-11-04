import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { date } from "@/lib/format";
import { setTaskStatus } from "@/app/actions/projects";
import { PageHeader, Card, Badge, Empty, Tabs } from "@/components/ui";
import { ConfirmButton } from "@/components/client";

export default async function MyTasks({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const user = await requireUser("projects");
  const { show = "open" } = await searchParams;
  const tasks = await db.task.findMany({
    where: { assigneeId: user.id, ...(show === "open" ? { status: { not: "DONE" } } : {}) },
    include: { project: true },
    orderBy: [{ dueDate: "asc" }],
  });
  const next: Record<string, string> = { TODO: "DOING", DOING: "REVIEW", REVIEW: "DONE" };
  return (
    <>
      <PageHeader title="我的任務" sub={`${tasks.length} 項`} />
      <Tabs active={show} tabs={[{ key: "open", label: "未完成", href: "/tasks?show=open" }, { key: "all", label: "全部", href: "/tasks?show=all" }]} />
      <Card pad={false}>
        {tasks.length === 0 ? <Empty>沒有任務</Empty> : (
          <table className="tbl">
            <thead><tr><th>任務</th><th>專案</th><th>截止日</th><th>狀態</th><th /></tr></thead>
            <tbody>{tasks.map((t) => (
              <tr key={t.id}>
                <td className="font-medium">{t.title}</td>
                <td><Link className="link" href={`/projects/${t.projectId}`}>{t.project.name}</Link></td>
                <td className={t.dueDate && t.dueDate < new Date() && t.status !== "DONE" ? "text-red-600" : ""}>{date(t.dueDate)}</td>
                <td><Badge status={t.status} /></td>
                <td className="text-right">{next[t.status] && <ConfirmButton action={setTaskStatus.bind(null, t.id, next[t.status])} message="推進到下一階段？" className="btn-secondary btn-sm">下一步 →</ConfirmButton>}</td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </Card>
    </>
  );
}
