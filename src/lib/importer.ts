/**
 * Excel 會計系統（捷瑞會計系統企業版格式）匯入。
 *
 * 以 Excel 為帳務主檔、單向匯入 ERP，可重複執行：
 * - 會計項目表 → 會計科目（依代碼新增/更新）
 * - 日記簿     → 傳票（每次整批取代 source = "IMPORT" 的傳票）
 * - 專案清單   → 專案（依「專案簡稱」新增/更新，不刪除 ERP 內的任務與工時）
 *               → 請款單/收款（依發票號碼，整批取代 imported 單據）
 * - 發票明細   → 請款單品項
 */
import ExcelJS from "exceljs";
import { randomUUID } from "crypto";
import { db } from "./db";
import { DEFAULT_ACCOUNTS, ACC_DEFAULT_CODE, type AccKey } from "./ledger";

type Cell = ExcelJS.CellValue;

/** 把 exceljs 的儲存格值轉成單純的 string / number / Date / null */
function val(c: Cell): string | number | Date | null {
  if (c === null || c === undefined) return null;
  if (c instanceof Date) return c;
  if (typeof c === "number" || typeof c === "string") return typeof c === "string" ? c.trim() || null : c;
  if (typeof c === "boolean") return null;
  if (typeof c === "object") {
    if ("result" in c) return val((c as { result: Cell }).result);
    if ("richText" in c) return (c as ExcelJS.CellRichTextValue).richText.map((t) => t.text).join("").trim() || null;
    if ("text" in c) return String((c as { text: unknown }).text).trim() || null;
    if ("error" in c) return null;
  }
  return null;
}
const numv = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const strv = (v: unknown) => (v === null || v === undefined ? null : typeof v === "number" ? String(v) : v instanceof Date ? null : String(v).trim() || null);
const datev = (v: unknown) => (v instanceof Date && !isNaN(v.getTime()) ? v : null);

function rowsOf(ws: ExcelJS.Worksheet | undefined) {
  const out: (string | number | Date | null)[][] = [];
  if (!ws) return out;
  ws.eachRow({ includeEmpty: true }, (row, n) => {
    const vals = row.values as Cell[];
    const arr: (string | number | Date | null)[] = [];
    for (let i = 1; i < Math.max(vals.length, 20); i++) arr.push(val(vals[i]));
    out[n - 1] = arr;
  });
  return Array.from(out, (r) => r ?? []);
}

function accountType(code: string, side: string | null) {
  const d = code[0];
  if (d === "1") return "ASSET";
  if (d === "2") return "LIABILITY";
  if (d === "3") return "EQUITY";
  if (d === "4") return "REVENUE";
  if (d === "5" || d === "6") return "EXPENSE";
  return side === "貸" ? "REVENUE" : "EXPENSE"; // 7 營業外、8 其他、9 所得稅
}

