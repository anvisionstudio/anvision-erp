import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { db } from "./db";

export type Role = "ADMIN" | "MANAGER" | "ACCOUNTANT" | "STAFF";
export const ROLE_LABEL: Record<Role, string> = {
  ADMIN: "管理員",
  MANAGER: "專案經理",
  ACCOUNTANT: "會計",
  STAFF: "一般成員",
};

/** 各模組可存取的角色 */
export const ACCESS = {
  dashboard: ["ADMIN", "MANAGER", "ACCOUNTANT", "STAFF"],
  projects: ["ADMIN", "MANAGER", "ACCOUNTANT", "STAFF"],
  time: ["ADMIN", "MANAGER", "ACCOUNTANT", "STAFF"],
  leave: ["ADMIN", "MANAGER", "ACCOUNTANT", "STAFF"],
  sales: ["ADMIN", "MANAGER", "ACCOUNTANT"], // 客戶、報價
  finance: ["ADMIN", "ACCOUNTANT"], // 請款、費用、帳務、報表
  purchasing: ["ADMIN", "MANAGER", "ACCOUNTANT"],
  inventory: ["ADMIN", "MANAGER", "ACCOUNTANT", "STAFF"],
  hr: ["ADMIN", "ACCOUNTANT"], // 員工、薪資
  admin: ["ADMIN"],
} as const satisfies Record<string, readonly Role[]>;
export type Area = keyof typeof ACCESS;

const COOKIE = "erp_sid";
const TTL_DAYS = 14;

export async function hashPassword(pw: string) {
  return bcrypt.hash(pw, 10);
}

export async function login(email: string, password: string) {
  const user = await db.user.findUnique({ where: { email: email.toLowerCase().trim() } });
  if (!user || !user.active) return false;
  if (!(await bcrypt.compare(password, user.passwordHash))) return false;
  const id = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + TTL_DAYS * 864e5);
  await db.session.create({ data: { id, userId: user.id, expiresAt } });
  (await cookies()).set(COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
  return true;
}

export async function logout() {
  const jar = await cookies();
  const sid = jar.get(COOKIE)?.value;
  if (sid) await db.session.deleteMany({ where: { id: sid } });
  jar.delete(COOKIE);
}

export async function getUser() {
  const sid = (await cookies()).get(COOKIE)?.value;
  if (!sid) return null;
  const s = await db.session.findUnique({ where: { id: sid }, include: { user: { include: { employee: true } } } });
  if (!s || s.expiresAt < new Date() || !s.user.active) return null;
  return s.user;
}
export type CurrentUser = NonNullable<Awaited<ReturnType<typeof getUser>>>;

export function can(user: { role: string }, area: Area) {
  return (ACCESS[area] as readonly string[]).includes(user.role);
}

/** 頁面 / Server Action 使用：未登入導向登入頁，無權限則丟出錯誤 */
export async function requireUser(area?: Area) {
  const user = await getUser();
  if (!user) redirect("/login");
  if (area && !can(user, area)) redirect("/?denied=" + area);
  return user;
}

export async function audit(userId: string | null, action: string, entity: string, entityId?: string, detail?: string) {
  await db.auditLog.create({ data: { userId, action, entity, entityId, detail } });
}
