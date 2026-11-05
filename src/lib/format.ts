export const twd = (n: number | null | undefined) =>
  "NT$ " + Math.round(n ?? 0).toLocaleString("zh-TW");

export const num = (n: number | null | undefined, d = 0) =>
  (n ?? 0).toLocaleString("zh-TW", { minimumFractionDigits: d, maximumFractionDigits: d });

export const date = (d: Date | string | null | undefined) => {
  if (!d) return "—";
  const x = typeof d === "string" ? new Date(d) : d;
  return `${x.getFullYear()}/${String(x.getMonth() + 1).padStart(2, "0")}/${String(x.getDate()).padStart(2, "0")}`;
};

/** <input type="date"> 用 */
export const isoDate = (d: Date | string | null | undefined) => {
  if (!d) return "";
  const x = typeof d === "string" ? new Date(d) : d;
  return x.toISOString().slice(0, 10);
};

export type Line = { quantity: number; unitPrice: number };
export function totals(items: Line[], taxRate: number) {
  const subtotal = Math.round(items.reduce((s, i) => s + i.quantity * i.unitPrice, 0));
  const tax = Math.round(subtotal * taxRate);
  return { subtotal, tax, total: subtotal + tax };
}

export const STATUS: Record<string, { label: string; tone: string }> = {
  DRAFT: { label: "草稿", tone: "gray" },
  SENT: { label: "已送出", tone: "blue" },
  ACCEPTED: { label: "已成交", tone: "green" },
  REJECTED: { label: "未成交", tone: "red" },
  PLANNING: { label: "規劃中", tone: "gray" },
  ACTIVE: { label: "進行中", tone: "blue" },
  ON_HOLD: { label: "暫停", tone: "amber" },
  DONE: { label: "已完成", tone: "green" },
  CANCELLED: { label: "已取消", tone: "red" },
  TODO: { label: "待辦", tone: "gray" },
  DOING: { label: "進行中", tone: "blue" },
  REVIEW: { label: "審核中", tone: "amber" },
  ISSUED: { label: "已開立", tone: "blue" },
  PARTIAL: { label: "部分收款", tone: "amber" },
  PAID: { label: "已付清", tone: "green" },
  VOID: { label: "作廢", tone: "red" },
  UNPAID: { label: "未付款", tone: "amber" },
  ORDERED: { label: "已下單", tone: "blue" },
  RECEIVED: { label: "已到貨", tone: "green" },
  PENDING: { label: "待審核", tone: "amber" },
  APPROVED: { label: "已核准", tone: "green" },
  LEFT: { label: "已離職", tone: "gray" },
  ENABLED: { label: "使用中", tone: "green" },
  DISABLED: { label: "已停用", tone: "gray" },
};
