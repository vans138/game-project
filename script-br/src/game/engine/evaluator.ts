// 条件求值与效果作用：纯函数，不依赖 React/DOM，便于单测与将来复用到服务端。
import type { Condition, Effect } from '../script/types'

/** 求值所需的最小上下文（从 RunState 中玩家与全局抽取） */
export interface EvalContext {
  identityTags: Set<string>
  affinity: Record<string, number>
  flags: Set<string>
  goalProgress: Record<string, number>
  month: number
}

/** 判断条件是否满足 */
export function evalCondition(cond: Condition | undefined, ctx: EvalContext): boolean {
  if (!cond) return true
  if ('all' in cond) return cond.all.every((c) => evalCondition(c, ctx))
  if ('any' in cond) return cond.any.some((c) => evalCondition(c, ctx))
  if ('hasIdentity' in cond) return ctx.identityTags.has(cond.hasIdentity)
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
  return true
}

/** 应用效果，注意这里直接修改传入的 ctx（调用方持有可变副本） */
export function applyEffects(effects: Effect[], ctx: EvalContext): string[] {
  const logs: string[] = []
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
    }
  }
  return logs
}