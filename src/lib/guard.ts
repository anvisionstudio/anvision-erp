import { unstable_rethrow } from "next/navigation";

export type ActionResult = { error?: string } | void;

/**
 * 包住會「拋出錯誤」的 Server Action：正式環境下 Next.js 會把錯誤訊息遮蔽成通用畫面，
 * 所以改成回傳 { error }，由按鈕顯示真正的原因（例如「此客戶已有專案，無法刪除」）。
 * redirect / notFound 仍照常拋出。
 */
export async function guard(fn: () => Promise<unknown>): Promise<ActionResult> {
  try {
    await fn();
  } catch (e) {
    unstable_rethrow(e);
    return { error: (e as Error).message || "操作失敗" };
  }
}
