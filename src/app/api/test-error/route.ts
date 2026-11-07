import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** 只在自動測試（E2E=1）時存在：故意丟出錯誤，驗證錯誤紀錄與通知流程。正式環境回 404。 */
export async function GET() {
  if (process.env.E2E !== "1") return NextResponse.json({ error: "not found" }, { status: 404 });
  throw new Error("自動測試用錯誤");
}
