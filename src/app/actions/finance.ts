"use server";
import { guard } from "@/lib/guard";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser, audit } from "@/lib/auth";
import { str, req, n, dt, items } from "@/lib/form";
import { nextNumber } from "@/lib/seq";
import {
  postInvoice, postPayment, removePaymentEntry, refreshInvoiceStatus,
  postExpense, removeExpenseEntries, createEntry,
} from "@/lib/ledger";

// ── 請款單 ──
export async function saveInvoice(f: FormData) {
  const u = await requireUser("finance");
  const id = str(f, "id");
  const lines = items(f).map(({ itemId: _i, ...x }) => x);
  const data = {
    clientId: req(f, "clientId"), projectId: str(f, "projectId"), gui: str(f, "gui"),
    issueDate: dt(f, "issueDate") ?? new Date(), dueDate: dt(f, "dueDate"),
    taxRate: n(f, "taxRate", 0.05), notes: str(f, "notes"),
  };
  const inv = await db.$transaction(async (tx) => {
    let r;
    if (id) {
      await tx.invoiceItem.deleteMany({ where: { invoiceId: id } });
      r = await tx.invoice.update({ where: { id }, data: { ...data, items: { create: lines } } });
    } else {
      r = await tx.invoice.create({ data: { ...data, number: await nextNumber(tx, "INV"), items: { create: lines } } });
    }
    await postInvoice(tx, r.id); // 已開立的單據修改時自動重新過帳
    await refreshInvoiceStatus(tx, r.id);
    return r;
  });
  await audit(u.id, id ? "更新" : "新增", "請款單", inv.id, inv.number);
  revalidatePath("/invoices");
  redirect(`/invoices/${inv.id}`);
}

export async function setInvoiceStatus(id: string, status: "DRAFT" | "ISSUED" | "VOID") {
  return guard(async () => {
    const u = await requireUser("finance");
    await db.$transaction(async (tx) => {
      const inv = await tx.invoice.findUniqueOrThrow({ where: { id }, include: { payments: true } });
      if (status !== "ISSUED" && inv.payments.length) throw new Error("已有收款紀錄，請先刪除收款再變更狀態");
      await tx.invoice.update({ where: { id }, data: { status } });
      await postInvoice(tx, id);
      await refreshInvoiceStatus(tx, id);
    });
    await audit(u.id, "狀態 → " + status, "請款單", id);
    revalidatePath(`/invoices/${id}`);
    revalidatePath("/invoices");
  });
}

export async function deleteInvoice(id: string) {
  return guard(async () => {
    const u = await requireUser("finance");
    const inv = await db.invoice.findUniqueOrThrow({ where: { id } });
    if (inv.status !== "DRAFT") throw new Error("只能刪除草稿，已開立的請款單請改為作廢");
    await db.invoice.delete({ where: { id } });
    await audit(u.id, "刪除", "請款單", id, inv.number);
    redirect("/invoices");
  });
}

export async function addPayment(f: FormData) {
  const u = await requireUser("finance");
  const invoiceId = req(f, "invoiceId");
  const amount = n(f, "amount");
  if (amount <= 0) throw new Error("收款金額需大於 0");
  await db.$transaction(async (tx) => {
    const inv = await tx.invoice.findUniqueOrThrow({ where: { id: invoiceId } });
    if (inv.status === "DRAFT" || inv.status === "VOID") throw new Error("請款單需先開立才能收款");
    const p = await tx.payment.create({
      data: { invoiceId, amount, date: dt(f, "date") ?? new Date(), method: str(f, "method") ?? "轉帳", note: str(f, "note") },
    });
    await postPayment(tx, p.id);
    await refreshInvoiceStatus(tx, invoiceId);
  });
  await audit(u.id, "收款", "請款單", invoiceId, String(amount));
  revalidatePath(`/invoices/${invoiceId}`);
}

