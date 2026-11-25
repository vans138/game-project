// 概率调制内核（v9）
//
// 统一模型：
//   - 事件：三档分量 = EVENT_TIER_BASE + 各来源加成（累加）
//   - 结果：两侧分量 = RESULT_SIDE_BASE + 各来源加成（累加）
//   然后各自归一化为"占比"，按占比抽。
//
// 本文件提供"分量"的聚合与归一化，不负责具体抽取（抽取在 RunEngine）。

import type { EventTier } from '../script/types'
import { EVENT_TIER_BASE, RESULT_SIDE_BASE, MODIFIER } from './balance'

/** 单次抽取时的调制来源（来自目标身上当前挂着的状态） */
export interface ModifierSource {
  dragonCoercedThisMonth: boolean
}

/** 事件档位分量表 */
export type TierWeights = Record<EventTier, number>

/** 结果两侧分量表 */
export interface SideWeights {
  favorable: number
  unfavorable: number
}

/** 事件档位的初始分量（拷贝基准，避免污染常量） */
export function baseTierWeights(): TierWeights {
  return { ...EVENT_TIER_BASE }
}

/** 结果两侧初始分量 */
export function baseSideWeights(): SideWeights {
  return { ...RESULT_SIDE_BASE }
}

/**
 * 叠加一个来源对"事件档位"的加成（分量层 +百分点）。
 * 返回新对象，不修改入参。
 */
export function applyTierModifier(weights: TierWeights, src: ModifierSource): TierWeights {
  if (!src.dragonCoercedThisMonth) return weights
  return {
    common: weights.common + MODIFIER.dragonCoerceTier.common,
    rare: weights.rare + MODIFIER.dragonCoerceTier.rare,
    critical: weights.critical + MODIFIER.dragonCoerceTier.critical,
  }
}

/** 叠加一个来源对"结果两侧"的加成 */
export function applySideModifier(weights: SideWeights, src: ModifierSource): SideWeights {
  if (!src.dragonCoercedThisMonth) return weights
  return {
    favorable: weights.favorable + MODIFIER.dragonCoerceSide.favorable,
    unfavorable: weights.unfavorable + MODIFIER.dragonCoerceSide.unfavorable,
  }
}

/** 归一化为占比；总和 <= 0 时退化为均匀 */
export function normalizeTier(weights: TierWeights): TierWeights {
  const sum = weights.common + weights.rare + weights.critical
  if (sum <= 0) return { common: 1 / 3, rare: 1 / 3, critical: 1 / 3 }
  return {
    common: weights.common / sum,
    rare: weights.rare / sum,
    critical: weights.critical / sum,
  }
}

export function normalizeSide(weights: SideWeights): SideWeights {
  const sum = weights.favorable + weights.unfavorable
  if (sum <= 0) return { favorable: 0.5, unfavorable: 0.5 }
  return {
    favorable: weights.favorable / sum,
    unfavorable: weights.unfavorable / sum,
  }
}

/**
 * 从归一化后的三档里抽一档。
 * 按 common → rare → critical 顺序累计，取第一个累计值 > roll 的档。
 * weights 已经是占比（和=1）。
 */
export function pickTier(norm: TierWeights, roll: number): EventTier {
  if (roll < norm.common) return 'common'
  if (roll < norm.common + norm.rare) return 'rare'
  return 'critical'
}

/**
 * 从归一化的两侧里抽一侧。
 */
export function pickSide(norm: SideWeights, roll: number): 'favorable' | 'unfavorable' {
  return roll < norm.favorable ? 'favorable' : 'unfavorable'
}