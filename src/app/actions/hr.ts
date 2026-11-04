"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser, audit, can } from "@/lib/auth";
import { str, req, n, dt } from "@/lib/form";
import { postPayroll } from "@/lib/ledger";

export async function saveEmployee(f: FormData) {
  const u = await requireUser("hr");
  const id = str(f, "id");
  const data = {
    name: req(f, "name"), title: str(f, "title"), department: str(f, "department"), email: str(f, "email"),
    phone: str(f, "phone"), hireDate: dt(f, "hireDate"), salary: n(f, "salary"), hourlyCost: n(f, "hourlyCost"),
    annualLeave: n(f, "annualLeave", 7), status: str(f, "status") ?? "ACTIVE", userId: str(f, "userId"),
  };
  if (id) await db.employee.update({ where: { id }, data });
  else await db.employee.create({ data });
  await audit(u.id, id ? "更新" : "新增", "員工", id ?? undefined, data.name);
  revalidatePath("/hr/employees");
}

// ── 請假 ──
export async function requestLeave(f: FormData) {
  const u = await requireUser("leave");
  const isHR = can(u, "hr");
  const employeeId = isHR ? req(f, "employeeId") : u.employee?.id;
  if (!employeeId) throw new Error("您的帳號尚未連結員工資料，請聯絡管理員");
  const start = dt(f, "startDate"), end = dt(f, "endDate");
  if (!start || !end || end < start) throw new Error("請假日期不正確");
  await db.leaveRequest.create({
    data: { employeeId, type: req(f, "type"), startDate: start, endDate: end, days: n(f, "days", 1), reason: str(f, "reason") },
  });
  await audit(u.id, "申請", "請假", employeeId);
  revalidatePath("/hr/leave");
}

export async function reviewLeave(id: string, status: "APPROVED" | "REJECTED") {
  const u = await requireUser("leave");
  if (!(can(u, "hr") || u.role === "MANAGER")) throw new Error("權限不足");
  await db.leaveRequest.update({ where: { id }, data: { status } });
  await audit(u.id, status === "APPROVED" ? "核准" : "駁回", "請假", id);
  revalidatePath("/hr/leave");
}

export async function deleteLeave(id: string) {
  const u = await requireUser("leave");
  const l = await db.leaveRequest.findUniqueOrThrow({ where: { id } });
  if (!can(u, "hr") && (l.employeeId !== u.employee?.id || l.status !== "PENDING")) throw new Error("只能撤回自己待審核的假單");
  await db.leaveRequest.delete({ where: { id } });
  revalidatePath("/hr/leave");
}

// ── 薪資 ──
/** 產生某月份所有在職員工的薪資草稿 */
export async function generatePayroll(f: FormData) {
  const u = await requireUser("hr");
  const period = req(f, "period");
  const emps = await db.employee.findMany({ where: { status: "ACTIVE" } });
  for (const e of emps) {
    // 預設代扣：勞健保自付額概估 約 月薪 × 3.6%（實際請依投保級距調整）
    const deduction = Math.round(e.salary * 0.036);
    await db.payroll.upsert({
      where: { employeeId_period: { employeeId: e.id, period } },
      create: { employeeId: e.id, period, baseSalary: e.salary, deduction, netPay: e.salary - deduction },
      update: {},
    });
  }
  await audit(u.id, "產生薪資", "薪資", undefined, period);
  revalidatePath("/hr/payroll");
}

export async function savePayroll(f: FormData) {
  const u = await requireUser("hr");
  const id = req(f, "id");
  const p = await db.payroll.findUniqueOrThrow({ where: { id } });
  if (p.status === "PAID") throw new Error("已發放的薪資無法修改");
  const baseSalary = n(f, "baseSalary"), allowance = n(f, "allowance"), deduction = n(f, "deduction");
  await db.payroll.update({ where: { id }, data: { baseSalary, allowance, deduction, netPay: baseSalary + allowance - deduction } });
  await audit(u.id, "更新", "薪資", id);
  revalidatePath("/hr/payroll");
}

export async function payPayroll(id: string) {
  const u = await requireUser("hr");
  await db.$transaction(async (tx) => {
    await tx.payroll.update({ where: { id }, data: { status: "PAID", paidDate: new Date() } });
    await postPayroll(tx, id);
  });
  await audit(u.id, "發放", "薪資", id);
  revalidatePath("/hr/payroll");
}
