import { db } from "@/lib/db";
import { requireUser, ROLE_LABEL, type Role } from "@/lib/auth";
import { date } from "@/lib/format";
import { COMPANY_FIELDS, getCompany } from "@/lib/settings";
import { saveSettings, saveUser, changeOwnPassword } from "@/app/actions/admin";
import { PageHeader, Card, Field, Select, Badge } from "@/components/ui";
import { SubmitButton } from "@/components/client";

export default async function Settings() {
  const me = await requireUser("admin");
  const [co, users] = await Promise.all([getCompany(), db.user.findMany({ orderBy: { createdAt: "asc" } })]);
  const roles = Object.entries(ROLE_LABEL).map(([value, label]) => ({ value, label }));
  const coMap: Record<string, string> = co;
  return (
    <>
      <PageHeader title="公司與帳號" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="公司資料（顯示於報價單、請款單）">
          <form action={saveSettings} className="space-y-3">
            {COMPANY_FIELDS.map(([key, label]) => (
              <Field key={key} label={label}>
                {key === "company.bank" ? <textarea name={key} rows={3} defaultValue={coMap[key.replace("company.", "")]} className="input" />
                  : <input name={key} defaultValue={coMap[key.replace("company.", "")]} className="input" />}
              </Field>
            ))}
            <SubmitButton>儲存公司資料</SubmitButton>
          </form>
        </Card>
        <div className="space-y-6">
          <Card title="新增帳號">
            <form action={saveUser} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="姓名 *"><input name="name" required className="input" /></Field>
              <Field label="Email *"><input name="email" type="email" required className="input" /></Field>
              <Field label="角色"><Select name="role" defaultValue="STAFF" options={roles} /></Field>
              <Field label="初始密碼 *" help="至少 8 碼"><input name="password" type="password" required minLength={8} className="input" autoComplete="new-password" /></Field>
              <div className="sm:col-span-2"><SubmitButton>建立帳號</SubmitButton></div>
            </form>
          </Card>
          <Card title="變更我的密碼">
            <form action={changeOwnPassword} className="flex flex-col gap-2 sm:flex-row"><input name="password" type="password" minLength={8} required className="input" placeholder="新密碼（至少 8 碼）" aria-label="新密碼" autoComplete="new-password" /><SubmitButton>變更</SubmitButton></form>
          </Card>
        </div>
        <Card title="帳號與權限" pad={false} className="lg:col-span-2">
          <div className="hidden grid-cols-[1fr_1.4fr_1fr_0.8fr_1fr_auto_auto] gap-2 border-b border-line bg-surface-muted px-4 py-2.5 text-xs font-medium text-ink-muted xl:grid" aria-hidden>
            <span>姓名</span><span>Email</span><span>角色</span><span>狀態</span><span>重設密碼</span><span>建立</span><span />
          </div>
          <ul className="divide-y divide-line">
            {users.map((u) => (
              <li key={u.id}>
                <form action={saveUser} className="grid grid-cols-1 gap-3 px-4 py-4 sm:grid-cols-2 xl:grid-cols-[1fr_1.4fr_1fr_0.8fr_1fr_auto_auto] xl:items-center xl:gap-2 xl:py-2.5">
                  <input type="hidden" name="id" value={u.id} />
                  <Field label="姓名" className="[&>.label]:xl:sr-only"><input name="name" defaultValue={u.name} className="input" autoComplete="off" /></Field>
                  <Field label="Email" className="[&>.label]:xl:sr-only"><input name="email" type="email" defaultValue={u.email} className="input" autoComplete="off" /></Field>
                  <Field label="角色" className="[&>.label]:xl:sr-only"><Select name="role" defaultValue={u.role} options={roles} /></Field>
                  <Field label="狀態" className="[&>.label]:xl:sr-only"><Select name="active" defaultValue={u.active ? "true" : "false"} options={[{ value: "true", label: "啟用" }, { value: "false", label: "停用" }]} /></Field>
                  <Field label="重設密碼" className="[&>.label]:xl:sr-only"><input name="password" type="password" placeholder="留空不變更" className="input" autoComplete="new-password" minLength={8} /></Field>
                  <span className="text-xs text-ink-muted">建立於 {date(u.createdAt)} {u.id === me.id && <Badge label="我" tone="blue" />}</span>
                  <div className="sm:text-right"><button className="btn-secondary btn-sm w-full sm:w-auto">儲存</button></div>
                </form>
              </li>
            ))}
          </ul>
        </Card>
        <Card title="角色權限說明" className="lg:col-span-2">
          <ul className="space-y-1 text-sm text-ink-muted">
            <li><b>{ROLE_LABEL.ADMIN as string}</b>：全部模組與系統設定</li>
            <li><b>{ROLE_LABEL.ACCOUNTANT as string}</b>：客戶報價、請款、費用、傳票、報表、採購、員工薪資</li>
            <li><b>{ROLE_LABEL.MANAGER as string}</b>：客戶報價、專案管理、採購庫存、審核請假（看不到財務與薪資）</li>
            <li><b>{ROLE_LABEL.STAFF as string}</b>：專案任務、工時、請假、庫存領用</li>
          </ul>
        </Card>
      </div>
    </>
  );
}