/** 由專案簡稱開頭的 yymmdd 推得日期，例如 260206_26_客戶 → 2026-02-06 */
function dateFromRef(ref: string) {
  const m = /^(\d{2})(\d{2})(\d{2})/.exec(ref);
  if (!m) return null;
  const d = new Date(Date.UTC(2000 + Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return isNaN(d.getTime()) || Number(m[2]) > 12 ? null : d;
}

export type ParsedBook = Awaited<ReturnType<typeof parseWorkbook>>;

export async function parseWorkbook(buf: ArrayBuffer | Buffer) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as ArrayBuffer);
  const sheet = (name: string) => wb.worksheets.find((w) => w.name.trim() === name);
  const warnings: string[] = [];

  // ── 會計項目表 ──
  const accRows = rowsOf(sheet("會計項目表"));
  if (!accRows.length) throw new Error("找不到「會計項目表」工作表，請確認是捷瑞會計系統格式的 Excel");
  const accounts = new Map<string, { code: string; name: string; type: string; enabled: boolean }>();
  for (const r of accRows.slice(2)) {
    const code = numv(r[12]) !== null ? String(Math.trunc(r[12] as number)) : strv(r[12]);
    const name = strv(r[14]);
    if (!code || !/^\d{3,6}$/.test(code) || !name) continue;
    accounts.set(code, { code, name, type: accountType(code, strv(r[15])), enabled: strv(r[13]) === "Y" });
  }

  // ── 日記簿 ──
  const jRows = rowsOf(sheet("日記簿"));
  if (!jRows.length) throw new Error("找不到「日記簿」工作表");
  type JLine = { code: string; debit: number; credit: number; memo: string | null; project: string | null };
  const entries = new Map<string, { number: string; date: Date | null; memos: string[]; lines: JLine[] }>();
  let lineCount = 0;
  let lastNumber: string | null = null;
  for (const r of jRows.slice(4)) {
    const codeN = numv(r[4]);
    // 傳票編號空白的分錄屬於上一張傳票（Excel 中常見的接續列）
    const number: string | null = strv(r[2]) ?? (codeN ? lastNumber : null);
    if (!number || !codeN) continue;
    if (!(numv(r[11]) || numv(r[12]))) continue; // 金額為 0 的空白列
    lastNumber = number;
    const code = String(Math.trunc(codeN));
    if (!accounts.has(code)) {
      const label = strv(r[8])?.replace(/^\d+\s*/, "") || `科目 ${code}`;
      accounts.set(code, { code, name: label, type: accountType(code, null), enabled: true });
      warnings.push(`日記簿使用了會計項目表沒有的科目 ${code}，已自動建立「${label}」`);
    }
    const e = entries.get(number) ?? { number, date: null, memos: [], lines: [] };
    e.date ??= datev(r[3]);
    const head = strv(r[7]);
    if (head && !e.memos.includes(head)) e.memos.push(head);
    e.lines.push({ code, debit: numv(r[11]) ?? 0, credit: numv(r[12]) ?? 0, memo: strv(r[10]), project: strv(r[9]) });
    entries.set(number, e);
    lineCount++;
  }
  const unbalanced: { number: string; debit: number; credit: number }[] = [];
  for (const e of entries.values()) {
    const d = e.lines.reduce((s, l) => s + l.debit, 0), c = e.lines.reduce((s, l) => s + l.credit, 0);
    if (Math.abs(d - c) > 0.5) unbalanced.push({ number: e.number, debit: d, credit: c });
    if (!e.date) warnings.push(`傳票 ${e.number} 沒有有效日期，已略過`);
  }

  // ── 發票明細 ──
  const items = new Map<string, { description: string; quantity: number; unitPrice: number; subtotal: number }[]>();
  for (const r of rowsOf(sheet("發票明細")).slice(1)) {
    const gui = strv(r[0]);
    const desc = strv(r[3]);
    if (!gui || !/^[A-Z]{2}\d{8}$/.test(gui) || !desc) continue;
    const list = items.get(gui) ?? [];
    list.push({ description: desc, quantity: numv(r[4]) ?? 0, unitPrice: numv(r[5]) ?? 0, subtotal: numv(r[6]) ?? 0 });
    items.set(gui, list);
  }

  // ── 專案清單 ──
  const projects: {
    seq: string; ref: string; name: string; quoteDate: Date | null; quoteAmount: number | null;
    invoiceDate: Date | null; guis: string[]; invoiceAmount: number | null;
    receivedDate: Date | null; received: number | null; note: string | null;
  }[] = [];
  const seen = new Set<string>();
  for (const r of rowsOf(sheet("專案清單")).slice(2)) {
    const ref = strv(r[2]);
    if (!ref || ref === "全部" || ref === "公司" || ref === "專案簡稱") continue;
    if (seen.has(ref)) { warnings.push(`專案簡稱重複：${ref}（只匯入第一筆）`); continue; }
    seen.add(ref);
    const seqRaw = r[1];
    const seq = typeof seqRaw === "number" ? String(Math.trunc(seqRaw)).padStart(4, "0") : strv(seqRaw) ?? ref;
    projects.push({
      seq, ref, name: strv(r[3]) ?? ref,
      quoteDate: datev(r[4]), quoteAmount: numv(r[5]),
      invoiceDate: datev(r[6]),
      guis: (strv(r[7]) ?? "").split(/\s+/).filter((g) => /^[A-Z]{2}\d{8}$/.test(g)),
      invoiceAmount: numv(r[8]),
      receivedDate: datev(r[9]), received: numv(r[10]), note: strv(r[11]),
    });
  }

  // ── 發票資料（營業稅各期彙總）──
  const vat: { period: string; output: number | null; input: number | null; inputInternal: number | null; estimated: number | null; diff: number | null; paid: number | null; carry: number | null; note: string | null }[] = [];
  for (const r of rowsOf(sheet("發票資料"))) {
    const period = strv(r[4]);
    if (!period || !/^\d{4}\/\d{2}-\d{2}$/.test(period)) continue;
    vat.push({ period, output: numv(r[5]), input: numv(r[6]), inputInternal: numv(r[7]), estimated: numv(r[8]), diff: numv(r[9]), paid: numv(r[10]), carry: numv(r[11]), note: strv(r[12]) });
  }

  return {
    vat,
    accounts: [...accounts.values()],
    entries: [...entries.values()].filter((e) => e.date),
    lineCount, unbalanced, items, projects, warnings,
  };
}

