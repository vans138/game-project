// 局内引擎 v4.3：种子 RNG / 因子演化（含终结覆盖）/ 上学月投影线索 / 假期调查线索。
// 关键点：
//   - 终结覆盖表 terminateOverride 由 setTerminate effect 改写
//   - 上学月每月进入自动尝试投影一条线索
//   - 假期月额外给"调查线索"入口（不消耗 stepCount 的步，直接改线索深度）
//   - Snapshot 暴露线索面板数据

import type { Script, Role, EventDef, MonthDef, Clue } from '../script/types'
import { evalCondition, applyEffects, type EvalContext } from './evaluator'
import { createRng, type Rng } from './rng'
import { evolveFactors, type TerminateOverride } from './factorEvolve'
import { pickProjection, investigateOnce, type ClueRuntime } from './clueTracker'

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
  usedEventIds: Set<string>
}

interface RunState {
  monthIndex: number
  year: number
  month: number
  player: PlayerRuntime
  activeFactors: Set<string>
  terminateOverride: TerminateOverride
  cluesPool: Record<string, ClueRuntime>
  monthRuntime: MonthRuntime | null
  finished: boolean
  narrative: string
}

export interface ClueView {
  clueId: string
  text: string
  conflictTitle: string
  remaining: number
  totalDepth: number
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
  clues: ClueView[]
}

export const ADVANCE = '__advance__'
export const INVESTIGATE_PREFIX = 'investigate:'

