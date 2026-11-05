import { db } from "@/lib/db";

/** 職位：名稱、所屬部門、聘用類型（正職 / 外包） */
export type Position = { name: string; dept: string; type: "FULL" | "CONTRACT" };
export const POSITIONS_KEY = "hr.positions";
export const EMPLOY_TYPE: Record<Position["type"], string> = { FULL: "正職", CONTRACT: "外包" };

export const DEFAULT_POSITIONS: Position[] = [
  { name: "動畫總監", dept: "動畫組", type: "FULL" },
  { name: "動畫師", dept: "動畫組", type: "FULL" },
  { name: "設計師", dept: "設計組", type: "FULL" },
  { name: "設計助理", dept: "設計組", type: "FULL" },
  { name: "外包設計師", dept: "設計組", type: "CONTRACT" },
  { name: "外包剪輯師", dept: "動畫組", type: "CONTRACT" },
  { name: "社群行銷", dept: "行銷組", type: "FULL" },
  { name: "會計", dept: "行政", type: "FULL" },
];

/** 部門配色（Badge tone） */
export const DEPT_TONE: Record<string, string> = { 動畫組: "blue", 設計組: "green", 行銷組: "amber", 行政: "gray" };

export async function getPositions(): Promise<Position[]> {
  const v = (await db.setting.findUnique({ where: { key: POSITIONS_KEY } }))?.value;
  if (!v) return DEFAULT_POSITIONS;
  try {
    const list = JSON.parse(v) as Position[];
    return Array.isArray(list) && list.length ? list : DEFAULT_POSITIONS;
  } catch {
    return DEFAULT_POSITIONS;
  }
}
