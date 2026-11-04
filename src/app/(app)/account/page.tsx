import { requireUser, ROLE_LABEL, type Role } from "@/lib/auth";
import { changeOwnPassword } from "@/app/actions/admin";
import { PageHeader, Card } from "@/components/ui";
import { SubmitButton } from "@/components/client";

export default async function Account() {
  const u = await requireUser();
  return (
    <>
      <PageHeader title="我的帳號" sub={`${u.email}・${ROLE_LABEL[u.role as Role]}`} />
      <Card title="變更密碼" className="max-w-md">
        <form action={changeOwnPassword} className="flex gap-2"><input name="password" type="password" minLength={8} required className="input" placeholder="新密碼（至少 8 碼）" /><SubmitButton>變更</SubmitButton></form>
      </Card>
    </>
  );
}
