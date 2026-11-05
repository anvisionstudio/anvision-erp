/** 專案 / 任務權限 */
type U = { id: string; role: string };
type P = { managerId: string | null } | null | undefined;
type T = { assigneeId: string | null; createdById?: string | null };

/** 可管理專案（建立任務、指派、改日期、刪除）：管理員、專案經理角色、或此專案的負責人 */
export const canManageProject = (u: U, p?: P) => u.role === "ADMIN" || u.role === "MANAGER" || (!!p && p.managerId === u.id);

/** 可更新任務進度（狀態、日期、說明）：可管理者或被指派者 */
export const canUpdateTask = (u: U, t: T, p?: P) => canManageProject(u, p) || t.assigneeId === u.id;

export const PRIORITY: Record<string, { label: string; tone: string }> = {
  URGENT: { label: "緊急", tone: "red" },
  HIGH: { label: "高", tone: "amber" },
  NORMAL: { label: "一般", tone: "gray" },
  LOW: { label: "低", tone: "gray" },
};
