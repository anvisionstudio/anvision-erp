"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser, audit } from "@/lib/auth";
import { str, req, n, dt, items } from "@/lib/form";
import { nextNumber } from "@/lib/seq";
import { totals } from "@/lib/format";
import { parseCsv } from "@/lib/csv";
import { assignClients } from "@/lib/client-match";

// ── 客戶 ──
export async function saveClient(f: FormData) {
  const u = await requireUser("sales");
  const id = str(f, "id");
  const data = {
    name: req(f, "name"), taxId: str(f, "taxId"), contact: str(f, "contact"), email: str(f, "email"),
    phone: str(f, "phone"), address: str(f, "address"), notes: str(f, "notes"), aliases: str(f, "aliases"), website: str(f, "website"),
  };
  const c = id ? await db.client.update({ where: { id }, data }) : await db.client.create({ data });
  await db.$transaction((tx) => assignClients(tx), { timeout: 60_000 });
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
      const custom = str(f, "number");
      if (custom && (await tx.quote.findFirst({ where: { number: custom, id: { not: id } } }))) throw new Error(`報價單編號 ${custom} 已存在`);
      await tx.quoteItem.deleteMany({ where: { quoteId: id } });
      return tx.quote.update({ where: { id }, data: { ...data, ...(custom ? { number: custom } : {}), items: { create: lines } } });
    }
    const custom = str(f, "number");
    if (custom && (await tx.quote.findUnique({ where: { number: custom } }))) throw new Error(`報價單編號 ${custom} 已存在`);
    return tx.quote.create({ data: { ...data, number: custom ?? (await nextNumber(tx, "Q")), items: { create: lines } } });
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
        items: { create: q.items.map((i) => ({ description: i.isGroup ? i.description : i.description + label, quantity: i.quantity, unitPrice: Math.round(i.unitPrice * ratio), unit: i.unit, isGroup: i.isGroup, sort: i.sort })) },
      },
    }),
  );
  await audit(u.id, "報價轉請款", "請款單", inv.id, `${q.number} → ${inv.number}`);
  redirect(`/invoices/${inv.id}`);
}

export type ClientCsvState = { ok?: string; error?: string } | null;

/** 以 CSV 批次匯入客戶（依名稱新增或更新），並依別名把專案歸給客戶 */
export async function importClientsCsv(_: ClientCsvState, f: FormData): Promise<ClientCsvState> {
  try {
    const u = await requireUser("sales");
    const file = f.get("file");
    if (!(file instanceof File) || !file.size) return { error: "請選擇 CSV 檔案" };
    const rows = parseCsv(await file.text());
    if (rows.length < 2) return { error: "CSV 沒有資料列" };
    const head = rows[0].map((h) => h.trim());
    const col = (...names: string[]) => head.findIndex((h) => names.includes(h));
    const ix = {
      name: col("名稱", "客戶", "name"), aliases: col("別名", "aliases"), taxId: col("統編", "統一編號", "taxId"),
      contact: col("聯絡人", "contact"), phone: col("電話", "phone"), email: col("Email", "email", "信箱"),
      address: col("地址", "address"), notes: col("備註", "notes"), website: col("網站", "website"),
    };
    if (ix.name < 0) return { error: "CSV 第一列需包含「名稱」欄位" };
    let created = 0, updated = 0;
    for (const r of rows.slice(1)) {
      const get = (i: number) => (i >= 0 ? r[i]?.trim() || null : null);
      const name = get(ix.name);
      if (!name) continue;
      const data: Record<string, string | null> = {};
      // 空白儲存格不覆蓋既有資料
      for (const k of ["aliases", "taxId", "contact", "phone", "email", "address", "notes", "website"] as const) { const v = get(ix[k]); if (v) data[k] = v; }
      const exists = await db.client.findFirst({ where: { name } });
      if (exists) { await db.client.update({ where: { id: exists.id }, data }); updated++; }
      else { await db.client.create({ data: { name, ...data } }); created++; }
    }
    const a = await db.$transaction((tx) => assignClients(tx), { timeout: 120_000 });
    await audit(u.id, "CSV 匯入", "客戶", undefined, `新增 ${created}・更新 ${updated}・歸戶專案 ${a.projects}`);
    revalidatePath("/clients");
    revalidatePath("/projects");
    revalidatePath("/invoices");
    return { ok: `匯入完成：新增 ${created} 位、更新 ${updated} 位客戶，並把 ${a.projects} 個專案、${a.invoices} 張請款單歸到對應客戶` };
  } catch (e) {
    return { error: (e as Error).message };
  }
}