/** 自動過帳角色 → Excel 會計項目表中最接近的科目名稱 */
const ROLE_ALIASES: Record<AccKey, string[]> = {
  CASH: ["現金", "零用金"],
  BANK: ["銀行存款"],
  AR: ["應收帳款"],
  INPUT_VAT: ["進項稅額"],
  INVENTORY: ["存貨", "商品存貨", "商品"],
  AP: ["應付帳款"],
  OUTPUT_VAT: ["銷項稅額"],
  WITHHOLDING: ["代扣款項", "代收款", "代扣"],
  REVENUE: ["銷貨收入", "營業收入", "勞務收入"],
  SALARY: ["薪資支出"],
  COST: ["銷貨成本", "營業成本", "外包成本"],
  MISC: ["其他費用", "雜費", "雜項購置"],
};

export const IMPORT_CLIENT = "Excel 匯入客戶（待整理）";

export async function applyImport(book: ParsedBook, userId: string | null) {
  const started = Date.now();
  const result = await db.$transaction(
    async (tx) => {
      // 1) 會計科目
      const usedCodes = new Set(book.entries.flatMap((e) => e.lines.map((l) => l.code)));
      for (const a of book.accounts) {
        const active = a.enabled || usedCodes.has(a.code);
        await tx.account.upsert({
          where: { code: a.code },
          create: { code: a.code, name: a.name, type: a.type, active },
          update: { name: a.name, type: a.type, active },
        });
      }
      const accounts = await tx.account.findMany();
      const idByCode = new Map(accounts.map((a) => [a.code, a.id]));

      // 2) 自動過帳角色對應到 Excel 科目（依名稱），並移除未使用且不在 Excel 中的系統預設科目
      const excelCodes = new Set(book.accounts.map((a) => a.code));
      const excelAccs = accounts.filter((a) => excelCodes.has(a.code));
      for (const key of Object.keys(ACC_DEFAULT_CODE) as AccKey[]) {
        let target: (typeof excelAccs)[number] | undefined;
        for (const n of ROLE_ALIASES[key]) {
          const cands = excelAccs.filter((a) => a.name === n || a.name.startsWith(n));
          target = cands.find((a) => usedCodes.has(a.code)) ?? cands.find((a) => a.active) ?? cands[0];
          if (target) break;
        }
        if (target) await tx.setting.upsert({ where: { key: `acckey.${key}` }, create: { key: `acckey.${key}`, value: target.code }, update: { value: target.code } });
      }
      await tx.setting.deleteMany({ where: { key: { startsWith: "accmap." } } });
      for (const [code] of DEFAULT_ACCOUNTS) {
        if (excelCodes.has(code)) continue;
        const def = accounts.find((a) => a.code === code);
        if (!def) continue;
        const refs = (await tx.journalLine.count({ where: { accountId: def.id } })) + (await tx.expense.count({ where: { accountId: def.id } }));
        if (refs === 0) await tx.account.delete({ where: { id: def.id } });
      }

      // 3) 傳票：整批取代
      await tx.journalEntry.deleteMany({ where: { source: "IMPORT" } });
      const entryRows: { id: string; number: string; date: Date; memo: string; source: string }[] = [];
      const lineRows: { id: string; entryId: string; accountId: string; debit: number; credit: number; memo: string | null; project: string | null }[] = [];
      for (const e of book.entries) {
        const id = randomUUID();
        entryRows.push({ id, number: e.number, date: e.date!, memo: e.memos.join("／") || e.lines[0]?.memo || "（無摘要）", source: "IMPORT" });
        for (const l of e.lines) {
          lineRows.push({ id: randomUUID(), entryId: id, accountId: idByCode.get(l.code)!, debit: l.debit, credit: l.credit, memo: l.memo, project: l.project });
        }
      }
      // 若 ERP 手動傳票與 Excel 傳票編號相同，Excel 為主
      await tx.journalEntry.deleteMany({ where: { number: { in: entryRows.map((e) => e.number) }, source: { not: "IMPORT" } } });
      for (let i = 0; i < entryRows.length; i += 500) await tx.journalEntry.createMany({ data: entryRows.slice(i, i + 500) });
      for (let i = 0; i < lineRows.length; i += 1000) await tx.journalLine.createMany({ data: lineRows.slice(i, i + 1000) });

      // 4) 專案
      let projCreated = 0, projUpdated = 0;
      const projIdByRef = new Map<string, string>();
      for (const p of book.projects) {
        const budget = p.quoteAmount ? Math.round(p.quoteAmount / 1.05) : 0;
        const startDate = p.quoteDate ?? dateFromRef(p.ref);
        const exists = await tx.project.findUnique({ where: { ref: p.ref } });
        const fullyPaid = p.invoiceAmount && p.received && p.received >= p.invoiceAmount - 50;
        if (exists) {
          await tx.project.update({ where: { id: exists.id }, data: { name: p.name, budget, startDate: exists.startDate ?? startDate } });
          projIdByRef.set(p.ref, exists.id);
          projUpdated++;
        } else {
          let code = p.seq;
          if (await tx.project.findUnique({ where: { code } })) code = `${p.seq}-${p.ref.slice(0, 6)}`;
          const np = await tx.project.create({
            data: { code, ref: p.ref, name: p.name, budget, startDate, status: fullyPaid ? "DONE" : "ACTIVE", description: p.note },
          });
          projIdByRef.set(p.ref, np.id);
          projCreated++;
        }
      }

      // 5) 請款單（發票）：整批取代匯入的單據
      await tx.invoice.deleteMany({ where: { imported: true } });
      let client = await tx.client.findFirst({ where: { name: IMPORT_CLIENT } });
      client ??= await tx.client.create({ data: { name: IMPORT_CLIENT, notes: "由 Excel 匯入的請款單暫掛此客戶，可於請款單編輯時改為正確客戶" } });
      let invCount = 0;
      const usedGui = new Set<string>();
      for (const p of book.projects) {
        if (!p.guis.length) continue;
        const projectId = projIdByRef.get(p.ref)!;
        const issueDate = p.invoiceDate ?? p.quoteDate ?? dateFromRef(p.ref) ?? new Date();
        const single = p.guis.length === 1;
        for (const gui of p.guis) {
          if (usedGui.has(gui) || (await tx.invoice.findUnique({ where: { number: gui } }))) continue;
          usedGui.add(gui);
          const detail = (book.items.get(gui) ?? []).filter((i) => i.subtotal || i.unitPrice);
          const detailSum = detail.reduce((s, i) => s + (i.subtotal || i.quantity * i.unitPrice), 0);
          let lines: { description: string; quantity: number; unitPrice: number; sort: number }[];
          if (detail.length && detailSum > 0) {
            lines = detail.map((i, sort) => ({ description: i.description, quantity: i.quantity || 1, unitPrice: i.quantity ? i.unitPrice : i.subtotal, sort }));
          } else if (single && p.invoiceAmount) {
            lines = [{ description: p.name, quantity: 1, unitPrice: Math.round(p.invoiceAmount / 1.05), sort: 0 }];
          } else {
            lines = [{ description: `${p.name}（金額請參考 Excel）`, quantity: 1, unitPrice: 0, sort: 0 }];
          }
          const total = Math.round(lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0) * 1.05);
          const paid = single ? p.received ?? 0 : p.received && p.invoiceAmount && p.received >= p.invoiceAmount - 50 ? total : 0;
          const status = paid <= 0 ? "ISSUED" : paid + 50 >= total ? "PAID" : "PARTIAL";
          await tx.invoice.create({
            data: {
              number: gui, gui, imported: true, clientId: client.id, projectId, status, issueDate,
              dueDate: new Date(issueDate.getTime() + 30 * 864e5), taxRate: 0.05,
              notes: [`由 Excel 專案清單匯入（${p.ref}）`, p.note].filter(Boolean).join("\n"),
              items: { create: lines },
              payments: paid > 0 ? { create: [{ date: p.receivedDate ?? issueDate, amount: paid, imported: true, note: "Excel 入帳" }] } : undefined,
            },
          });
          invCount++;
        }
      }

      await tx.setting.upsert({ where: { key: "import.vat" }, create: { key: "import.vat", value: JSON.stringify(book.vat) }, update: { value: JSON.stringify(book.vat) } });

      // 6) 以 Excel 為帳務主檔：關閉 ERP 自動過帳
      await tx.setting.upsert({ where: { key: "ledger.autopost" }, create: { key: "ledger.autopost", value: "false" }, update: { value: "false" } });
      const summary = {
        at: new Date().toISOString(),
        accounts: book.accounts.length,
        entries: entryRows.length,
        lines: lineRows.length,
        projectsCreated: projCreated,
        projectsUpdated: projUpdated,
        invoices: invCount,
        unbalanced: book.unbalanced,
        warnings: book.warnings.slice(0, 50),
        seconds: 0,
      };
      return summary;
    },
    { timeout: 240_000, maxWait: 20_000 },
  );
  result.seconds = Math.round((Date.now() - started) / 100) / 10;
  await db.setting.upsert({ where: { key: "import.last" }, create: { key: "import.last", value: JSON.stringify(result) }, update: { value: JSON.stringify(result) } });
  await db.auditLog.create({ data: { userId, action: "Excel 匯入", entity: "帳務", detail: `${result.entries} 張傳票、${result.projectsCreated + result.projectsUpdated} 個專案、${result.invoices} 張發票` } });
  return result;
}

