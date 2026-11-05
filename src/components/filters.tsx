"use client";
import Link from "next/link";
import { useRef } from "react";
import { Filter, Search, X } from "lucide-react";

type Opt = { value: string; label: string };
export type FilterField =
  | { type: "search"; name: string; label: string; placeholder?: string }
  | { type: "select"; name: string; label: string; options: Opt[]; all?: string }
  | { type: "date"; name: string; label: string }
  | { type: "month"; name: string; label: string };

/**
 * 清單篩選列：GET 表單，下拉 / 日期一改就套用，文字搜尋按 Enter 或「篩選」。
 * keep：要保留但不顯示的參數（例如目前的分頁籤 status）。
 */
export function FilterBar({ path, fields, values, keep = {} }: { path: string; fields: FilterField[]; values: Record<string, string | undefined>; keep?: Record<string, string | undefined> }) {
  const form = useRef<HTMLFormElement>(null);
  const submit = () => form.current?.requestSubmit();
  const active = fields.filter((f) => values[f.name]).length;
  const clear = new URLSearchParams(Object.entries(keep).filter(([, v]) => v) as [string, string][]);
  return (
    <form ref={form} method="get" action={path} role="search" onSubmit={(e) => {
      // 空白欄位不帶進網址，讓連結乾淨好分享
      const els = [...e.currentTarget.elements].filter((el): el is HTMLInputElement => "name" in el && !!(el as HTMLInputElement).name && !(el as HTMLInputElement).value);
      els.forEach((el) => (el.disabled = true));
      setTimeout(() => els.forEach((el) => (el.disabled = false)));
    }} aria-label="篩選清單" className="card mb-4 flex flex-wrap items-end gap-3 p-3">
      {Object.entries(keep).map(([k, v]) => v && <input key={k} type="hidden" name={k} value={v} />)}
      <span className="hidden items-center gap-1.5 self-center text-sm font-medium text-ink-muted sm:inline-flex"><Filter className="h-4 w-4" aria-hidden />篩選</span>
      {fields.map((f) => {
        const id = `f-${f.name}`;
        const v = values[f.name] ?? "";
        return (
          <label key={f.name} htmlFor={id} className={`flex min-w-0 flex-col gap-1 ${f.type === "search" ? "w-full sm:w-64" : "w-[calc(50%-0.375rem)] sm:w-auto sm:max-w-[15rem]"}`}>
            <span className="text-xs text-ink-muted">{f.label}</span>
            {f.type === "search" ? (
              <span className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" aria-hidden />
                <input id={id} type="search" name={f.name} defaultValue={v} placeholder={f.placeholder ?? "關鍵字…"} className="input pl-8" />
              </span>
            ) : f.type === "select" ? (
              <select id={id} name={f.name} defaultValue={v} onChange={submit} className={`input sm:min-w-[9rem] ${v ? "border-primary/60 bg-primary-soft/40" : ""}`}>
                <option value="">{f.all ?? "全部"}</option>
                {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            ) : (
              <input id={id} type={f.type} name={f.name} defaultValue={v} onChange={submit} className={`input ${v ? "border-primary/60 bg-primary-soft/40" : ""}`} />
            )}
          </label>
        );
      })}
      <div className="flex gap-2">
        <button className="btn-secondary">篩選</button>
        {active > 0 && (
          <Link href={`${path}${clear.size ? `?${clear}` : ""}`} className="btn-secondary text-ink-muted"><X className="h-4 w-4" aria-hidden />清除（{active}）</Link>
        )}
      </div>
    </form>
  );
}
