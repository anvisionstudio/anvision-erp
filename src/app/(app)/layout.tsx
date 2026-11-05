import { requireUser, can, ROLE_LABEL, type Area, type Role } from "@/lib/auth";
import { Sidebar, type NavGroup } from "@/components/nav";
import { logoutAction } from "../actions/auth";
import { isDemo } from "@/lib/db";

const NAV: { title: string; items: { href: string; label: string; icon: string; area: Area }[] }[] = [
  { title: "總覽", items: [{ href: "/", label: "儀表板", icon: "dashboard", area: "dashboard" }] },
  {
    title: "業務",
    items: [
      { href: "/clients", label: "客戶", icon: "clients", area: "sales" },
      { href: "/quotes", label: "報價單", icon: "quotes", area: "sales" },
    ],
  },
  {
    title: "專案",
    items: [
      { href: "/projects", label: "專案", icon: "projects", area: "projects" },
      { href: "/tasks", label: "我的任務", icon: "tasks", area: "projects" },
      { href: "/time", label: "工時紀錄", icon: "time", area: "time" },
    ],
  },
  {
    title: "會計財務",
    items: [
      { href: "/invoices", label: "請款 / 應收", icon: "invoices", area: "finance" },
      { href: "/expenses", label: "費用 / 應付", icon: "expenses", area: "finance" },
      { href: "/accounting", label: "傳票 / 總帳", icon: "journal", area: "finance" },
      { href: "/accounting/accounts", label: "會計科目", icon: "accounts", area: "finance" },
      { href: "/reports", label: "財務報表", icon: "reports", area: "finance" },
    ],
  },
  {
    title: "採購庫存",
    items: [
      { href: "/vendors", label: "供應商", icon: "vendors", area: "purchasing" },
      { href: "/purchases", label: "採購單", icon: "purchases", area: "purchasing" },
      { href: "/inventory", label: "庫存", icon: "inventory", area: "inventory" },
    ],
  },
  {
    title: "人事",
    items: [
      { href: "/hr/employees", label: "員工", icon: "employees", area: "hr" },
      { href: "/hr/leave", label: "請假", icon: "leave", area: "leave" },
      { href: "/hr/payroll", label: "薪資", icon: "payroll", area: "hr" },
    ],
  },
  {
    title: "系統",
    items: [
      { href: "/settings/import", label: "Excel 帳務同步", icon: "sync", area: "finance" },
      { href: "/settings", label: "公司與帳號", icon: "settings", area: "admin" },
      { href: "/settings/audit", label: "操作紀錄", icon: "audit", area: "admin" },
    ],
  },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const groups: NavGroup[] = NAV.map((g) => ({
    title: g.title,
    items: g.items.filter((i) => can(user, i.area)).map(({ area: _a, ...rest }) => rest),
  })).filter((g) => g.items.length);
  return (
    <div className="min-h-screen">
      <Sidebar groups={groups} user={{ name: user.name, role: ROLE_LABEL[user.role as Role] ?? user.role }} logout={logoutAction} />
      <main id="main" tabIndex={-1} className="focus:outline-none lg:pl-60">
        {isDemo && (
          <div role="status" className="no-print bg-accent-soft px-4 py-2 text-center text-sm text-accent">
            示範模式：資料不會永久保存，且可能在不同頁面間不一致。正式使用請在 Vercel 連接資料庫（Storage → Neon）。
          </div>
        )}
        <div className="mx-auto max-w-7xl px-4 py-5 md:px-6 md:py-8">{children}</div>
      </main>
    </div>
  );
}
