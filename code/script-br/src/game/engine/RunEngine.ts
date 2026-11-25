// 局内引擎：月推进、月内多步、事件加权抽取、因子演化、结局判定。
// v4：种子 RNG 驱动；开局抽因子；按月 stepCount 多步；season 过滤池；
//     事件按 weight 加权抽；好感总封顶；未来组触发后 owner off。
//
// 月内多步模型（统一规则）：
//   - 有 fixedEvent 的月份：第 1 步是 fixedEvent，余下 stepCount-1 步从池中加权抽。
//   - 无 fixedEvent 的月份：逐步从池中加权抽。
//   - 每一步都渲染一个"当前事件"，玩家选择后消耗该步。
//   - 当本月步数用完，进入下月；若当前是结尾月（录取月），结算结局。

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

/** 简单字符串哈希，作为默认种子 */
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

    // 开局抽因子（isOpening=true）
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

  // ---------- 上下文 ----------

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

  // ---------- 抽取 ----------

  private pickFromPool(md: MonthDef): string | undefined {
    const pool = md.randomPool ?? []
    const type = md.type
    const candidates: EventDef[] = []
    for (const id of pool) {
      const ev = this.eventById(id)
      if (!ev) continue
      if (ev.season === 'both' || ev.season === type) candidates.push(ev)
    }
    if (candidates.length === 0) return undefined
    const weights = candidates.map((c) => c.weight ?? 1)
    const idx = this.rng.weightedIndex(weights)
    return idx >= 0 ? candidates[idx].id : undefined
  }

  // ---------- 月份推进 ----------

  private enterMonth(monthIndex: number, skipEvolve = false) {
    const md = this.script.timeline.find((m) => m.index === monthIndex)
    if (!md) {
      this.finish()
      return
    }
    this.state.monthIndex = monthIndex
    this.state.year = md.year
    this.state.month = md.month
    this.state.monthRuntime = { currentEventId: '', usedSteps: 0 }

    // 除开局外，进入新月份时做一次因子演化
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
    if (rt.usedSteps === 0 && md.fixedEvent) {
      evId = md.fixedEvent
    } else {
      evId = this.pickFromPool(md)
    }
    rt.currentEventId = evId ?? ''

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
      narrative += '这个月平静地过去了，教室里只有粉笔的声音。'
    }
    this.state.narrative = narrative
    this.choicesCache = choices
  }

  // ---------- 快照 ----------

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

  // ---------- 选择 ----------

  choose(choiceId: string): Snapshot {
    if (this.state.finished) return this.snapshot()
    const rt = this.state.monthRuntime
    const ev = this.eventById(rt?.currentEventId)

    if (!ev) {
      // 平静月：随便点一下就占一步
      this.consumeStep(false)
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

    // 如果选项带了 next，按强制转移处理（下一步直接进入该事件）
    this.consumeStep(true, logs, choice.next ?? undefined)

    const s = this.snapshot()
    this.emit(s)
    return s
  }

  /**
   * 消耗一步。usedSteps++；若本月步数用完则推入下月；
   * 若 nextEventId 提供，且本月未结束，则当前事件替换为 nextEventId 继续本步。
   */
  private consumeStep(withChoice: boolean, logs: string[] = [], nextEventId?: string) {
    const md = this.monthDef()
    const rt = this.state.monthRuntime
    if (!md || !rt) return

    // 先结算日志到叙述头部，保证玩家能看到反馈
    const logLine = logs.length ? logs.join('\n') + '\n\n' : ''
    if (logLine) this.state.narrative = logLine + this.state.narrative

    if (nextEventId) {
      // 强制转移到指定事件：仍在本月内，不增加 usedSteps
      const nextEv = this.eventById(nextEventId)
      if (nextEv) {
        rt.currentEventId = nextEv.id
        const ctxCopy = this.ctx()
        const choices = nextEv.choices
          .filter((c) => evalCondition(c.require, ctxCopy))
          .map((c) => ({ id: c.id, text: c.text }))
        this.state.narrative = `【${nextEv.title}】\n${nextEv.narrative}`
        this.choicesCache = choices
        return
      }
    }

    rt.usedSteps += 1

    if (rt.usedSteps >= md.stepCount) {
      // 本月结束 → 下月
      this.enterMonth(md.index + 1)
      return
    }

    // 本月继续渲染下一步
    this.renderCurrentStep()
  }

  // ---------- 好感封顶 ----------

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

  // ---------- 结局 ----------

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

  // ---------- 订阅 ----------

  subscribe(listener: (s: Snapshot) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }
  private emit(s: Snapshot) {
    this.listeners.forEach((fn) => fn(s))
  }
}