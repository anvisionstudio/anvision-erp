import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createHmac, timingSafeEqual } from "crypto";
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

/**
 * 無狀態登入：Cookie 內含 userId 與到期時間，以 HMAC 簽章（密碼變更後自動失效）。
 * 不依賴資料庫中的 Session，因此在多台伺服器（如 Vercel）上也能維持登入。
 */
const SECRET = process.env.SESSION_SECRET ?? "anvision-erp-demo-secret-change-me";
const sign = (payload: string, pwHash: string) => createHmac("sha256", SECRET).update(payload + "|" + pwHash).digest("base64url");

export async function login(email: string, password: string) {
  const user = await db.user.findUnique({ where: { email: email.toLowerCase().trim() } });
  if (!user || !user.active) return false;
  if (!(await bcrypt.compare(password, user.passwordHash))) return false;
  const expiresAt = new Date(Date.now() + TTL_DAYS * 864e5);
  const payload = Buffer.from(JSON.stringify({ u: user.id, e: expiresAt.getTime() })).toString("base64url");
  (await cookies()).set(COOKIE, `${payload}.${sign(payload, user.passwordHash)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
  return true;
}

export async function logout() {
  (await cookies()).delete(COOKIE);
}

export async function getUser() {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return null;
  const [payload, sig] = raw.split(".");
  if (!payload || !sig) return null;
  let data: { u: string; e: number };
  try {
    data = JSON.parse(Buffer.from(payload, "base64url").toString());
  } catch {
    return null;
  }
  if (!data.u || !data.e || data.e < Date.now()) return null;
  const user = await db.user.findUnique({ where: { id: data.u }, include: { employee: true } });
  if (!user || !user.active) return null;
  const expected = Buffer.from(sign(payload, user.passwordHash));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  return user;
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
