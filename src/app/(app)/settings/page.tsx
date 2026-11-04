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
            <form action={saveUser} className="grid grid-cols-2 gap-3">
              <Field label="姓名 *"><input name="name" required className="input" /></Field>
              <Field label="Email *"><input name="email" type="email" required className="input" /></Field>
              <Field label="角色"><Select name="role" defaultValue="STAFF" options={roles} /></Field>
              <Field label="初始密碼（至少 8 碼）*"><input name="password" type="password" required minLength={8} className="input" /></Field>
              <div className="col-span-2"><SubmitButton>建立帳號</SubmitButton></div>
            </form>
          </Card>
          <Card title="變更我的密碼">
            <form action={changeOwnPassword} className="flex gap-2"><input name="password" type="password" minLength={8} required className="input" placeholder="新密碼" /><SubmitButton>變更</SubmitButton></form>
          </Card>
        </div>
        <Card title="帳號與權限" pad={false} className="lg:col-span-2">
          <table className="tbl">
            <thead><tr><th>姓名</th><th>Email</th><th>角色</th><th>狀態</th><th>重設密碼</th><th>建立</th><th /></tr></thead>
            <tbody>{users.map((u) => (
              <tr key={u.id}>
                <td colSpan={7} className="p-0">
                  <form action={saveUser} className="grid grid-cols-7 items-center gap-2 px-3 py-2">
                    <input type="hidden" name="id" value={u.id} />
                    <input name="name" defaultValue={u.name} className="input" />
                    <input name="email" defaultValue={u.email} className="input" />
                    <Select name="role" defaultValue={u.role} options={roles} />
                    <Select name="active" defaultValue={u.active ? "true" : "false"} options={[{ value: "true", label: "啟用" }, { value: "false", label: "停用" }]} />
                    <input name="password" type="password" placeholder="留空不變更" className="input" />
                    <span className="text-xs text-slate-500">{date(u.createdAt)} {u.id === me.id && <Badge label="我" tone="blue" />}</span>
                    <div className="text-right"><button className="btn-secondary btn-sm">儲存</button></div>
                  </form>
                </td>
              </tr>
            ))}</tbody>
          </table>
        </Card>
        <Card title="角色權限說明" className="lg:col-span-2">
          <ul className="space-y-1 text-sm text-slate-600">
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
