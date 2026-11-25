// 概率调制（v8）
//
// 把"状态 → 加成倍数"集中到一处，避免在抽取逻辑里写 if
// 目前包含：
//   - 龙迫：目标本月行动失效；有利权重 ×0.5、不利权重 ×1.5；

import type { Valence } from '../script/types'

/** 单次抽取时的调制来源（来自目标身上当前挂着的状态） */
export interface ModifierSource {
  /** 本月是否被龙迫过（被龙迫 → 有利↓不利↑） */
  dragonCoercedThisMonth: boolean
}

export const FAVORABLE_MULT_COERCED = 0.5
export const UNFAVORABLE_MULT_COERCED = 1.5

/** 把 valence 按状态调制，返回新的 valence（不修改原对象） */
export function modulateValence(v: Valence, src: ModifierSource): Valence {
  if (!src.dragonCoercedThisMonth) return v
  return {
    favorable: (v.favorable ?? 0) * FAVORABLE_MULT_COERCED,
    unfavorable: (v.unfavorable ?? 0) * UNFAVORABLE_MULT_COERCED,
    neutral: v.neutral,
  }
}

/** 从 valence 计算"抽取权重"（取各项之和，如果都没设默认 1） */
export function valenceWeight(v: Valence): number {
  const sum = (v.favorable ?? 0) + (v.unfavorable ?? 0) + (v.neutral ?? 0)
  return sum > 0 ? sum : 1
}