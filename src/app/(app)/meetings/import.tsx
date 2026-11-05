"use client";
import { useActionState } from "react";
import { importMeetingsCsv, runNotionSync, type MeetingImportState } from "@/app/actions/meetings";
import { SubmitButton } from "@/components/client";

const Msg = ({ s }: { s: MeetingImportState }) => s && <span role={s.ok ? "status" : "alert"} className={`text-sm ${s.ok ? "text-success" : "text-danger"}`}>{s.ok ?? s.error}</span>;

export function MeetingCsvForm() {
  const [s, action] = useActionState<MeetingImportState, FormData>(importMeetingsCsv, null);
  return (
    <form action={action} className="flex flex-wrap items-center gap-3">
      <input type="file" name="file" accept=".csv,text/csv" required aria-label="選擇 CSV 檔案" className="text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary-soft file:px-3 file:py-2 file:text-primary" />
      <SubmitButton className="btn-secondary">匯入 CSV</SubmitButton>
      <Msg s={s} />
    </form>
  );
}

export function NotionSyncButton() {
  const [s, action] = useActionState<MeetingImportState, FormData>(runNotionSync, null);
  return (
    <form action={action} className="flex flex-wrap items-center gap-3">
      <SubmitButton>立即同步</SubmitButton>
      <label className="flex min-h-touch items-center gap-2 text-sm md:min-h-0"><input type="checkbox" name="full" value="1" className="h-4 w-4" />全部重新抓取</label>
      <Msg s={s} />
    </form>
  );
}
