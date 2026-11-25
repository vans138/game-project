// 线索运行态工具（v8 不变，仅注释同步）

import type { ClueDef } from '../script/types'

export interface ClueRuntimeEntry {
  stage: number
}

export type ClueRuntime = Record<string, ClueRuntimeEntry>

export function acquireClue(rt: ClueRuntime, clueId: string) {
  if (!rt[clueId]) rt[clueId] = { stage: 0 }
}

export function isClueDone(def: ClueDef, entry: ClueRuntimeEntry | undefined): boolean {
  if (!entry) return false
  return entry.stage >= def.stages.length
}

export function investigateClue(
  def: ClueDef,
  rt: ClueRuntime,
): { text: string; done: boolean } | null {
  const entry = rt[def.id]
  if (!entry) return null
  if (entry.stage >= def.stages.length) return null
  const stageDef = def.stages[entry.stage]
  entry.stage += 1
  return {
    text: `【${stageDef.title}】\n${stageDef.text}`,
    done: entry.stage >= def.stages.length,
  }
}

export function listInvestigable(defs: ClueDef[], rt: ClueRuntime): ClueDef[] {
  return defs.filter((d) => rt[d.id] && rt[d.id].stage < d.stages.length)
}