// 局内引擎。v4.2：
//   - 修：本月内已播事件不重复抽（usedEventIds）
//   - 修：advance 兜底逻辑更清晰；空事件不再需要 UI 给"推进"按钮
//   - next 强制转移时保留进入链的叙述

import type { Script, Role, EventDef, MonthDef } from '../script/types'
import { evalCondition, applyEffects, type EvalContext } from './evaluator'
import { createRng, type Rng } from './rng'
import { evolveFactors } from './factorEvolve'

interface PlayerRuntime {
  roleId: string
  identityTags: Set<string>
  affinity: Record<string, number>
  flags: Set<string>
  goalProgress: Record<string, number>
}

interface MonthRuntime {
  currentEventId: string
  usedSteps: number
  /** 本月已播过的事件 id，避免同月重复 */
  usedEventIds: Set<string>
}

interface RunState {
  monthIndex: number
  year: number
  month: number
  player: PlayerRuntime
  activeFactors: Set<string>
  monthRuntime: MonthRuntime | null
  finished: boolean
  narrative: string
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
  affinityPanel: { id: string; value: number }[]
  affinityTotal: number
  affinityCap: number
  activeFactors: { id: string; title: string }[]
}

export const ADVANCE = '__advance__'

function hashSeed(s: string): number {
  let h = 2166136261 >>> 0
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619) >>> 0
  }
  return h >>> 0
}

export class RunEngine {
  private state: RunState
  private script: Script
  private listeners = new Set<(s: Snapshot) => void>()
  private lastOutcomeTitle?: string
  private lastOutcomeNarrative?: string
  private rng: Rng
  private choicesCache: { id: string; text: string }[] = []

  constructor(script: Script, role: Role, seed?: number) {
    this.script = script
    this.rng = createRng(seed ?? hashSeed(role.id + ':' + Date.now()))

    const affinity: Record<string, number> = {}
    for (const npc of script.npcs) affinity[npc.id] = npc.affinityStart

    const openingEvolve = evolveFactors(script.factorGroups, new Set(), this.rng, true)

    this.state = {
      monthIndex: 1,
      year: script.timeline[0]?.year ?? 1,
      month: script.timeline[0]?.month ?? 9,
      finished: false,
      monthRuntime: null,
      narrative: '',
      activeFactors: openingEvolve.active,
      player: {
        roleId: role.id,
        identityTags: new Set(role.identityTags),
        affinity,
        flags: new Set(),
        goalProgress: {},
      },
    }

    this.enterMonth(this.state.monthIndex, /* skipEvolve */ true)
  }

  private ctx(): EvalContext {
    return {
      identityTags: this.state.player.identityTags,
      affinity: this.state.player.affinity,
      flags: this.state.player.flags,
      goalProgress: this.state.player.goalProgress,
      month: this.state.monthIndex,
      activeFactors: this.state.activeFactors,
    }
  }

  private role(): Role {
    return this.script.roles.find((r) => r.id === this.state.player.roleId)!
  }

  private monthDef(): MonthDef | undefined {
    return this.script.timeline.find((m) => m.index === this.state.monthIndex)
  }

  private eventById(id: string | undefined): EventDef | undefined {
    if (!id) return undefined
    return this.script.events.find((e) => e.id === id)
  }

  /** 从本月随机池中按 season 过滤 + 排除已播 + weight 加权抽 */
  private pickFromPool(md: MonthDef, exclude: Set<string>): string | undefined {
    const pool = md.randomPool ?? []
    const type = md.type
    const candidates: EventDef[] = []
    for (const id of pool) {
      if (exclude.has(id)) continue
      const ev = this.eventById(id)
      if (!ev) continue
      if (ev.season === 'both' || ev.season === type) candidates.push(ev)
    }
    if (candidates.length === 0) return undefined
    const weights = candidates.map((c) => c.weight ?? 1)
    const idx = this.rng.weightedIndex(weights)
    return idx >= 0 ? candidates[idx].id : undefined
  }

  private enterMonth(monthIndex: number, skipEvolve = false) {
    const md = this.script.timeline.find((m) => m.index === monthIndex)
    if (!md) {
      this.finish()
      return
    }
    this.state.monthIndex = monthIndex
    this.state.year = md.year
    this.state.month = md.month
    this.state.monthRuntime = {
      currentEventId: '',
      usedSteps: 0,
      usedEventIds: new Set(),
    }

    if (!skipEvolve) {
      const evo = evolveFactors(this.script.factorGroups, this.state.activeFactors, this.rng, false)
      this.state.activeFactors = evo.active
    }

    this.renderCurrentStep()
  }

  private renderCurrentStep() {
    const md = this.monthDef()
    if (!md || !this.state.monthRuntime) return

    const rt = this.state.monthRuntime
    let evId: string | undefined
    if (rt.usedSteps === 0 && md.fixedEvent && !rt.usedEventIds.has(md.fixedEvent)) {
      evId = md.fixedEvent
    } else {
      evId = this.pickFromPool(md, rt.usedEventIds)
    }
    rt.currentEventId = evId ?? ''
    if (evId) rt.usedEventIds.add(evId)

    const ev = this.eventById(rt.currentEventId)
    const role = this.role()
    const head = [`第 ${md.year} 学年 · ${md.month} 月 · ${md.type === 'holiday' ? '假期' : '上学'}`]
    head.push(`〔表面任务〕${role.surfaceTask}`)
    const activeTitles = this.script.factorPool
      .filter((f) => this.state.activeFactors.has(f.id))
      .map((f) => f.title)
    if (activeTitles.length) head.push(`〔世界因子〕${activeTitles.join(' / ')}`)
    let narrative = head.join('\n') + '\n\n'

    let choices: { id: string; text: string }[] = []
    if (ev) {
      narrative += `【${ev.title}】\n${ev.narrative}`
      const ctxCopy = this.ctx()
      choices = ev.choices
        .filter((c) => evalCondition(c.require, ctxCopy))
        .map((c) => ({ id: c.id, text: c.text }))
    } else {
      // 池子空了或全被排除了：给一句平静叙述，同时给一个"继续"伪选项
      narrative += '这个月的余下时间平静地过去了。'
      choices = [{ id: ADVANCE, text: '（继续）' }]
    }
    this.state.narrative = narrative
    this.choicesCache = choices
  }

