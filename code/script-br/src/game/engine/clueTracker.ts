// 线索追踪：管理本局已投影 / 已调查的线索。纯数据，不依赖 React。
// 运行态存进 RunState.clues，由 RunEngine 在上下学时驱动（见 next 步）。

import type { Clue, Conflict } from '../script/types'

export interface ClueRuntime {
  clueId: string
  /** 已投射到哪个回合 */
  projectedMonth: number
  /** 剩余调查深度：走到 0 即"看穿矛盾" */
  remaining: number
  /** 累计调查步 */
  investigatedSteps: number
}

export type CluePool = Record<string, ClueRuntime>

/** 从线索池里挑一条还没投影过的、且与当前激活因子 tags 有交集的线索候选 */
export function pickProjection(
  clues: Clue[],
  usedClueIds: ReadonlySet<string>,
  activeConflictIds: ReadonlySet<string>,
  conflictById: Map<string, Conflict>,
  activeFactorTagIntersect: (c: Conflict) => boolean,
): Clue | null {
  const candidates = clues.filter((c) => {
    if (usedClueIds.has(c.id)) return false
    if (activeConflictIds.has(c.conflictId)) return false
    const cf = conflictById.get(c.conflictId)
    if (!cf) return false
    return activeFactorTagIntersect(cf)
  })
  return candidates.length ? candidates[0] : null
}

/** 对一条线索推进一次调查；返回是否看清（remaining 到 0） */
export function investigateOnce(rt: ClueRuntime): boolean {
  rt.investigatedSteps += 1
  rt.remaining = Math.max(0, rt.remaining - 1)
  return rt.remaining === 0
}