/** 從 Google Drive 下載（檔案需設為「知道連結的任何人都能檢視」） */
export async function downloadFromDrive(fileIdOrUrl: string) {
  const id = /\/d\/([\w-]{20,})/.exec(fileIdOrUrl)?.[1] ?? /[?&]id=([\w-]{20,})/.exec(fileIdOrUrl)?.[1] ?? fileIdOrUrl.trim();
  if (!/^[\w-]{20,}$/.test(id)) throw new Error("Google Drive 連結或檔案 ID 格式不正確");
  const urls = [
    `https://drive.usercontent.google.com/download?id=${id}&export=download&confirm=t`,
    `https://docs.google.com/spreadsheets/d/${id}/export?format=xlsx`,
  ];
  for (const url of urls) {
    const res = await fetch(url, { redirect: "follow", cache: "no-store" });
    const type = res.headers.get("content-type") ?? "";
    if (res.ok && !type.includes("text/html")) {
      const buf = await res.arrayBuffer();
      if (buf.byteLength > 1000 && new Uint8Array(buf.slice(0, 2)).join() === "80,75") return buf; // ZIP (xlsx) 標頭 "PK"
    }
  }
  throw new Error("無法從 Google Drive 下載檔案。請在 Drive 將此檔案的共用設定改為「知道連結的任何人」可檢視，或改用上傳檔案。");
}
