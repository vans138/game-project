// 伤害概率计算（v7）
//
// 设计原则（按用户要求"不认真做，当概率做"）：
//   - 不追求精确，只要"战力差越大、好感越低 → 伤害越高"的直觉成立；
//   - 输出四档：无伤 / 轻伤 / 重伤 / 死亡；
//   - 用种子随机，可复现。
//
// 公式：
//   powerGap = attackerPower - defenderPower（正=攻方强）
//   hate = -defenderToAttackerAffinity（好感为负越多 hate 越大）
//   极端度 e = clamp(powerGap / 50, -1, 2) + clamp(hate / 50, 0, 2)  —— 大致落在 [-1, 4]
//   基础概率（无伤/轻伤/重伤/死亡）按 e 平移：
//     无伤  base 0.5 - 0.15e
//     轻伤  base 0.3
//     重伤  base 0.15 + 0.10e
//     死亡  base 0.05 + 0.05e
//   再归一化到 [0,1]。

import type { DamageTier } from '../script/types'
import type { Rng } from './rng'

export interface DamageInput {
  attackerPower: number
  defenderPower: number
  /** 防守方对攻击方的好感值（负=敌意） */
  defenderAffinityToAttacker: number
}

export interface DamageResult {
  tier: DamageTier
  /** 调试用：归一化前的四个权重 */
  raw: { none: number; light: number; heavy: number; death: number }
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}

export function calcDamage(input: DamageInput, rng: Rng): DamageResult {
  const powerGap = input.attackerPower - input.defenderPower
  const hate = Math.max(0, -input.defenderAffinityToAttacker)

  const e = clamp(powerGap / 50, -1, 2) + clamp(hate / 50, 0, 2)

  const wNone = Math.max(0.01, 0.50 - 0.15 * e)
  const wLight = 0.30
  const wHeavy = Math.max(0.01, 0.15 + 0.10 * e)
  const wDeath = Math.max(0.01, 0.05 + 0.05 * e)

  const sum = wNone + wLight + wHeavy + wDeath
  const roll = rng.next() * sum

  let acc = 0
  let tier: DamageTier = 'none'
  if ((acc += wNone) > roll) tier = 'none'
  else if ((acc += wLight) > roll) tier = 'light'
  else if ((acc += wHeavy) > roll) tier = 'heavy'
  else tier = 'death'

  return {
    tier,
    raw: { none: wNone, light: wLight, heavy: wHeavy, death: wDeath },
  }
}

/** 伤害结果的叙述文本 */
export function damageNarrative(tier: DamageTier, targetName: string): string {
  switch (tier) {
    case 'none':
      return `有什么东西在你和${targetName}之间擦了过去。${targetName}退后一步，脸色发白，但没有受伤。`
    case 'light':
      return `${targetName}踉跄着撞到墙上，嘴角见了血，但没有更糟。`
    case 'heavy':
      return `${targetName}倒在地上，很久没能站起来。走廊里安静得可怕。`
    case 'death':
      return `事情发生得太快。等你回过神来，${targetName}已经不动了。`
  }
}