export async function deletePayment(id: string) {
  return guard(async () => {
    const u = await requireUser("finance");
    const p = await db.$transaction(async (tx) => {
      await removePaymentEntry(tx, id);
      const p = await tx.payment.delete({ where: { id } });
      await refreshInvoiceStatus(tx, p.invoiceId);
      return p;
    });
    await audit(u.id, "刪除收款", "請款單", p.invoiceId, String(p.amount));
    revalidatePath(`/invoices/${p.invoiceId}`);
  });
}

// ── 費用 / 應付 ──
export async function saveExpense(f: FormData) {
  const u = await requireUser("finance");
  const id = str(f, "id");
  const status = str(f, "status") ?? "UNPAID";
  const data = {
    date: dt(f, "date") ?? new Date(), vendorId: str(f, "vendorId"), projectId: str(f, "projectId"),
    accountId: req(f, "accountId"), description: req(f, "description"), amount: n(f, "amount"), tax: n(f, "tax"),
    status, dueDate: dt(f, "dueDate"), paidDate: status === "PAID" ? dt(f, "paidDate") ?? new Date() : null,
    receiptNo: str(f, "receiptNo"),
  };
  const e = await db.$transaction(async (tx) => {
    const r = id ? await tx.expense.update({ where: { id }, data }) : await tx.expense.create({ data });
    await postExpense(tx, r.id);
    return r;
  });
  await audit(u.id, id ? "更新" : "新增", "費用", e.id, e.description);
  revalidatePath("/expenses");
  redirect("/expenses");
}

export async function payExpense(id: string) {
  return guard(async () => {
    const u = await requireUser("finance");
    await db.$transaction(async (tx) => {
      await tx.expense.update({ where: { id }, data: { status: "PAID", paidDate: new Date() } });
      await postExpense(tx, id);
    });
    await audit(u.id, "付款", "費用", id);
    revalidatePath("/expenses");
  });
}

export async function deleteExpense(id: string) {
  return guard(async () => {
    const u = await requireUser("finance");
    await db.$transaction(async (tx) => {
      await removeExpenseEntries(tx, id);
      await tx.expense.delete({ where: { id } });
    });
    await audit(u.id, "刪除", "費用", id);
    revalidatePath("/expenses");
  });
}

// ── 傳票 / 科目 ──
export async function saveJournal(f: FormData) {
  const u = await requireUser("finance");
  const lines = JSON.parse(req(f, "lines")) as { accountId: string; debit: number; credit: number; memo: string }[];
  const valid = lines.filter((l) => l.accountId);
  if (valid.length < 2) throw new Error("傳票至少需要兩筆分錄");
  const e = await db.$transaction((tx) =>
    createEntry(tx, { date: dt(f, "date") ?? new Date(), memo: req(f, "memo"), lines: valid.map((l) => ({ ...l, memo: l.memo || undefined })) }),
  );
  await audit(u.id, "新增", "傳票", e?.id, e?.number);
  revalidatePath("/accounting");
  redirect("/accounting");
}

export async function deleteJournal(id: string) {
  return guard(async () => {
    const u = await requireUser("finance");
    const e = await db.journalEntry.findUniqueOrThrow({ where: { id } });
    if (e.source !== "MANUAL") throw new Error("系統自動產生的傳票，請從原始單據修改");
    await db.journalEntry.delete({ where: { id } });
    await audit(u.id, "刪除", "傳票", id, e.number);
    revalidatePath("/accounting");
  });
}

export async function saveAccount(f: FormData) {
  const u = await requireUser("finance");
  const id = str(f, "id");
  const data = { code: req(f, "code"), name: req(f, "name"), type: req(f, "type"), active: str(f, "active") !== "false" };
  if (id) await db.account.update({ where: { id }, data });
  else await db.account.create({ data });
  await audit(u.id, id ? "更新" : "新增", "會計科目", id ?? undefined, `${data.code} ${data.name}`);
  revalidatePath("/accounting/accounts");
}
