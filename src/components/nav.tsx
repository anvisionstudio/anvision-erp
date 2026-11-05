"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  LayoutDashboard, Users, FileText, FolderKanban, ListChecks, Clock, Receipt, ArrowLeftRight, BookOpen, Hash,
  BarChart3, GanttChart, UsersRound, Truck, ShoppingCart, Package, UserRound, CalendarDays, Wallet, RefreshCw, Settings, History, NotebookText, Menu, X, LogOut, UserCog,
  type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard, clients: Users, quotes: FileText, projects: FolderKanban, tasks: ListChecks, time: Clock,
  invoices: Receipt, expenses: ArrowLeftRight, journal: BookOpen, accounts: Hash, reports: BarChart3, vendors: Truck,
  timeline: GanttChart, team: UsersRound, purchases: ShoppingCart, inventory: Package, employees: UserRound, leave: CalendarDays, payroll: Wallet, sync: RefreshCw,
  settings: Settings, audit: History, meetings: NotebookText,
};

export type NavGroup = { title: string; items: { href: string; label: string; icon: string }[] };

export function Sidebar({ groups, user, logout }: { groups: NavGroup[]; user: { name: string; role: string }; logout: () => Promise<void> }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  // 以最長的相符路徑為準，避免 /settings 與 /settings/import 同時亮起
  const hrefs = groups.flatMap((g) => g.items.map((i) => i.href));
  const best = hrefs.filter((h) => (h === "/" ? path === "/" : path === h || path.startsWith(h + "/"))).sort((a, b) => b.length - a.length)[0];

  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); toggleRef.current?.focus(); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <header className="no-print sticky top-0 z-sticky flex items-center justify-between border-b border-line bg-surface/95 px-4 py-2 backdrop-blur lg:hidden">
        <span className="font-heading text-base font-semibold">Anvision ERP</span>
        <button ref={toggleRef} type="button" className="btn-icon btn-secondary" aria-label={open ? "關閉選單" : "開啟選單"} aria-expanded={open} aria-controls="sidebar" onClick={() => setOpen(!open)}>
          {open ? <X className="h-5 w-5" aria-hidden /> : <Menu className="h-5 w-5" aria-hidden />}
        </button>
      </header>
      <aside
        id="sidebar"
        aria-label="主選單"
        className={`no-print fixed inset-y-0 left-0 z-nav flex w-64 flex-col bg-nav text-nav-ink transition-transform duration-200 lg:w-60 lg:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="flex shrink-0 items-center gap-2.5 px-5 py-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary font-heading font-bold text-primary-on" aria-hidden>A</div>
          <div>
            <div className="font-heading text-sm font-semibold text-white">Anvision ERP</div>
            <div className="text-xs text-nav-ink/80">Studio Operating System</div>
          </div>
        </div>
        <nav className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
          {groups.map((g) => (
            <div key={g.title} className="mb-4">
              <div className="px-2 pb-1 text-xs font-medium uppercase tracking-wider text-nav-ink/70">{g.title}</div>
              <ul>
                {g.items.map((it) => {
                  const Icon = ICONS[it.icon] ?? LayoutDashboard;
                  const active = it.href === best;
                  return (
                    <li key={it.href}>
                      <Link
                        href={it.href}
                        aria-current={active ? "page" : undefined}
                        className={`flex min-h-touch items-center gap-3 rounded-md px-2.5 text-sm transition-colors duration-150 focus-visible:ring-offset-nav lg:min-h-[2.25rem] ${
                          active ? "bg-white/15 font-medium text-white" : "text-nav-ink hover:bg-white/10 hover:text-white"
                        }`}
                      >
                        <Icon className="h-4 w-4 shrink-0" aria-hidden />
                        {it.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
        <div className="shrink-0 border-t border-white/10 px-3 py-3">
          <div className="px-2 text-sm font-medium text-white">{user.name}</div>
          <div className="mt-1 flex items-center justify-between gap-2">
            <Link href="/account" title="我的帳號" className="inline-flex min-h-touch min-w-0 items-center gap-2 rounded-md px-2 text-xs text-nav-ink hover:bg-white/10 hover:text-white focus-visible:ring-offset-nav lg:min-h-[2rem]">
              <UserCog className="h-4 w-4 shrink-0" aria-hidden /><span className="truncate">{user.role}・帳號</span>
            </Link>
            <form action={logout} className="shrink-0">
              <button className="inline-flex min-h-touch items-center gap-1.5 whitespace-nowrap rounded-md px-2 text-xs text-nav-ink hover:bg-white/10 hover:text-white focus-visible:ring-offset-nav lg:min-h-[2rem]">
                <LogOut className="h-4 w-4" aria-hidden />登出
              </button>
            </form>
          </div>
        </div>
      </aside>
      {open && <div className="fixed inset-0 z-overlay bg-ink/40 lg:hidden" aria-hidden onClick={() => setOpen(false)} />}
    </>
  );
}
