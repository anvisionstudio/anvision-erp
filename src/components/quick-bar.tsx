import Link from "next/link";
import type { LucideIcon } from "lucide-react";

export type QuickAction = { href: string; label: string; hint: string; icon: LucideIcon };
export type Shortcut = { href: string; label: string; count?: number; unit?: string };

/**
 * 儀表板的「新增」指令列與「前往」捷徑：
 * - 新增：一條分段的指令列（不是四張獨立卡片），每段＝動詞＋一句說明
 * - 前往：純文字連結，旁邊帶即時數量，點之前就知道裡面有什麼
 */
export function QuickBar({ actions, shortcuts }: { actions: QuickAction[]; shortcuts: Shortcut[] }) {
  return (
    <div className="mb-8">
      <h2 className="sr-only">快速新增</h2>
      <ul
        className={`grid overflow-hidden rounded-lg border border-line bg-surface grid-cols-2 ${actions.length >= 4 ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}
      >
        {actions.map(({ href, label, hint, icon: Icon }, i) => (
          <li
            key={href}
            className={[
              "min-w-0 border-line",
              i % 2 === 1 ? "border-l" : "", // 手機兩欄：右欄加左框線
              i >= 2 ? "border-t lg:border-t-0" : "", // 手機第二列加上框線
              i > 0 ? "lg:border-l" : "",
            ].join(" ")}
          >
            <Link
              href={href}
              className="group flex h-full min-h-touch items-center gap-3 px-4 py-3.5 sm:items-start transition-colors duration-150 hover:bg-primary-soft/60 focus-visible:bg-primary-soft/60"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary-soft text-primary transition-colors duration-150 group-hover:bg-primary group-hover:text-primary-on" aria-hidden>
                <Icon className="h-[1.125rem] w-[1.125rem]" />
              </span>
              <span className="min-w-0">
                <span className="block font-medium text-ink">{label}</span>
                <span className="mt-0.5 hidden text-xs text-ink-muted sm:block">{hint}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <nav aria-label="前往" className="mt-3 flex flex-wrap items-center gap-x-1 gap-y-1 text-sm">
        <span className="mr-1 text-ink-muted">前往</span>
        {shortcuts.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="inline-flex min-h-touch items-center gap-1.5 rounded-md px-2.5 font-medium text-ink hover:bg-surface-muted md:min-h-[2rem]"
          >
            {s.label}
            {s.count !== undefined && (
              <span className="rounded bg-surface-muted px-1.5 text-xs tabular-nums text-ink-muted">
                {s.count}
                {s.unit && <span className="sr-only">{s.unit}</span>}
              </span>
            )}
          </Link>
        ))}
      </nav>
    </div>
  );
}
