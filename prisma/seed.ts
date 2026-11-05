/**
 * 初始化資料：會計科目、管理員帳號、公司設定，以及（可選）示範資料。
 *   npm run db:seed              → 科目 + 管理員 + 示範資料
 *   SEED_DEMO=false npm run db:seed → 只建立科目與管理員
 * 管理員帳號可用 ADMIN_EMAIL / ADMIN_PASSWORD 環境變數指定。
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { DEFAULT_ACCOUNTS, postInvoice, postPayment, refreshInvoiceStatus, postExpense, postPayroll, createEntry } from "../src/lib/ledger";
import { nextNumber } from "../src/lib/seq";

const db = new PrismaClient();
const d = (s: string) => new Date(s);

async function main() {
  for (const [code, name, type] of DEFAULT_ACCOUNTS) {
    await db.account.upsert({ where: { code }, create: { code, name, type }, update: {} });
  }
  const email = (process.env.ADMIN_EMAIL ?? "admin@anvision.studio").toLowerCase();
  const password = process.env.ADMIN_PASSWORD ?? "anvision1234";
  const admin = await db.user.upsert({
    where: { email },
    create: { email, name: "管理員", role: "ADMIN", passwordHash: await bcrypt.hash(password, 10) },
    update: {},
  });
  const settings: Record<string, string> = {
    "company.name": "Anvision Studio", "company.taxId": "", "company.address": "台北市",
    "company.phone": "", "company.email": "anvisionstudio@gmail.com", "company.bank": "（請至「公司與帳號」設定匯款資訊）",
  };
  for (const [key, value] of Object.entries(settings)) await db.setting.upsert({ where: { key }, create: { key, value }, update: {} });
  console.log(`✓ 會計科目 ${DEFAULT_ACCOUNTS.length} 筆、管理員 ${email}`);

  if (process.env.SEED_DEMO === "false" || (await db.client.count()) > 0) return;

  // ── 示範資料 ──
  const pw = await bcrypt.hash("demo1234", 10);
  const mk = (email: string, name: string, role: string) => db.user.create({ data: { email, name, role, passwordHash: pw } });
  const pm = await mk("pm@anvision.studio", "林專案", "MANAGER");
  const acct = await mk("finance@anvision.studio", "陳會計", "ACCOUNTANT");
  const des = await mk("designer@anvision.studio", "王設計", "STAFF");
  const emp = async (userId: string, name: string, title: string, dept: string, salary: number) =>
    db.employee.create({ data: { userId, name, title, department: dept, salary, hourlyCost: Math.round((salary * 1.25) / 176), hireDate: d("2024-03-01"), email: (await db.user.findUnique({ where: { id: userId } }))?.email } });
  await emp(admin.id, "管理員", "創意總監", "管理", 90000);
  await emp(pm.id, "林專案", "專案經理", "專案", 60000);
  await emp(acct.id, "陳會計", "會計", "行政", 45000);
  const eDes = await emp(des.id, "王設計", "資深設計師", "設計", 50000);

  const acc = async (code: string) => (await db.account.findUniqueOrThrow({ where: { code } })).id;

  await db.$transaction(async (tx) => {
    await createEntry(tx, { date: d("2026-01-01"), memo: "期初開帳：股東出資", lines: [{ code: "1102", debit: 1500000 }, { code: "3101", credit: 1500000 }] });
  });

  const c1 = await db.client.create({ data: { name: "晨光咖啡股份有限公司", taxId: "24536806", contact: "張經理", email: "brand@morninglight.tw", phone: "02-2345-6789", address: "台北市大安區復興南路一段 100 號" } });
  const c2 = await db.client.create({ data: { name: "綠野科技有限公司", taxId: "53212539", contact: "李小姐", email: "mkt@greenfield.tw", phone: "02-8765-4321" } });
  const c3 = await db.client.create({ data: { name: "山嵐民宿", contact: "吳老闆", phone: "03-912-3456" } });

  const v1 = await db.vendor.create({ data: { name: "鼎好印刷", taxId: "12345675", contact: "周先生", phone: "02-2222-3333" } });
  const v2 = await db.vendor.create({ data: { name: "光影攝影工作室", contact: "Kevin", email: "kevin@lightshadow.tw" } });
  const v3 = await db.vendor.create({ data: { name: "Adobe Systems", notes: "Creative Cloud 團隊方案" } });

  const it1 = await db.inventoryItem.create({ data: { sku: "PAP-A4-120", name: "A4 象牙卡 120g", category: "耗材", unit: "包", cost: 280, quantity: 12, reorderLevel: 5, location: "儲藏室 A" } });
  await db.inventoryItem.create({ data: { sku: "CAM-SD-128", name: "SD 記憶卡 128GB", category: "器材", unit: "張", cost: 890, quantity: 4, reorderLevel: 2, location: "器材櫃" } });
  await db.inventoryItem.create({ data: { sku: "PRT-BIZ", name: "公司名片", category: "印刷品", unit: "盒", cost: 350, quantity: 2, reorderLevel: 3, location: "前台" } });

  const quote = async (clientId: string, title: string, status: string, date: string, items: [string, number, number][]) =>
    db.$transaction(async (tx) => tx.quote.create({
      data: { number: await nextNumber(tx, "Q", d(date)), clientId, title, status, issueDate: d(date), validUntil: new Date(d(date).getTime() + 30 * 864e5),
        notes: "付款方式：簽約後支付 50% 訂金，結案驗收後支付尾款 50%。",
        items: { create: items.map(([description, quantity, unitPrice], sort) => ({ description, quantity, unitPrice, sort })) } },
    }));
  const q1 = await quote(c1.id, "品牌識別系統重塑", "ACCEPTED", "2026-08-05", [["品牌策略與定位工作坊", 1, 60000], ["Logo 與識別系統設計", 1, 120000], ["品牌規範手冊", 1, 40000]]);
  const q2 = await quote(c2.id, "產品官網改版設計", "ACCEPTED", "2026-09-12", [["UX 研究與資訊架構", 1, 50000], ["UI 視覺設計（10 頁）", 10, 8000], ["設計系統元件庫", 1, 30000]]);
  await quote(c3.id, "民宿形象攝影與 DM", "SENT", "2026-10-20", [["形象攝影（半天）", 1, 25000], ["DM 設計", 1, 12000]]);

  const project = async (q: typeof q1, name: string, start: string, due: string, budget: number) =>
    db.$transaction(async (tx) => {
      const p = await tx.project.create({ data: { code: await nextNumber(tx, "P", d(start)), name, clientId: q.clientId, managerId: pm.id, budget, startDate: d(start), dueDate: d(due) } });
      await tx.quote.update({ where: { id: q.id }, data: { projectId: p.id } });
      return p;
    });
  const p1 = await project(q1, "晨光咖啡 品牌識別重塑", "2026-08-15", "2026-11-30", 220000);
  const p2 = await project(q2, "綠野科技 官網改版", "2026-09-20", "2026-12-20", 160000);

  const tasks: [string, string, string, string | null, number][] = [
    [p1.id, "品牌工作坊", "DONE", pm.id, 8], [p1.id, "Logo 初稿三案", "DONE", des.id, 24], [p1.id, "Logo 修改定稿", "REVIEW", des.id, 12],
    [p1.id, "識別系統延伸應用", "DOING", des.id, 30], [p1.id, "品牌規範手冊排版", "TODO", des.id, 20],
    [p2.id, "使用者訪談", "DONE", pm.id, 10], [p2.id, "Wireframe", "DOING", des.id, 24], [p2.id, "首頁視覺", "TODO", des.id, 16], [p2.id, "元件庫建置", "TODO", des.id, 24],
  ];
  const day0 = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00Z").getTime();
  const offsets: Record<string, [number, number]> = { DONE: [-24, -12], REVIEW: [-10, 2], DOING: [-5, 9], TODO: [6, 20] };
  for (const [k, [projectId, title, status, assigneeId, estimateHours]] of tasks.entries()) {
    const [a, b] = offsets[status];
    await db.task.create({
      data: {
        projectId, title, status, assigneeId, estimateHours, createdById: pm.id, priority: k % 4 === 0 ? "HIGH" : "NORMAL",
        startDate: new Date(day0 + (a + k) * 864e5), dueDate: new Date(day0 + (b + k) * 864e5),
        completedAt: status === "DONE" ? new Date(day0 + (b + k) * 864e5) : null,
      },
    });
  }

  for (let i = 0; i < 20; i++) {
    const day = new Date(Date.now() - i * 864e5);
    if (day.getDay() === 0 || day.getDay() === 6) continue;
    await db.timeEntry.create({ data: { userId: des.id, projectId: i % 3 ? p1.id : p2.id, date: day, hours: 6, note: "設計製作" } });
    await db.timeEntry.create({ data: { userId: pm.id, projectId: i % 2 ? p1.id : p2.id, date: day, hours: 3, note: "客戶溝通 / 專案管理" } });
  }

  // 請款與收款（使用正式過帳邏輯）
  const invoice = async (clientId: string, projectId: string, date: string, items: [string, number][], status: string, pay?: [string, number]) =>
    db.$transaction(async (tx) => {
      const inv = await tx.invoice.create({
        data: { number: await nextNumber(tx, "INV", d(date)), clientId, projectId, issueDate: d(date), dueDate: new Date(d(date).getTime() + 30 * 864e5), status,
          items: { create: items.map(([description, unitPrice], sort) => ({ description, quantity: 1, unitPrice, sort })) } },
      });
      await postInvoice(tx, inv.id);
      if (pay) {
        const p = await tx.payment.create({ data: { invoiceId: inv.id, date: d(pay[0]), amount: pay[1] } });
        await postPayment(tx, p.id);
      }
      await refreshInvoiceStatus(tx, inv.id);
    });
  await invoice(c1.id, p1.id, "2026-08-16", [["品牌識別系統重塑 訂金 50%", 110000]], "ISSUED", ["2026-08-28", 115500]);
  await invoice(c2.id, p2.id, "2026-09-21", [["官網改版 訂金 50%", 80000]], "ISSUED", ["2026-10-05", 50000]);
  await invoice(c1.id, p1.id, "2026-10-01", [["品牌工作坊追加場次", 30000]], "ISSUED");

  const expense = async (date: string, accountCode: string, description: string, amount: number, tax: number, status: string, vendorId?: string, projectId?: string) =>
    db.$transaction(async (tx) => {
      const e = await tx.expense.create({ data: { date: d(date), accountId: await acc(accountCode), description, amount, tax, status, vendorId, projectId, paidDate: status === "PAID" ? d(date) : null, dueDate: new Date(d(date).getTime() + 30 * 864e5) } });
      await postExpense(tx, e.id);
    });
  for (const m of ["08", "09", "10"]) {
    await expense(`2026-${m}-01`, "6102", `${Number(m)} 月辦公室租金`, 38000, 1900, "PAID");
    await expense(`2026-${m}-05`, "6105", `${Number(m)} 月網路電話費`, 2400, 120, "PAID");
  }
  await expense("2026-08-10", "6107", "Adobe Creative Cloud 團隊年費", 72000, 3600, "PAID", v3.id);
  await expense("2026-10-15", "5101", "品牌形象攝影外包", 28000, 1400, "UNPAID", v2.id, p1.id);
  await expense("2026-10-25", "5102", "識別樣品打樣", 6800, 340, "UNPAID", v1.id, p1.id);

  await db.purchaseOrder.create({ data: { number: "PO-2026-0001", vendorId: v1.id, status: "ORDERED", items: { create: [{ itemId: it1.id, description: "A4 象牙卡 120g", quantity: 10, unitPrice: 280 }] } } });
  await db.sequence.upsert({ where: { key: "PO-2026" }, create: { key: "PO-2026", next: 2 }, update: { next: 2 } });

  for (const period of ["2026-09", "2026-10"]) {
    for (const e of await db.employee.findMany()) {
      const deduction = Math.round(e.salary * 0.036);
      const p = await db.payroll.create({ data: { employeeId: e.id, period, baseSalary: e.salary, deduction, netPay: e.salary - deduction, status: "PAID", paidDate: d(`${period}-28`) } });
      await db.$transaction((tx) => postPayroll(tx, p.id));
    }
  }
  await db.leaveRequest.create({ data: { employeeId: eDes.id, type: "特休", startDate: new Date(Date.now() + 10 * 864e5), endDate: new Date(Date.now() + 11 * 864e5), days: 2, reason: "家庭旅遊" } });
  console.log("✓ 示範資料已建立（示範帳號密碼皆為 demo1234）");
}

main().finally(() => db.$disconnect());
