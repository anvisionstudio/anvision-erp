"use client";
import { useActionState } from "react";
import { importUpload, importDrive, type ImportState } from "@/app/actions/importer";
import { SubmitButton } from "@/components/client";

function Msg({ s }: { s: ImportState }) {
  if (!s) return null;
  return s.ok ? <p className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-800">✓ {s.ok}</p> : <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{s.error}</p>;
}

export function UploadForm() {
  const [s, action] = useActionState(importUpload, null);
  return (
    <form action={action} className="space-y-3">
      <input type="file" name="file" accept=".xlsx" required className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:text-brand-700" />
      <SubmitButton>上傳並匯入</SubmitButton>
      <Msg s={s} />
    </form>
  );
}

export function DriveForm({ link }: { link: string }) {
  const [s, action] = useActionState(importDrive, null);
  return (
    <form action={action} className="space-y-3">
      <input name="drive" defaultValue={link} placeholder="https://docs.google.com/spreadsheets/d/…" className="input" />
      <SubmitButton>立即從 Google Drive 同步</SubmitButton>
      <Msg s={s} />
    </form>
  );
}
