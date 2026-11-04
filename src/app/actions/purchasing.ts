"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser, audit } from "@/lib/auth";
import { str, req, n, dt, items } from "@/lib/form";
import { nextNumber } from "@/lib/seq";
import { totals } from "@/lib/format";
import { postExpense, createEntry, resolveAccount, autopostEnabled, ACC } from "@/lib/ledger";

export async function saveVendor(f: FormData) {
  const u = await requireUser("purchasing");
  const id = str(f, "id");
  const data = {
    name: req(f, "name"), taxId: str(f, "taxId"), contact: str(f, "contact"), email: str(f, "email"),
    phone: str(f, "phone"), address: str(f, "address"), bankInfo: str(f, "bankInfo"), notes: str(f, "notes"),
  };
  const v = id ? await db.vendor.update({ where: { id }, data }) : await db.vendor.create({ data });
  await audit(u.id, id ? "更新" : "新增", "供應商", v.id, v.name);
  revalidatePath("/vendors");
  redirect("/vendors");
}

export async function deleteVendor(id: string) {
  const u = await requireUser("purchasing");
  const v = await db.vendor.findUniqueOrThrow({ where: { id }, include: { _count: { select: { expenses: true, purchaseOrders: true } } } });
  if (v._count.expenses + v._count.purchaseOrders > 0) throw new Error("此供應商已有交易紀錄，無法刪除");
  await db.vendor.delete({ where: { id } });
  await audit(u.id, "刪除", "供應商", id, v.name);
  revalidatePath("/vendors");
}

// ── 採購單 ──
export async function savePO(f: FormData) {
  const u = await requireUser("purchasing");
  const id = str(f, "id");
  const lines = items(f).map(({ sort: _s, ...x }) => x);
  const data = {
    vendorId: req(f, "vendorId"), projectId: str(f, "projectId"),
    orderDate: dt(f, "orderDate") ?? new Date(), taxRate: n(f, "taxRate", 0.05), notes: str(f, "notes"),
  };
  const po = await db.$transaction(async (tx) => {
    if (id) {
      const cur = await tx.purchaseOrder.findUniqueOrThrow({ where: { id } });
      if (cur.status === "RECEIVED") throw new Error("已到貨的採購單無法修改");
      await tx.purchaseItem.deleteMany({ where: { poId: id } });
      return tx.purchaseOrder.update({ where: { id }, data: { ...data, items: { create: lines } } });
    }
    return tx.purchaseOrder.create({ data: { ...data, number: await nextNumber(tx, "PO"), items: { create: lines } } });
  });
  await audit(u.id, id ? "更新" : "新增", "採購單", po.id, po.number);
  revalidatePath("/purchases");
  redirect(`/purchases/${po.id}`);
}

export async function setPOStatus(id: string, status: "ORDERED" | "CANCELLED" | "DRAFT") {
  const u = await requireUser("purchasing");
  const po = await db.purchaseOrder.findUniqueOrThrow({ where: { id } });
  if (po.status === "RECEIVED") throw new Error("已到貨的採購單無法變更");
  await db.purchaseOrder.update({ where: { id }, data: { status } });
  await audit(u.id, "狀態 → " + status, "採購單", id, po.number);
  revalidatePath(`/purchases/${id}`);
}

