import { requireUser, can, ROLE_LABEL, type Area, type Role } from "@/lib/auth";
import { Sidebar, type NavGroup } from "@/components/nav";
import { logoutAction } from "../actions/auth";

const NAV: { title: string; items: { href: string; label: string; icon: string; area: Area }[] }[] = [
  { title: "總覽", items: [{ href: "/", label: "儀表板", icon: "◎", area: "dashboard" }] },
  {
    title: "業務",
    items: [
      { href: "/clients", label: "客戶", icon: "☺", area: "sales" },
      { href: "/quotes", label: "報價單", icon: "✎", area: "sales" },
    ],
  },
  {
    title: "專案",
    items: [
      { href: "/projects", label: "專案", icon: "▣", area: "projects" },
      { href: "/tasks", label: "我的任務", icon: "☑", area: "projects" },
      { href: "/time", label: "工時紀錄", icon: "◷", area: "time" },
    ],
  },
  {
    title: "會計財務",
    items: [
      { href: "/invoices", label: "請款 / 應收", icon: "＄", area: "finance" },
      { href: "/expenses", label: "費用 / 應付", icon: "⇄", area: "finance" },
      { href: "/accounting", label: "傳票 / 總帳", icon: "≡", area: "finance" },
      { href: "/accounting/accounts", label: "會計科目", icon: "#", area: "finance" },
      { href: "/reports", label: "財務報表", icon: "▤", area: "finance" },
    ],
  },
  {
    title: "採購庫存",
    items: [
      { href: "/vendors", label: "供應商", icon: "⌂", area: "purchasing" },
      { href: "/purchases", label: "採購單", icon: "⎘", area: "purchasing" },
      { href: "/inventory", label: "庫存", icon: "▦", area: "inventory" },
    ],
  },
  {
    title: "人事",
    items: [
      { href: "/hr/employees", label: "員工", icon: "♟", area: "hr" },
      { href: "/hr/leave", label: "請假", icon: "☼", area: "leave" },
      { href: "/hr/payroll", label: "薪資", icon: "¤", area: "hr" },
    ],
  },
  {
    title: "系統",
    items: [
      { href: "/settings", label: "公司與帳號", icon: "⚙", area: "admin" },
      { href: "/settings/audit", label: "操作紀錄", icon: "⌕", area: "admin" },
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
      <main className="lg:pl-60">
        <div className="mx-auto max-w-7xl p-4 md:p-8">{children}</div>
      </main>
    </div>
  );
}
