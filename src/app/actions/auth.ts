"use server";
import { redirect } from "next/navigation";
import { login, logout } from "@/lib/auth";

export async function loginAction(_: string | null, f: FormData) {
  const ok = await login(String(f.get("email") ?? ""), String(f.get("password") ?? ""));
  if (!ok) return "帳號或密碼錯誤";
  redirect("/");
}

export async function logoutAction() {
  await logout();
  redirect("/login");
}
