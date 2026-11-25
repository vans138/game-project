// 因子演化：纯函数，不依赖 React/DOM。
//
// 模型：因子是「互斥组」的成员。
//   普通组：组内按成员 chance 独立互斥抽取（剩余概率 = 都不选）。
//   未来组（special='future'）：
//     * 一定触发（必然命中组内某成员）
//     * 视为该因子本轮"最后一次触发"
//     * 触发后原因子从已激活集合移除（off）
// 组与组之间的触发顺序/条件不结构化，由配置层人工约定：
//   - 本函数按"当前激活因子 + 传入的组顺序"筛选参与组。
//   - 一个组是否参与，规则如下（可在此集中调整，保持单一入口）：
//       1) 未来组：仅当其 owner 因子处于激活态时参与；触发后 owner 移除。
//       2) 普通组：始终参与（开局抽一次，之后每轮演化都参与）。
//          若希望某些组只在特定条件下参与，可在 group.data 里加标记，
//          本函数预留 group.data.gate === 'opening' 表示"只在开局（已激活为空）时参与"。

import type { FactorGroup } from '../script/types'
import type { Rng } from './rng'

/** 解析未来组 id："<owner>::future" → owner；不是未来组返回 null */
export function parseFutureGroupOwner(group: FactorGroup): string | null {
  if (group.special !== 'future') return null
  const idx = group.id.indexOf('::future')
  if (idx <= 0) return null
  return group.id.slice(0, idx)
}

export interface EvolveResult {
  /** 演化后的已激活集合（新集合，不修改入参） */
  active: Set<string>
  /** 本轮新激活的因子 id（用于日志/UI 提示） */
  activated: string[]
  /** 本轮被关闭的因子 id（未来组触发时 owner 被移除） */
  deactivated: string[]
  /** 本轮触发的未来组信息（若发生） */
  futureFired: { groupId: string; owner: string | null; picked: string | null }[]
}

/**
 * 执行一次因子演化。
 * @param groups 全部因子组（顺序即参与顺序，配置层可通过顺序控制）
 * @param active 当前已激活因子集合（不修改）
 * @param rng    种子随机
 * @param isOpening 是否为开局初始化（决定 data.gate==='opening' 的组是否参与）
 */
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
      // owner 必须处于激活态才参与
      if (!owner || !nextActive.has(owner)) continue
      const idx = rng.weightedIndex(group.members.map((m) => m.chance))
      const picked = idx >= 0 ? group.members[idx].factorId : null
      if (picked) {
        nextActive.add(picked)
        activated.push(picked)
      }
      // 触发后 owner off
      nextActive.delete(owner)
      deactivated.push(owner)
      futureFired.push({ groupId: group.id, owner, picked })
      continue
    }

    // ---- 普通组 ----
    if (group.data && group.data.gate === 'opening') {
      // 开局专用组：只在开局参与
      if (!isOpening) continue
    }
    const idx = rng.weightedIndex(group.members.map((m) => m.chance))
    if (idx >= 0) {
      const picked = group.members[idx].factorId
      // 互斥保护：已被别的组激活的因子不再重复加入
      if (!nextActive.has(picked)) {
        nextActive.add(picked)
        activated.push(picked)
      }
    }
    // idx === -1 表示"都不选"，什么都不做
  }

  return { active: nextActive, activated, deactivated, futureFired }
}