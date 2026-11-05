import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { PageHeader, Card } from "@/components/ui";
import { MeetingForm } from "../form";

export default async function NewMeeting({ searchParams }: { searchParams: Promise<{ kind?: string; project?: string }> }) {
  await requireUser("projects");
  const sp = await searchParams;
  const projects = await db.project.findMany({ where: { status: { notIn: ["CANCELLED"] } }, orderBy: { createdAt: "desc" }, select: { id: true, name: true } });
  const note = sp.kind === "NOTE";
  return (
    <>
      <PageHeader title={note ? "快速做筆記" : "新增會議記錄"} back="/meetings" />
      <Card><MeetingForm m={{ kind: note ? "NOTE" : "MEETING", projectId: sp.project }} projects={projects} /></Card>
    </>
  );
}
