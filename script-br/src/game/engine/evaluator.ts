// 条件求值与效果作用（v7）
// 相对 v6：
//   - Effect 增加 gainClue；由 applyEffects 记录到 logs（真正写入线索由 RunEngine 拦截处理）

import type { Condition, Effect, IdentityFactorId } from '../script/types'

export interface EvalContext {
  identityTags: Set<string>
  identityFactor: IdentityFactorId
  affinity: Record<string, number>
  flags: Set<string>
  goalProgress: Record<string, number>
  month: number
  activeFactors: ReadonlySet<string>
}

export function evalCondition(cond: Condition | undefined, ctx: EvalContext): boolean {
  if (!cond) return true
  if ('all' in cond) return cond.all.every((c) => evalCondition(c, ctx))
  if ('any' in cond) return cond.any.some((c) => evalCondition(c, ctx))
  if ('hasIdentity' in cond) return ctx.identityTags.has(cond.hasIdentity)
  if ('identityFactorIs' in cond) return ctx.identityFactor === cond.identityFactorIs
  if ('affinityAtLeast' in cond) {
    const [npc, v] = cond.affinityAtLeast
    return (ctx.affinity[npc] ?? 0) >= v
  }
  if ('flag' in cond) return ctx.flags.has(cond.flag)
  if ('goalProgressAtLeast' in cond) {
    const [goal, v] = cond.goalProgressAtLeast
    return (ctx.goalProgress[goal] ?? 0) >= v
  }
  if ('monthAtLeast' in cond) return ctx.month >= cond.monthAtLeast
  if ('factorActive' in cond) return ctx.activeFactors.has(cond.factorActive)
  return false
}

export interface ApplyEffectsResult {
  logs: string[]
  /** v7：本次效果带来的线索 id（多条） */
  gainedClues: string[]
}

export function applyEffects(effects: Effect[], ctx: EvalContext): ApplyEffectsResult {
  const logs: string[] = []
  const gainedClues: string[] = []
  for (const e of effects) {
    switch (e.type) {
      case 'affinity':
        ctx.affinity[e.target] = (ctx.affinity[e.target] ?? 0) + e.value
        break
      case 'unlock':
        ctx.flags.add(`unlock:${e.target}`)
        break
      case 'flag':
        ctx.flags.add(e.target)
        break
      case 'goalProgress':
        ctx.goalProgress[e.target] = (ctx.goalProgress[e.target] ?? 0) + e.value
        break
      case 'log':
        logs.push(e.text)
        break
      case 'gainClue':
        gainedClues.push(e.clueId)
        break
      default:
        break
    }
  }
  return { logs, gainedClues }
}