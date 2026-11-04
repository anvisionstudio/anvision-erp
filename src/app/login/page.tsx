import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import LoginForm from "./form";

export default async function LoginPage() {
  if (await getUser()) redirect("/");
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-900 to-brand-700 p-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-8 shadow-xl">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600 text-lg font-bold text-white">A</div>
          <h1>Anvision ERP</h1>
          <p className="mt-1 text-sm text-slate-500">公司內部營運管理系統</p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
