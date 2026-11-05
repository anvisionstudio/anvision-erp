/** FormData 讀取工具 */
export const str = (f: FormData, k: string) => {
  const v = f.get(k);
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
};
export const req = (f: FormData, k: string) => {
  const v = str(f, k);
  if (v === null) throw new Error(`缺少必填欄位：${k}`);
  return v;
};
export const n = (f: FormData, k: string, d = 0) => {
  const v = str(f, k);
  const x = v === null ? d : Number(v.replace(/,/g, ""));
  return Number.isFinite(x) ? x : d;
};
export const dt = (f: FormData, k: string) => {
  const v = str(f, k);
  return v ? new Date(v) : null;
};

/** 讀取行項目編輯器送出的 items JSON */
export function items(f: FormData) {
  const raw = str(f, "items") ?? "[]";
  const arr = JSON.parse(raw) as { description: string; quantity: number; unitPrice: number; itemId?: string | null; unit?: string | null; isGroup?: boolean }[];
  return arr
    .filter((i) => i.description?.trim())
    .map((i, idx) => ({
      description: i.description.trim(),
      // 分類標題列不計金額
      quantity: i.isGroup ? 0 : Number(i.quantity) || 0,
      unitPrice: i.isGroup ? 0 : Number(i.unitPrice) || 0,
      unit: i.isGroup ? null : i.unit?.trim() || null,
      isGroup: !!i.isGroup,
      itemId: i.itemId || null,
      sort: idx,
    }));
}