function hashSeed(s: string): number {
  let h = 2166136261 >>> 0
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0 }
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
  private clueById: Map<string, Clue>

  constructor(script: Script, role: Role, seed?: number) {
    this.script = script
    this.rng = createRng(seed ?? hashSeed(role.id + ':' + Date.now()))
    this.clueById = new Map(script.clues.map((c) => [c.id, c]))

    const affinity: Record<string, number> = {}
    for (const npc of script.npcs) affinity[npc.id] = npc.affinityStart

    const openingEvolve = evolveFactors(script.factorGroups, new Set(), this.rng, { isOpening: true })

    this.state = {
      monthIndex: 1,
      year: script.timeline[0]?.year ?? 1,
      month: script.timeline[0]?.month ?? 9,
      finished: false,
      monthRuntime: null,
      narrative: '',
      activeFactors: openingEvolve.active,
      terminateOverride: {},
      cluesPool: {},
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

  private pickFromPool(md: MonthDef, exclude: Set<string>): string | undefined {
    const pool = md.randomPool ?? []
    const candidates: EventDef[] = []
    for (const id of pool) {
      if (exclude.has(id)) continue
      const ev = this.eventById(id)
      if (!ev) continue
      if (ev.season === 'both' || ev.season === md.type) candidates.push(ev)
    }
    if (candidates.length === 0) return undefined
    const idx = this.rng.weightedIndex(candidates.map((c) => c.weight ?? 1))
    return idx >= 0 ? candidates[idx].id : undefined
  }

  private tryProjectClue() {
    const md = this.monthDef()
    if (!md || md.type !== 'school') return
    const used = new Set(Object.keys(this.state.cluesPool))
    const pick = pickProjection(this.script.clues, this.state.activeFactors, used)
    if (!pick) return
    this.state.cluesPool[pick.id] = {
      clueId: pick.id,
      projectedMonth: md.index,
      remaining: pick.depth,
      investigatedSteps: 0,
    }
  }

  private enterMonth(monthIndex: number, skipEvolve = false) {
    const md = this.script.timeline.find((m) => m.index === monthIndex)
    if (!md) { this.finish(); return }

    this.state.monthIndex = monthIndex
    this.state.year = md.year
    this.state.month = md.month
    this.state.monthRuntime = { currentEventId: '', usedSteps: 0, usedEventIds: new Set() }

    if (!skipEvolve) {
      const evo = evolveFactors(this.script.factorGroups, this.state.activeFactors, this.rng, {
        terminateOverride: this.state.terminateOverride,
      })
      this.state.activeFactors = evo.active
    }

    this.tryProjectClue()
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

    const clueItems = this.clueViews()
    if (clueItems.length) {
      head.push(`〔线索〕`)
      for (const c of clueItems.slice(0, 3)) {
        head.push(`· ${c.text}（深度 ${c.remaining}/${c.totalDepth}）`)
      }
    }

    let narrative = head.join('\n') + '\n\n'
    let choices: { id: string; text: string }[] = []

    if (ev) {
      narrative += `【${ev.title}】\n${ev.narrative}`
      const ctxCopy = this.ctx()
      choices = ev.choices
        .filter((c) => evalCondition(c.require, ctxCopy))
        .map((c) => ({ id: c.id, text: c.text }))
    } else {
      narrative += '这个月的余下时间平静地过去了。'
      choices = [{ id: ADVANCE, text: '（继续）' }]
    }

    // 假期：附上"调查线索"入口
    if (md.type === 'holiday') {
      const open = clueItems.filter((c) => c.remaining > 0)
      for (const c of open.slice(0, 2)) {
        choices.push({ id: `${INVESTIGATE_PREFIX}${c.clueId}`, text: `【调查】${c.text}` })
      }
    }

    this.state.narrative = narrative
    this.choicesCache = choices
  }

  private clueViews(): ClueView[] {
    return Object.values(this.state.cluesPool).map((rt) => {
      const clue = this.clueById.get(rt.clueId)!
      const conflict = this.script.conflicts.find((cf) => cf.id === clue.conflictId)
      return {
        clueId: rt.clueId,
        text: clue.text,
        conflictTitle: conflict?.title ?? '',
        remaining: rt.remaining,
        totalDepth: clue.depth,
      }
    })
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
    const clues = this.clueViews()

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
        clues,
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
      clues,
    }
  }

  choose(choiceId: string): Snapshot {
    if (this.state.finished) return this.snapshot()

    // 调查线索：不消耗 stepCount，直接推进线索深度，并保留在当前月
    if (choiceId.startsWith(INVESTIGATE_PREFIX)) {
      const clueId = choiceId.slice(INVESTIGATE_PREFIX.length)
      const rt = this.state.cluesPool[clueId]
      if (rt) {
        const done = investigateOnce(rt)
        const clue = this.clueById.get(clueId)
        let logLine = `【调查】${clue?.text ?? ''}\n`
        if (done) {
          logLine += '→ 你看清了这条线索指向的真相。'
          // 读清线索也给一点目标进度（真相关）
          this.state.player.goalProgress['g_truth'] =
            (this.state.player.goalProgress['g_truth'] ?? 0) + 1
        } else {
          logLine += `→ 还差 ${rt.remaining} 步清晰。`
        }
        this.state.narrative = logLine + '\n\n' + this.state.narrative
        // 重新渲染当前步以刷新线索文案
        this.renderCurrentStep()
        const s = this.snapshot()
        this.emit(s)
        return s
      }
      return this.snapshot()
    }

    const rt = this.state.monthRuntime
    const ev = this.eventById(rt?.currentEventId)

    if (!ev) {
      this.consumeStep([])
      const s = this.snapshot()
      this.emit(s)
      return s
    }

    const choice = ev.choices.find((c) => c.id === choiceId)
    if (!choice) return this.snapshot()

    // 处理 setTerminate（需在 applyEffects 之前拦截，因为不是 EvalContext 里的字段）
    const logs: string[] = []
    for (const ef of choice.effects) {
      if (ef.type === 'setTerminate') {
        this.state.terminateOverride[ef.groupId] = ef.value
      }
    }

    const ctx = this.ctx()
    // applyEffects 会忽略 setTerminate（default 分支），这里只处理其余 effect
    logs.push(...applyEffects(choice.effects, ctx))
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
        this.choicesCache = nextEv.choices
          .filter((c) => evalCondition(c.require, ctxCopy))
          .map((c) => ({ id: c.id, text: c.text }))
        this.state.narrative = logLine + `【${nextEv.title}】\n${nextEv.narrative}`
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
    let pos = 0
    for (const k of Object.keys(aff)) pos += Math.max(0, aff[k])
    if (pos <= cap) return
    const ratio = cap / pos
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