import Link from "next/link";
import type { ReactNode } from "react";
import { STATUS } from "@/lib/format";

export function PageHeader({ title, sub, actions, back }: { title: string; sub?: ReactNode; actions?: ReactNode; back?: string }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        {back && (
          <Link href={back} className="no-print mb-1 inline-block text-xs text-slate-500 hover:text-slate-800">
            ← 返回
          </Link>
        )}
        <h1>{title}</h1>
        {sub && <div className="mt-1 text-sm text-slate-500">{sub}</div>}
      </div>
      {actions && <div className="no-print flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ title, actions, children, className = "", pad = true }: { title?: string; actions?: ReactNode; children: ReactNode; className?: string; pad?: boolean }) {
  return (
    <section className={`card ${className}`}>
      {title && (
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <h2>{title}</h2>
          {actions}
        </div>
      )}
      <div className={pad ? "p-4" : "overflow-x-auto"}>{children}</div>
    </section>
  );
}

const TONE: Record<string, string> = {
  gray: "bg-slate-100 text-slate-600",
  blue: "bg-blue-50 text-blue-700",
  green: "bg-emerald-50 text-emerald-700",
  amber: "bg-amber-50 text-amber-700",
  red: "bg-red-50 text-red-700",
};
export function Badge({ status, label, tone }: { status?: string; label?: string; tone?: string }) {
  const s = status ? STATUS[status] : undefined;
  return (
    <span className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${TONE[tone ?? s?.tone ?? "gray"]}`}>
      {label ?? s?.label ?? status}
    </span>
  );
}

export function Stat({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: ReactNode; tone?: "good" | "bad" }) {
  return (
    <div className="card p-4">
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className={`mt-1 text-2xl font-semibold tabular-nums ${tone === "good" ? "text-emerald-600" : tone === "bad" ? "text-red-600" : "text-slate-900"}`}>{value}</div>
      {hint && <div className="mt-1 text-xs text-slate-500">{hint}</div>}
    </div>
  );
}

export function Empty({ children = "目前沒有資料" }: { children?: ReactNode }) {
  return <div className="px-4 py-10 text-center text-sm text-slate-400">{children}</div>;
}

export function Field({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="label">{label}</span>
      {children}
    </label>
  );
}

type Opt = { value: string; label: string };
export function Select({ name, options, defaultValue, placeholder, required }: { name: string; options: Opt[]; defaultValue?: string | null; placeholder?: string; required?: boolean }) {
  return (
    <select name={name} defaultValue={defaultValue ?? ""} className="input" required={required}>
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

export const statusOptions = (keys: string[]) => keys.map((k) => ({ value: k, label: STATUS[k]?.label ?? k }));

export function Tabs({ tabs, active }: { tabs: { href: string; label: string; key: string }[]; active: string }) {
  return (
    <div className="no-print mb-4 flex gap-1 border-b border-slate-200">
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          className={`-mb-px border-b-2 px-3 py-2 text-sm ${t.key === active ? "border-brand-600 font-medium text-brand-700" : "border-transparent text-slate-500 hover:text-slate-800"}`}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}
