// 因子演化：纯函数。v4.1：修 data.gate 的 unknown 比较（类型收窄）。

import type { FactorGroup } from '../script/types'
import type { Rng } from './rng'

export function parseFutureGroupOwner(group: FactorGroup): string | null {
  if (group.special !== 'future') return null
  const idx = group.id.indexOf('::future')
  if (idx <= 0) return null
  return group.id.slice(0, idx)
}

export interface EvolveResult {
  active: Set<string>
  activated: string[]
  deactivated: string[]
  futureFired: { groupId: string; owner: string | null; picked: string | null }[]
}

/** 读取组的 gate 标记（安全地从 unknown data 中取字符串） */
function readGate(group: FactorGroup): string | undefined {
  const g = group.data?.gate
  return typeof g === 'string' ? g : undefined
}

export function evolveFactors(
  groups: FactorGroup[],
  active: ReadonlySet<string>,
  rng: Rng,
  isOpening = false,
): EvolveResult {
  const nextActive = new Set<string>(active)
  const activated: string[] = []
  const deactivated: string[] = []
  const futureFired: EvolveResult['futureFired'] = []

  for (const group of groups) {
    const owner = parseFutureGroupOwner(group)

    // ---- 未来组 ----
    if (group.special === 'future') {
      if (!owner || !nextActive.has(owner)) continue
      const idx = rng.weightedIndex(group.members.map((m) => m.chance))
      const picked = idx >= 0 ? group.members[idx].factorId : null
      if (picked) {
        nextActive.add(picked)
        activated.push(picked)
      }
      nextActive.delete(owner)
      deactivated.push(owner)
      futureFired.push({ groupId: group.id, owner, picked })
      continue
    }

    // ---- 普通组 ----
    if (readGate(group) === 'opening' && !isOpening) continue

    const idx = rng.weightedIndex(group.members.map((m) => m.chance))
    if (idx >= 0) {
      const picked = group.members[idx].factorId
      if (!nextActive.has(picked)) {
        nextActive.add(picked)
        activated.push(picked)
      }
    }
  }

  return { active: nextActive, activated, deactivated, futureFired }
}