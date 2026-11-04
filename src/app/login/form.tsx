"use client";
import { useActionState } from "react";
import { loginAction } from "../actions/auth";
import { SubmitButton } from "@/components/client";

export default function LoginForm() {
  const [error, action] = useActionState(loginAction, null);
  return (
    <form action={action} className="space-y-4">
      <label className="block">
        <span className="label">Email</span>
        <input name="email" type="email" required className="input" autoComplete="username" />
      </label>
      <label className="block">
        <span className="label">密碼</span>
        <input name="password" type="password" required className="input" autoComplete="current-password" />
      </label>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <SubmitButton className="btn-primary w-full">登入</SubmitButton>
    </form>
  );
}
