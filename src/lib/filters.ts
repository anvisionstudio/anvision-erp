/** 篩選條件共用工具（伺服器端） */

/** from / to（YYYY-MM-DD）→ Prisma 日期條件；to 含當天 */
export function dateRange(from?: string, to?: string) {
  const gte = from ? new Date(from) : undefined;
  const lt = to ? new Date(new Date(to).getTime() + 864e5) : undefined;
  if (gte && isNaN(+gte)) return undefined;
  if (lt && isNaN(+lt)) return undefined;
  return gte || lt ? { ...(gte ? { gte } : {}), ...(lt ? { lt } : {}) } : undefined;
}

/** 以目前參數為基礎產生網址（值為空的參數會被拿掉） */
export function href(path: string, params: Record<string, string | undefined>, patch: Record<string, string | undefined> = {}) {
  const p = new URLSearchParams(Object.entries({ ...params, ...patch }).filter(([, v]) => v) as [string, string][]);
  return `${path}${p.size ? `?${p}` : ""}`;
}

/** 只保留有值的字串參數 */
export function pick<T extends Record<string, string | undefined>>(sp: T, keys: (keyof T)[]) {
  return Object.fromEntries(keys.map((k) => [k, sp[k] || undefined])) as Record<string, string | undefined>;
}