  snapshot(): Snapshot {
    const md = this.monthDef()
    const panel = Object.entries(this.state.player.affinity)
      .map(([id, value]) => ({ id, value }))
      .sort((a, b) => b.value - a.value)
    const total = panel.reduce((s, p) => s + Math.max(0, p.value), 0)
    const activeFactorList = this.script.factorPool
      .filter((f) => this.state.activeFactors.has(f.id))
      .map((f) => ({ id: f.id, title: f.title }))

    if (this.state.finished || !md) {
      return {
        monthIndex: this.state.monthIndex,
        year: this.state.year,
        month: this.state.month,
        narrative: this.state.narrative || this.lastOutcomeNarrative || '三年走完了。',
        choices: [],
        finished: true,
        outcomeTitle: this.lastOutcomeTitle,
        outcomeNarrative: this.lastOutcomeNarrative,
        affinityPanel: panel,
        affinityTotal: total,
        affinityCap: this.script.affinityCap,
        activeFactors: activeFactorList,
      }
    }

    return {
      monthIndex: this.state.monthIndex,
      year: md.year,
      month: md.month,
      narrative: this.state.narrative,
      choices: this.choicesCache,
      finished: false,
      affinityPanel: panel,
      affinityTotal: total,
      affinityCap: this.script.affinityCap,
      activeFactors: activeFactorList,
    }
  }

  choose(choiceId: string): Snapshot {
    if (this.state.finished) return this.snapshot()
    const rt = this.state.monthRuntime
    const ev = this.eventById(rt?.currentEventId)

    // 没有真实事件（平静月 / 池子空）：ADVANCE 或任意点击都算占一步
    if (!ev) {
      this.consumeStep([])
      const s = this.snapshot()
      this.emit(s)
      return s
    }

    const choice = ev.choices.find((c) => c.id === choiceId)
    if (!choice) return this.snapshot()

    const ctx = this.ctx()
    const logs = applyEffects(choice.effects, ctx)
    this.enforceAffinityCap(ctx.affinity)

    this.state.player.identityTags = ctx.identityTags
    this.state.player.affinity = ctx.affinity
    this.state.player.flags = ctx.flags
    this.state.player.goalProgress = ctx.goalProgress

    this.consumeStep(logs, choice.next ?? undefined)

    const s = this.snapshot()
    this.emit(s)
    return s
  }

  /**
   * 消耗一步。nextEventId 提供时，进入该事件继续本步（不计步），
   * 否则 usedSteps++，走满 stepCount 进入下月。
   */
  private consumeStep(logs: string[] = [], nextEventId?: string) {
    const md = this.monthDef()
    const rt = this.state.monthRuntime
    if (!md || !rt) return

    const logLine = logs.length ? logs.join('\n') + '\n\n' : ''

    if (nextEventId) {
      const nextEv = this.eventById(nextEventId)
      if (nextEv) {
        rt.currentEventId = nextEv.id
        rt.usedEventIds.add(nextEv.id)
        const ctxCopy = this.ctx()
        const choices = nextEv.choices
          .filter((c) => evalCondition(c.require, ctxCopy))
          .map((c) => ({ id: c.id, text: c.text }))
        this.state.narrative = logLine + `【${nextEv.title}】\n${nextEv.narrative}`
        this.choicesCache = choices
        return
      }
    }

    rt.usedSteps += 1

    if (rt.usedSteps >= md.stepCount) {
      this.enterMonth(md.index + 1)
      return
    }

    this.renderCurrentStep()
    if (logLine) this.state.narrative = logLine + this.state.narrative
  }

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

  private finish() {
    this.state.finished = true
    const role = this.role()
    const goal = this.script.goals.find((g) => g.id === role.privateGoalId)
    const ctx = this.ctx()

    if (!goal) {
      this.lastOutcomeTitle = '【平淡】毕业'
      this.lastOutcomeNarrative = '你走完了三年。'
      this.state.narrative = this.lastOutcomeNarrative
      return
    }

    const progress = this.state.player.goalProgress[goal.id] ?? 0
    const ratio = Math.min(1, progress / goal.target)

    for (const o of this.script.outcomes) {
      const condOk = evalCondition(o.require, ctx)
      const ratioOk = o.minGoalRatio === undefined || ratio >= o.minGoalRatio
      if (condOk && ratioOk) {
        this.lastOutcomeTitle = o.title
        this.lastOutcomeNarrative = o.narrative
        this.state.narrative = o.narrative
        return
      }
    }

    this.lastOutcomeTitle = '【平淡】毕业'
    this.lastOutcomeNarrative = '你走完了三年。'
    this.state.narrative = this.lastOutcomeNarrative
  }

  subscribe(listener: (s: Snapshot) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }
  private emit(s: Snapshot) {
    this.listeners.forEach((fn) => fn(s))
  }
}