/** Next.js 伺服器端錯誤掛勾：所有頁面、Server Action、API 的未處理錯誤都會經過這裡 */
export async function register() {}

export async function onRequestError(err: unknown, request: { path?: string; method?: string }, context: { routerKind?: string; routePath?: string; routeType?: string }) {
  // 只在 Node.js 執行環境記錄（寫法要用 if 區塊，建置時 edge 版本才會移除資料庫相關程式）
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { logError } = await import("./lib/errors");
    await logError(err, request, context);
  }
}
