"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

export type NavGroup = { title: string; items: { href: string; label: string; icon: string }[] };

export function Sidebar({ groups, user, logout }: { groups: NavGroup[]; user: { name: string; role: string }; logout: () => Promise<void> }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  // 以最長的相符路徑為準，避免 /settings 與 /settings/import 同時亮起
  const hrefs = groups.flatMap((g) => g.items.map((i) => i.href));
  const best = hrefs.filter((h) => (h === "/" ? path === "/" : path === h || path.startsWith(h + "/"))).sort((a, b) => b.length - a.length)[0];
  const active = (href: string) => href === best;
  return (
    <>
      <div className="no-print sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
        <span className="font-semibold">Anvision ERP</span>
        <button className="btn-secondary btn-sm" onClick={() => setOpen(!open)}>選單</button>
      </div>
      <aside
        className={`no-print fixed inset-y-0 left-0 z-40 w-60 transform overflow-y-auto bg-brand-900 text-slate-200 transition lg:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="flex items-center gap-2 px-5 py-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500 font-bold text-white">A</div>
          <div>
            <div className="text-sm font-semibold text-white">Anvision ERP</div>
            <div className="text-[11px] text-slate-400">Studio Operating System</div>
          </div>
        </div>
        <nav className="px-3 pb-24">
          {groups.map((g) => (
            <div key={g.title} className="mb-4">
              <div className="px-2 pb-1 text-[11px] font-medium uppercase tracking-wider text-slate-400">{g.title}</div>
              {g.items.map((it) => (
                <Link
                  key={it.href}
                  href={it.href}
                  onClick={() => setOpen(false)}
                  className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm ${active(it.href) ? "bg-white/10 font-medium text-white" : "text-slate-300 hover:bg-white/5 hover:text-white"}`}
                >
                  <span className="w-5 text-center">{it.icon}</span>
                  {it.label}
                </Link>
              ))}
            </div>
          ))}
        </nav>
        <div className="fixed bottom-0 w-60 border-t border-white/10 bg-brand-900 px-4 py-3">
          <div className="text-sm text-white">{user.name}</div>
          <div className="flex items-center justify-between text-xs text-slate-400">
            <a href="/account" className="hover:text-white">{user.role}・我的帳號</a>
            <form action={logout}><button className="hover:text-white">登出</button></form>
          </div>
        </div>
      </aside>
      {open && <div className="fixed inset-0 z-30 bg-black/30 lg:hidden" onClick={() => setOpen(false)} />}
    </>
  );
}