/** 驗收到貨：庫存品項入庫、產生應付帳款（庫存品記入「存貨」，其餘依專案記外包/製作成本） */
export async function receivePO(id: string) {
  const u = await requireUser("purchasing");
  await db.$transaction(async (tx) => {
    const po = await tx.purchaseOrder.findUniqueOrThrow({ where: { id }, include: { items: true, vendor: true } });
    if (po.status === "RECEIVED") throw new Error("此採購單已驗收");
    if (po.status === "CANCELLED") throw new Error("已取消的採購單無法驗收");
    const inv = await resolveAccount(tx, ACC.INVENTORY);
    const cost = await resolveAccount(tx, ACC.COST);
    if (!inv) throw new Error("找不到「存貨」會計科目，請先建立或於匯入設定中對應");
    const stockLines = po.items.filter((i) => i.itemId);
    const otherLines = po.items.filter((i) => !i.itemId);
    for (const i of stockLines) {
      const item = await tx.inventoryItem.findUniqueOrThrow({ where: { id: i.itemId! } });
      // 移動平均成本
      const newQty = item.quantity + i.quantity;
      const newCost = newQty > 0 ? (item.quantity * item.cost + i.quantity * i.unitPrice) / newQty : i.unitPrice;
      await tx.inventoryItem.update({ where: { id: item.id }, data: { quantity: newQty, cost: Math.round(newCost * 100) / 100 } });
      await tx.stockMovement.create({ data: { itemId: item.id, change: i.quantity, reason: `採購入庫 ${po.number}`, refId: po.id } });
    }
    const bill = async (lines: typeof po.items, accountId: string, label: string) => {
      if (!lines.length) return;
      const t = totals(lines, po.taxRate);
      const e = await tx.expense.create({
        data: {
          date: new Date(), vendorId: po.vendorId, projectId: po.projectId, accountId,
          description: `${po.number} ${label}`, amount: t.subtotal, tax: t.tax, status: "UNPAID",
          dueDate: new Date(Date.now() + 30 * 864e5), purchaseOrderId: po.id,
        },
      });
      await postExpense(tx, e.id);
    };
    await bill(stockLines, inv.id, "庫存採購");
    await bill(otherLines, (cost ?? inv).id, "採購");
    await tx.purchaseOrder.update({ where: { id }, data: { status: "RECEIVED" } });
  });
  await audit(u.id, "驗收到貨", "採購單", id);
  revalidatePath(`/purchases/${id}`);
  revalidatePath("/inventory");
  revalidatePath("/expenses");
}

export async function deletePO(id: string) {
  const u = await requireUser("purchasing");
  const po = await db.purchaseOrder.findUniqueOrThrow({ where: { id } });
  if (po.status === "RECEIVED") throw new Error("已到貨的採購單無法刪除");
  await db.purchaseOrder.delete({ where: { id } });
  await audit(u.id, "刪除", "採購單", id, po.number);
  redirect("/purchases");
}

// ── 庫存 ──
export async function saveItem(f: FormData) {
  const u = await requireUser("purchasing");
  const id = str(f, "id");
  const data = {
    sku: req(f, "sku"), name: req(f, "name"), category: str(f, "category"), unit: str(f, "unit") ?? "個",
    cost: n(f, "cost"), reorderLevel: n(f, "reorderLevel"), location: str(f, "location"),
  };
  await db.$transaction(async (tx) => {
    if (id) await tx.inventoryItem.update({ where: { id }, data });
    else {
      const qty = n(f, "quantity");
      const it = await tx.inventoryItem.create({ data: { ...data, quantity: qty } });
      if (qty) await tx.stockMovement.create({ data: { itemId: it.id, change: qty, reason: "期初庫存" } });
    }
  });
  await audit(u.id, id ? "更新" : "新增", "庫存品項", id ?? undefined, data.name);
  revalidatePath("/inventory");
}

/** 領用 / 盤點調整（領用者為所有人可用） */
export async function adjustStock(f: FormData) {
  const u = await requireUser("inventory");
  const itemId = req(f, "itemId");
  const mode = req(f, "mode"); // OUT 領用 | ADJ 盤點
  const qty = n(f, "quantity");
  await db.$transaction(async (tx) => {
    const it = await tx.inventoryItem.findUniqueOrThrow({ where: { id: itemId } });
    const change = mode === "OUT" ? -Math.abs(qty) : qty - it.quantity;
    if (it.quantity + change < 0) throw new Error("庫存不足");
    await tx.inventoryItem.update({ where: { id: itemId }, data: { quantity: it.quantity + change } });
    await tx.stockMovement.create({
      data: { itemId, change, reason: mode === "OUT" ? `領用：${str(f, "note") ?? u.name}` : `盤點調整：${str(f, "note") ?? ""}` },
    });
    // 存貨價值異動過帳：領用 → 製作成本；盤盈/盤虧 → 雜項費用
    const value = Math.round(Math.abs(change) * it.cost);
    if (value > 0 && (await autopostEnabled(tx))) {
      const other = mode === "OUT" ? ACC.COST : ACC.MISC;
      const out = change < 0;
      await createEntry(tx, {
        date: new Date(),
        memo: `${mode === "OUT" ? "領用" : "盤點調整"} ${it.name} ${change > 0 ? "+" : ""}${change}${it.unit}`,
        source: "INVENTORY",
        lines: [
          { code: out ? other : ACC.INVENTORY, debit: value },
          { code: out ? ACC.INVENTORY : other, credit: value },
        ],
      });
    }
  });
  await audit(u.id, mode === "OUT" ? "領用" : "盤點", "庫存品項", itemId, String(qty));
  revalidatePath("/inventory");
}
