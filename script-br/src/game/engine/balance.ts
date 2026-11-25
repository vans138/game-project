// 概率与数值平衡（v9）
// 全部可调数值集中于此，改这里即可全局生效。
//
// 模型说明（用户定稿）：
//   事件概率 —— 两段抽：
//     1) 先按三档（common/rare/critical）归一化抽一档
//     2) 抽到哪档，再到该档事件池里抽具体事件
//     加减是"分量"层 +百分点，累加；归一化后再按占比抽。
//   结果概率 —— 同构，两段抽（favorable/unfavorable）：
//     1) 先按两档归一化抽一侧
//     2) 抽到哪侧，再抽该类结果
//   无上限兜底（用户要求）。

// ---------- 事件概率 ----------
// 三档基准分量（只需相对大小，不必加和=100，但保持直观）
export const EVENT_TIER_BASE = {
  common: 70,
  rare: 25,
  critical: 5,
} as const

// ---------- 结果概率 ----------
// 有利/不利基准分量
export const RESULT_SIDE_BASE = {
  favorable: 75,
  unfavorable: 25,
} as const

// ---------- 状态加成（分量层 +百分点；累加） ----------
// 龙迫：给目标的不利结果加成、给事件里的不利/危急加成
// （这里只放"分量加成"，实际影响在 modifiers.ts 中按来源叠加）
export const MODIFIER = {
  // 龙迫对事件档位：危急 +10、稀有 +5（普通不变）
  dragonCoerceTier: { critical: 10, rare: 5, common: 0 },
  // 龙迫对结果倾向：不利 +15（有利不变）
  dragonCoerceSide: { favorable: 0, unfavorable: 15 },
} as const

// ---------- 小事件 ----------
export const SMALL_EVENT = {
  base: 0.4,
  mainChoiceBonus: {
    study: 0.25,
    bond: 0.25,
    rest: 0,
    investigate: 0,
  } as Record<string, number>,
  relationNegative: -0.4,
  relationNeutral: 0.01,
  relationPositive: 0.15,
} as const

// ---------- 伤害 ----------
// 极端度 e = clamp(战力差/50, -1, 2) + clamp(恨/50, 0, 2)
// 四档基础分布（会按 e 平移后归一化）
export const DAMAGE = {
  powerGapUnit: 50,
  hateUnit: 50,
  base: { none: 0.50, light: 0.30, heavy: 0.15, death: 0.05 },
  eNone: -0.15,
  eHeavy: 0.10,
  eDeath: 0.05,
} as const