// 线索运行态工具（v7）
//
// 一条线索从"获得"开始，可被调查 `stages.length` 次，逐层揭示。
// 到全部揭示 → done=true。
//
// 运行态存在 RunEngine.player.clueRuntime 里：
//   Record<clueId, { stage: number }>
//   stage 表示"已调查到第几层"（0=未调查，1=揭示了第一层……）

import type { ClueDef } from '../script/types'

export interface ClueRuntimeEntry {
  /** 已调查层数（0 表示刚获得、还没调查过） */
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

/** 调查一次；返回新揭示的文本（若已揭完返回 null） */
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

/** 可调查的线索（未揭完） */
export function listInvestigable(defs: ClueDef[], rt: ClueRuntime): ClueDef[] {
  return defs.filter((d) => rt[d.id] && rt[d.id].stage < d.stages.length)
}