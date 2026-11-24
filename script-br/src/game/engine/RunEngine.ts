// 局内引擎：月推进、事件、效果结算、结局判定。
// 本轮新增：好感总封顶（affinityCap）约束，超封顶按比例裁回；Snapshot 附带好感面板数据。

import type { Script, Role } from '../script/types'
import { evalCondition, applyEffects, type EvalContext } from './evaluator'

interface PlayerRuntime {
  roleId: string
  identityTags: Set<string>
  affinity: Record<string, number>
  flags: Set<string>
  goalProgress: Record<string, number>
}

interface RunState {
  monthIndex: number
  player: PlayerRuntime
  finished: boolean
}

export interface Snapshot {
  monthIndex: number
  year: number
  month: number
  narrative: string
  choices: { id: string; text: string }[]
  finished: boolean
  outcomeTitle?: string
  outcomeNarrative?: string
  /** 好感面板：按当前好感降序排列 */
  affinityPanel: { id: string; value: number }[]
  affinityTotal: number
  affinityCap: number
}

export const ADVANCE = '__advance__'

export class RunEngine {
  private state: RunState
  private script: Script
  private listeners = new Set<(s: Snapshot) => void>()
  private lastOutcomeTitle?: string
  private lastOutcomeNarrative?: string

  constructor(script: Script, role: Role) {
    const affinity: Record<string, number> = {}
    for (const npc of script.npcs) affinity[npc.id] = npc.affinityStart
    this.script = script
    this.state = {
      monthIndex: 1,
      finished: false,
      player: {
        roleId: role.id,
        identityTags: new Set(role.identityTags),
        affinity,
        flags: new Set(),
        goalProgress: {},
      },
    }
  }

  private ctx(): EvalContext {
    return {
      identityTags: this.state.player.identityTags,
      affinity: this.state.player.affinity,
      flags: this.state.player.flags,
      goalProgress: this.state.player.goalProgress,
      month: this.state.monthIndex,
    }
  }

  private role(): Role {
    return this.script.roles.find((r) => r.id === this.state.player.roleId)!
  }

  private currentEvent() {
    const md = this.script.timeline.find((m) => m.index === this.state.monthIndex)
    if (!md) return { md: undefined, ev: undefined }
    if (md.fixedEvent) {
      return { md, ev: this.script.events.find((e) => e.id === md.fixedEvent) }
    }
    if (md.randomPool && md.randomPool.length) {
      const pick = md.randomPool[(this.state.monthIndex * 7) % md.randomPool.length]
      return { md, ev: this.script.events.find((e) => e.id === pick) }
    }
    return { md, ev: undefined }
  }

  snapshot(): Snapshot {
    const md = this.script.timeline.find((m) => m.index === this.state.monthIndex)
    const panel = Object.entries(this.state.player.affinity)
      .map(([id, value]) => ({ id, value }))
      .sort((a, b) => b.value - a.value)
    const total = panel.reduce((s, p) => s + Math.max(0, p.value), 0)

    if (!md) {
      return {
        monthIndex: this.state.monthIndex, year: 3, month: 10,
        narrative: this.lastOutcomeNarrative ?? '三年走完了。',
        choices: [], finished: true,
        outcomeTitle: this.lastOutcomeTitle, outcomeNarrative: this.lastOutcomeNarrative,
        affinityPanel: panel, affinityTotal: total, affinityCap: this.script.affinityCap,
      }
    }

    if (this.state.finished) {
      return {
        monthIndex: this.state.monthIndex, year: md.year, month: md.month,
        narrative: this.lastOutcomeNarrative ?? '三年走完了。',
        choices: [], finished: true,
        outcomeTitle: this.lastOutcomeTitle, outcomeNarrative: this.lastOutcomeNarrative,
        affinityPanel: panel, affinityTotal: total, affinityCap: this.script.affinityCap,
      }
    }

    const { ev } = this.currentEvent()
    const role = this.role()
    const head = [`第 ${md.year} 学年 · 第 ${md.month} 月`, `〔表面任务〕${role.surfaceTask}`]
    let narrative = head.join('\n') + '\n\n'
    let choices: { id: string; text: string }[] = []

    if (ev) {
      narrative += `【${ev.title}】\n${ev.narrative}`
      const ctxCopy = this.ctx()
      choices = ev.choices
        .filter((c) => evalCondition(c.require, ctxCopy))
        .map((c) => ({ id: c.id, text: c.text }))
    } else {
      narrative += '这个月平静地过去了，教室里只有粉笔的声音。'
    }

    return {
      monthIndex: this.state.monthIndex, year: md.year, month: md.month,
      narrative, choices, finished: false,
      affinityPanel: panel, affinityTotal: total, affinityCap: this.script.affinityCap,
    }
  }

  choose(choiceId: string): Snapshot {
    if (this.state.finished) return this.snapshot()
    const { ev } = this.currentEvent()

    if (!ev || choiceId === ADVANCE) {
      this.advance()
      const s = this.snapshot()
      this.emit(s)
      return s
    }

    const choice = ev.choices.find((c) => c.id === choiceId)
    if (!choice) return this.snapshot()

    const ctx = this.ctx()
    const logs = applyEffects(choice.effects, ctx)
    // 好感总封顶约束：若正向总和超 cap，等比裁回；负值不裁
    this.enforceAffinityCap(ctx.affinity)

    this.state.player.identityTags = ctx.identityTags
    this.state.player.affinity = ctx.affinity
    this.state.player.flags = ctx.flags
    this.state.player.goalProgress = ctx.goalProgress

    this.advance()
    const s = this.snapshot()
    if (logs.length) s.narrative = logs.join('\n') + '\n\n' + s.narrative
    this.emit(s)
    return s
  }

  /** 好感正向总量超封顶时，按比例裁剪到 cap */
  private enforceAffinityCap(aff: Record<string, number>) {
    const cap = this.script.affinityCap
    let positiveSum = 0
    for (const k of Object.keys(aff)) positiveSum += Math.max(0, aff[k])
    if (positiveSum <= cap) return
    const ratio = cap / positiveSum
    for (const k of Object.keys(aff)) {
      if (aff[k] > 0) aff[k] = Math.floor(aff[k] * ratio)
    }
  }

  private advance() {
    if (this.state.monthIndex >= this.script.timeline.length) {
      this.finish()
      return
    }
    this.state.monthIndex += 1
  }

  private finish() {
    this.state.finished = true
    const role = this.role()
    const goal = this.script.goals.find((g) => g.id === role.privateGoalId)
    if (!goal) {
      this.lastOutcomeTitle = '【平淡】毕业'
      this.lastOutcomeNarrative = '你走完了三年。'
      return
    }
    const progress = this.state.player.goalProgress[goal.id] ?? 0
    const ratio = Math.min(1, progress / goal.target)
    const ctx = this.ctx()
    for (const o of this.script.outcomes) {
      const condOk = evalCondition(o.require, ctx)
      const ratioOk = o.minGoalRatio === undefined || ratio >= o.minGoalRatio
      if (condOk && ratioOk) {
        this.lastOutcomeTitle = o.title
        this.lastOutcomeNarrative = o.narrative
        return
      }
    }
    this.lastOutcomeTitle = '【平淡】毕业'
    this.lastOutcomeNarrative = '你走完了三年。'
  }

  subscribe(listener: (s: Snapshot) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }
  private emit(s: Snapshot) {
    this.listeners.forEach((fn) => fn(s))
  }
}