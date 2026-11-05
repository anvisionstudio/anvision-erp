/** 專案 / 任務權限與簽核規則 */
type U = { id: string; role: string };
type P = { managerId: string | null } | null | undefined;
type T = { assigneeId: string | null; createdById?: string | null; status?: string };

/** 可管理專案（建立任務、指派、核准、改日期、刪除）：管理員、專案經理角色、或此專案的負責人 */
export const canManageProject = (u: U, p?: P) => u.role === "ADMIN" || u.role === "MANAGER" || (!!p && p.managerId === u.id);

/** 可更新任務進度（狀態、日期、說明）：可管理者或被指派者 */
export const canUpdateTask = (u: U, t: T, p?: P) => canManageProject(u, p) || t.assigneeId === u.id;

/** 優先度：重要 / 緊急 四象限（沿用既有代碼） */
export const PRIORITY: Record<string, { label: string; tone: string; order: number }> = {
  URGENT: { label: "重要、緊急", tone: "red", order: 0 },
  HIGH: { label: "重要、不緊急", tone: "green", order: 1 },
  MEDIUM: { label: "不重要、緊急", tone: "amber", order: 2 },
  NORMAL: { label: "不重要、不緊急", tone: "blue", order: 3 },
  LOW: { label: "不重要、不緊急", tone: "blue", order: 4 },
};
export const PRIORITY_OPTIONS = ["URGENT", "HIGH", "MEDIUM", "NORMAL"].map((value) => ({ value, label: PRIORITY[value].label }));

/** 簽核動作 */
export type SignAction = "SUBMIT" | "WITHDRAW" | "APPROVE" | "REJECT" | "REOPEN";
export const SIGN_LABEL: Record<SignAction, string> = {
  SUBMIT: "送審", WITHDRAW: "撤回送審", APPROVE: "核准", REJECT: "退回", REOPEN: "重新開啟",
};
export const SIGN_TO: Record<SignAction, string> = { SUBMIT: "REVIEW", WITHDRAW: "DOING", APPROVE: "DONE", REJECT: "DOING", REOPEN: "DOING" };

/**
 * 依目前狀態與身分可執行的簽核動作：
 * - 負責人：未完成時可「送審」；審核中可「撤回送審」
 * - 專案經理 / 負責人：可「核准」（未完成的任何階段）、審核中可「退回」、已完成可「重新開啟」
 */
export function signActions(u: U, t: T & { status: string }, p?: P): SignAction[] {
  const manage = canManageProject(u, p);
  const mine = t.assigneeId === u.id;
  const out: SignAction[] = [];
  if (t.status === "TODO" || t.status === "DOING") {
    if (mine || manage) out.push("SUBMIT");
    if (manage) out.push("APPROVE");
  } else if (t.status === "REVIEW") {
    if (manage) out.push("APPROVE", "REJECT");
    if (mine || manage) out.push("WITHDRAW");
  } else if (t.status === "DONE") {
    if (manage) out.push("REOPEN");
  }
  return out;
}
