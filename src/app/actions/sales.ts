"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser, audit } from "@/lib/auth";
import { str, req, n, dt, items } from "@/lib/form";
import { nextNumber } from "@/lib/seq";
import { totals } from "@/lib/format";

// ── 客戶 ──
export async function saveClient(f: FormData) {
  const u = await requireUser("sales");
  const id = str(f, "id");
  const data = {
    name: req(f, "name"), taxId: str(f, "taxId"), contact: str(f, "contact"), email: str(f, "email"),
    phone: str(f, "phone"), address: str(f, "address"), notes: str(f, "notes"),
  };
  const c = id ? await db.client.update({ where: { id }, data }) : await db.client.create({ data });
  await audit(u.id, id ? "更新" : "新增", "客戶", c.id, c.name);
  revalidatePath("/clients");
  redirect(`/clients/${c.id}`);
}

export async function deleteClient(id: string) {
  const u = await requireUser("sales");
  const used = await db.client.findUnique({ where: { id }, include: { _count: { select: { quotes: true, invoices: true, projects: true } } } });
  if (used && used._count.quotes + used._count.invoices + used._count.projects > 0) throw new Error("此客戶已有報價、專案或請款紀錄，無法刪除");
  await db.client.delete({ where: { id } });
  await audit(u.id, "刪除", "客戶", id);
  redirect("/clients");
}

// ── 報價單 ──
export async function saveQuote(f: FormData) {
  const u = await requireUser("sales");
  const id = str(f, "id");
  const lines = items(f).map(({ itemId: _i, ...x }) => x);
  const data = {
    clientId: req(f, "clientId"), title: req(f, "title"),
    issueDate: dt(f, "issueDate") ?? new Date(), validUntil: dt(f, "validUntil"),
    taxRate: n(f, "taxRate", 0.05), notes: str(f, "notes"),
  };
  const q = await db.$transaction(async (tx) => {
    if (id) {
      await tx.quoteItem.deleteMany({ where: { quoteId: id } });
      return tx.quote.update({ where: { id }, data: { ...data, items: { create: lines } } });
    }
    return tx.quote.create({ data: { ...data, number: await nextNumber(tx, "Q"), items: { create: lines } } });
  });
  await audit(u.id, id ? "更新" : "新增", "報價單", q.id, q.number);
  revalidatePath("/quotes");
  redirect(`/quotes/${q.id}`);
}

export async function setQuoteStatus(id: string, status: string) {
  const u = await requireUser("sales");
  await db.quote.update({ where: { id }, data: { status } });
  await audit(u.id, "狀態 → " + status, "報價單", id);
  revalidatePath(`/quotes/${id}`);
}

export async function deleteQuote(id: string) {
  const u = await requireUser("sales");
  await db.quote.delete({ where: { id } });
  await audit(u.id, "刪除", "報價單", id);
  redirect("/quotes");
}

/** 成交報價 → 建立專案 */
export async function quoteToProject(id: string) {
  const u = await requireUser("sales");
  const q = await db.quote.findUniqueOrThrow({ where: { id }, include: { items: true } });
  if (q.projectId) redirect(`/projects/${q.projectId}`);
  const p = await db.$transaction(async (tx) => {
    const project = await tx.project.create({
      data: {
        code: await nextNumber(tx, "P"), name: q.title, clientId: q.clientId, managerId: u.id,
        budget: totals(q.items, q.taxRate).subtotal, startDate: new Date(), description: q.notes,
      },
    });
    await tx.quote.update({ where: { id }, data: { projectId: project.id, status: "ACCEPTED" } });
    return project;
  });
  await audit(u.id, "報價轉專案", "專案", p.id, `${q.number} → ${p.code}`);
  redirect(`/projects/${p.id}`);
}

/** 報價 → 請款單（可指定請款比例，例如訂金 50%） */
export async function quoteToInvoice(id: string, ratio: number) {
  const u = await requireUser("finance");
  const q = await db.quote.findUniqueOrThrow({ where: { id }, include: { items: true } });
  const label = ratio < 1 ? `（${Math.round(ratio * 100)}%）` : "";
  const inv = await db.$transaction(async (tx) =>
    tx.invoice.create({
      data: {
        number: await nextNumber(tx, "INV"), clientId: q.clientId, projectId: q.projectId, taxRate: q.taxRate,
        dueDate: new Date(Date.now() + 30 * 864e5), notes: `依報價單 ${q.number}`,
        items: { create: q.items.map((i) => ({ description: i.description + label, quantity: i.quantity, unitPrice: Math.round(i.unitPrice * ratio), sort: i.sort })) },
      },
    }),
  );
  await audit(u.id, "報價轉請款", "請款單", inv.id, `${q.number} → ${inv.number}`);
  redirect(`/invoices/${inv.id}`);
}
