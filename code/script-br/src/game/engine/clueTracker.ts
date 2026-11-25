// 线索追踪（v4.3）：按"因子是否激活"来筛可投影线索。
// 三层：因子（布线/门控） → 线索（投影） → 矛盾（真相根）

import type { Clue } from '../script/types'

/** 已投影线索的运行态 */
export interface ClueRuntime {
  clueId: string
  projectedMonth: number
  /** 剩余调查深度；到 0 视为"看清矛盾" */
  remaining: number
  investigatedSteps: number
}

export type CluePool = Record<string, ClueRuntime>

/**
 * 挑选一条可投影的线索：
 *   - 其 factorId 在本局已激活因子集合内
 *   - 该线索尚未被投影过
 *   - 线索指向的矛盾尚未被破解（由调用方通过 blockedClueIds 传入）
 */
export function pickProjection(
  clues: Clue[],
  activeFactors: ReadonlySet<string>,
  usedClueIds: ReadonlySet<string>,
  blockedClueIds: ReadonlySet<string> = new Set(),
): Clue | null {
  for (const c of clues) {
    if (usedClueIds.has(c.id)) continue
    if (blockedClueIds.has(c.id)) continue
    if (!c.factorId) continue
    if (!activeFactors.has(c.factorId)) continue
    return c
  }
  return null
}

/** 调查一次；返回是否看清（remaining 归零） */
export function investigateOnce(rt: ClueRuntime): boolean {
  rt.investigatedSteps += 1
  rt.remaining = Math.max(0, rt.remaining - 1)
  return rt.remaining === 0
}