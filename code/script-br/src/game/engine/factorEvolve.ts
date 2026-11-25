// 因子演化（v4.3）
//
// 未来组（special='future'）抽签规则：
//   1) 若组内存在 special='terminate' 且 chance === 1 的成员：硬压制其它成员，
//      必然命中终结 → owner off，不再有其它落点。
//   2) 否则：从"非终结成员"中按 chance 加权抽一个落点，因子保留。
//
// 终结概率的调整：
//   通过 setTerminate effect 改写某组"终结成员"的 chance（0 或 1）。
//   factorGroups 是只读剧本数据；为了让玩家行为能持续影响后续演化，
//   在 evolveFactors 里支持传入"终结覆盖表"（terminateOverride），
//   调用方（RunEngine）持有该表，effect 改写它。

import type { FactorGroup } from '../script/types'
import type { Rng } from './rng'

export function parseFutureGroupOwner(group: FactorGroup): string | null {
  if (group.special !== 'future') return null
  const idx = group.id.indexOf('::future')
  if (idx <= 0) return null
  return group.id.slice(0, idx)
}

/** 读取组的 gate 标记（安全地从 unknown data 中取字符串） */
function readGate(group: FactorGroup): string | undefined {
  const g = group.data?.gate
  return typeof g === 'string' ? g : undefined
}

/** 终结覆盖表：groupId → 终结成员 chance（0 或 1） */
export type TerminateOverride = Record<string, 0 | 1>

export interface EvolveResult {
  active: Set<string>
  activated: string[]
  deactivated: string[]
  futureFired: {
    groupId: string
    owner: string | null
    picked: string | null
    terminated: boolean
  }[]
}

export function evolveFactors(
  groups: FactorGroup[],
  active: ReadonlySet<string>,
  rng: Rng,
  opts: { isOpening?: boolean; terminateOverride?: TerminateOverride } = {},
): EvolveResult {
  const { isOpening = false, terminateOverride = {} } = opts
  const nextActive = new Set<string>(active)
  const activated: string[] = []
  const deactivated: string[] = []
  const futureFired: EvolveResult['futureFired'] = []

  for (const group of groups) {
    const owner = parseFutureGroupOwner(group)

    // ---- 未来组 ----
    if (group.special === 'future') {
      if (!owner || !nextActive.has(owner)) continue

      // 终结成员的目标 chance：优先用覆盖表；否则用组内配置
      const termMember = group.members.find((m) => m.special === 'terminate')
      const termChance = termMember
        ? (terminateOverride[group.id] ?? (termMember.chance >= 1 ? 1 : 0))
        : 0

      // 规则 1：终结 = 1 → 硬压制，必然终结
      if (termMember && termChance === 1) {
        nextActive.delete(owner)
        deactivated.push(owner)
        futureFired.push({
          groupId: group.id,
          owner,
          picked: termMember.factorId,
          terminated: true,
        })
        continue
      }

      // 规则 2：普通落点抽签（排除终结成员）
      const nonTerm = group.members.filter((m) => m.special !== 'terminate' && m.chance > 0)
      if (nonTerm.length > 0) {
        const idx = rng.weightedIndex(nonTerm.map((m) => m.chance))
        if (idx >= 0) {
          const picked = nonTerm[idx].factorId
          if (!nextActive.has(picked)) {
            nextActive.add(picked)
            activated.push(picked)
          }
          futureFired.push({ groupId: group.id, owner, picked, terminated: false })
        }
      }
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