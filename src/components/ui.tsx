import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronLeft, Inbox } from "lucide-react";
import { STATUS } from "@/lib/format";

export function PageHeader({ title, sub, actions, back }: { title: string; sub?: ReactNode; actions?: ReactNode; back?: string }) {
  return (
    <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        {back && (
          <Link href={back} className="no-print -ml-1 mb-1 inline-flex min-h-touch items-center gap-0.5 rounded-md px-1 text-sm text-ink-muted hover:text-ink md:min-h-[1.75rem]">
            <ChevronLeft className="h-4 w-4" aria-hidden />返回
          </Link>
        )}
        <h1 className="break-words">{title}</h1>
        {sub && <div className="mt-1 text-sm text-ink-muted">{sub}</div>}
      </div>
      {actions && <div className="no-print flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ title, actions, children, className = "", pad = true }: { title?: string; actions?: ReactNode; children: ReactNode; className?: string; pad?: boolean }) {
  return (
    <section className={`card min-w-0 ${className}`}>
      {title && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
          <h2>{title}</h2>
          {actions}
        </div>
      )}
      {pad ? <div className="p-4">{children}</div> : <div className="overflow-x-auto" tabIndex={0} role="region" aria-label={title ?? "資料表"}>{children}</div>}
    </section>
  );
}

/** 狀態標籤：顏色之外一律帶文字，符合「不只用顏色傳達」 */
const TONE: Record<string, string> = {
  gray: "bg-surface-muted text-ink-muted ring-line",
  blue: "bg-primary-soft text-primary ring-primary/20",
  green: "bg-success-soft text-success ring-success/20",
  amber: "bg-accent-soft text-accent ring-accent/20",
  red: "bg-danger-soft text-danger ring-danger/20",
};
const DOT: Record<string, string> = { gray: "bg-ink-subtle", blue: "bg-primary", green: "bg-success", amber: "bg-accent", red: "bg-danger" };

/** 狀態標籤（Notion 風格：色點 + 文字）。dot={false} 可關閉色點 */
export function Badge({ status, label, tone, dot = true }: { status?: string; label?: string; tone?: string; dot?: boolean }) {
  const s = status ? STATUS[status] : undefined;
  const t = tone ?? s?.tone ?? "gray";
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${TONE[t]}`}>
      {dot && <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${DOT[t]}`} aria-hidden />}
      {label ?? s?.label ?? status}
    </span>
  );
}

export function Stat({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: ReactNode; tone?: "good" | "bad" }) {
  return (
    <div className="card min-w-0 p-4">
      <div className="text-xs font-medium text-ink-muted">{label}</div>
      <div className={`mt-1 break-words font-mono text-lg font-semibold tabular-nums md:text-xl ${tone === "good" ? "text-success" : tone === "bad" ? "text-danger" : "text-ink"}`}>{value}</div>
      {hint && <div className="mt-1 text-xs text-ink-muted">{hint}</div>}
    </div>
  );
}

export function Empty({ children = "目前沒有資料" }: { children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-10 text-center text-sm text-ink-muted">
      <Inbox className="h-6 w-6 text-ink-subtle" aria-hidden />
      {children}
    </div>
  );
}

/** 表單欄位：標籤永遠可見；必填顯示 *；可加說明文字 */
export function Field({ label, children, className = "", required, help }: { label: string; children: ReactNode; className?: string; required?: boolean; help?: ReactNode }) {
  const text = label.replace(/\s*\*$/, "");
  const req = required ?? /\*$/.test(label);
  return (
    <label className={`block min-w-0 ${className}`}>
      <span className="label">
        {text}
        {req && <span className="ml-0.5 text-danger" aria-hidden>*</span>}
        {req && <span className="sr-only">（必填）</span>}
      </span>
      {children}
      {help && <span className="help">{help}</span>}
    </label>
  );
}

type Opt = { value: string; label: string };
export function Select({ name, options, defaultValue, placeholder, required, id, label }: { name: string; options: Opt[]; defaultValue?: string | null; placeholder?: string; required?: boolean; id?: string; label?: string }) {
  return (
    <select id={id} aria-label={label} name={name} defaultValue={defaultValue ?? ""} className="input" required={required}>
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

export const statusOptions = (keys: string[]) => keys.map((k) => ({ value: k, label: STATUS[k]?.label ?? k }));

/** 分頁籤：手機可在列內左右滑動，不造成整頁橫向捲動 */
export function Tabs({ tabs, active }: { tabs: { href: string; label: string; key: string }[]; active: string }) {
  return (
    <nav aria-label="分頁" className="no-print -mx-4 mb-4 overflow-x-auto border-b border-line px-4 md:mx-0 md:px-0">
      <div className="flex min-w-max gap-1">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={t.href}
            aria-current={t.key === active ? "page" : undefined}
            className={`-mb-px inline-flex min-h-touch items-center whitespace-nowrap border-b-2 px-3 text-sm transition-colors duration-150 md:min-h-[2.5rem] ${
              t.key === active ? "border-primary font-medium text-primary" : "border-transparent text-ink-muted hover:text-ink"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}

/** 篩選膠囊（客戶 / 供應商分類、期間等） */
export function Chip({ href, active, children }: { href: string; active?: boolean; children: ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={`inline-flex min-h-[2.25rem] items-center rounded-full px-3 text-xs font-medium transition-colors duration-150 md:min-h-[1.75rem] ${
        active ? "bg-primary text-primary-on" : "bg-surface text-ink-muted ring-1 ring-inset ring-line hover:text-ink"
      }`}
    >
      {children}
    </Link>
  );
}
