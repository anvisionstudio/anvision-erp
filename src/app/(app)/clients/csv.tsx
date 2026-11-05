"use client";
import { useActionState } from "react";
import { importClientsCsv, type ClientCsvState } from "@/app/actions/sales";
import { SubmitButton } from "@/components/client";

export function ClientCsvForm() {
  const [s, action] = useActionState<ClientCsvState, FormData>(importClientsCsv, null);
  return (
    <form action={action} className="flex flex-wrap items-center gap-3">
      <input type="file" name="file" accept=".csv,text/csv" required className="text-sm file:mr-3 file:rounded-md file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:text-brand-700" />
      <SubmitButton className="btn-secondary">匯入 CSV</SubmitButton>
      {s && <span className={`text-sm ${s.ok ? "text-emerald-700" : "text-red-600"}`}>{s.ok ?? s.error}</span>}
    </form>
  );
}
