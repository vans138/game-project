// 局内引擎 v5：8 阶段月流程 + 身份因子 + 关系简化 + 随机互动机会池。
//
// 月流程 8 阶段（详见 docs/month_flow.md）：
//   ① 导入 → ② 主选项 → ③ 反馈 → ④ 小事件 → ⑤ 固定事件（仅事件月）
//   → ⑥ 随机互动① → ⑦ 随机互动②（条件性）→ ⑧ 本月反馈 → 下月
//
// 假期月（type='holiday'）本批走简化流程：只有"跳过"。
//
// 注意：本批 interactEvents 为空池，引擎能跑通但抽不到东西。
//       这是骨架阶段，内容下一批填。

import type {
  Script,
  EventDef,
  MonthDef,
  InteractEvent,
  InteractNode,
  IdentityFactorId,
} from '../script/types'
import { evalCondition, applyEffects, type EvalContext } from './evaluator'
import type { Rng } from './rng'
import { createRng } from './rng'

// ---------- 玩家运行时 ----------
interface PlayerRuntime {
  identityId: string
  identityFactor: IdentityFactorId
  affinity: Record<string, number>
  flags: Set<string>
  goalProgress: Record<string, number>
  crushId?: string
}

// ---------- 月阶段 ----------
export type MonthPhase =
  | 'intro'
  | 'mainChoice'
  | 'feedback'
  | 'smallEvent'
  | 'fixedEvent'
  | 'interact1'
  | 'interact2'
  | 'summary'
  | 'holidaySkip'
  | 'done'

interface MonthRuntime {
  index: number
  phase: MonthPhase
  isEventMonth: boolean
  fixedEventId?: string
  opportunityUsed: 0 | 1 | 2
}

interface InteractRuntime {
  eventId: string
  node: InteractNode
  becameLong: boolean
}

interface RunState {
  monthIndex: number
  year: number
  month: number
  finished: boolean
  player: PlayerRuntime
  monthRuntime: MonthRuntime
  interact: InteractRuntime | null
  mainChoice?: 'study' | 'bond' | 'rest'
  bondTargetId?: string
  feedback?: { self: string; peers: string; special?: string }
  flashNarrative?: string
  phaseHint: string
}

// ---------- 对外快照 ----------
export interface Snapshot {
  monthIndex: number
  year: number
  month: number
  monthType: 'school' | 'holiday'
  phase: MonthPhase
  phaseHint: string
  narrative: string
  choices: { id: string; text: string }[]
  finished: boolean
  outcomeTitle?: string
  outcomeNarrative?: string
  affinityPanel: { id: string; value: number }[]
  affinityTotal: number
  affinityCap: number
  identityName: string
  isEventMonth: boolean
}

export const CHOICE_SKIP = '__skip__'

function hashSeed(s: string): number {
  let h = 2166136261 >>> 0
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0 }
  return h >>> 0
}

export class RunEngine {
  private state: RunState
  private script: Script
  private listeners = new Set<(s: Snapshot) => void>()
  private rng: Rng
  private lastOutcomeTitle?: string
  private lastOutcomeNarrative?: string

  constructor(script: Script, identityId: string, seed?: number) {
    this.script = script
    const identity = script.identities.find((i) => i.id === identityId) ?? script.identities[0]
    this.rng = createRng(seed ?? hashSeed(identity.id + ':' + Date.now()))

    // 身份因子：从 identityFactorPool 随机抽一个（本批必是两项之一），玩家不可见
    const pool = identity.identityFactorPool
    const idx = this.rng.weightedIndex(pool.map(() => 1))
    const picked: IdentityFactorId = pool[idx >= 0 ? idx : 0] ?? 'seal'

    const affinity: Record<string, number> = {}
    for (const npc of script.npcs) affinity[npc.id] = npc.affinityStart

    const firstMonth = script.timeline[0]

    this.state = {
      monthIndex: firstMonth?.index ?? 1,
      year: firstMonth?.year ?? 1,
      month: firstMonth?.month ?? 9,
      finished: false,
      player: {
        identityId: identity.id,
        identityFactor: picked,
        affinity,
        flags: new Set(),
        goalProgress: {},
      },
      monthRuntime: {
        index: firstMonth?.index ?? 1,
        phase: 'intro',
        isEventMonth: !!firstMonth?.fixedEvent,
        fixedEventId: firstMonth?.fixedEvent,
        opportunityUsed: 0,
      },
      interact: null,
      phaseHint: '',
    }

    this.enterMonth(this.state.monthIndex)
  }

  // ---------- 上下文 ----------
  private ctx(): EvalContext {
    return {
      identityTags: new Set(),
      identityFactor: this.state.player.identityFactor,
      affinity: this.state.player.affinity,
      flags: this.state.player.flags,
      goalProgress: this.state.player.goalProgress,
      month: this.state.monthIndex,
      activeFactors: new Set(),
    }
  }

  private monthDef(): MonthDef | undefined {
    return this.script.timeline.find((m) => m.index === this.state.monthIndex)
  }
  private eventById(id?: string): EventDef | undefined {
    if (!id) return undefined
    return this.script.events.find((e) => e.id === id)
  }

  // ---------- 进入新月 ----------
  private enterMonth(monthIndex: number) {
    const md = this.script.timeline.find((m) => m.index === monthIndex)
    if (!md) { this.finish(); return }

    this.state.monthIndex = md.index
    this.state.year = md.year
    this.state.month = md.month
    this.state.interact = null
    this.state.mainChoice = undefined
    this.state.bondTargetId = undefined
    this.state.feedback = undefined
    this.state.flashNarrative = undefined

    this.state.monthRuntime = {
      index: md.index,
      phase: 'intro',
      isEventMonth: !!md.fixedEvent,
      fixedEventId: md.fixedEvent,
      opportunityUsed: 0,
    }

    if (md.type === 'holiday') {
      this.state.monthRuntime.phase = 'holidaySkip'
      this.state.phaseHint = '假期'
    } else {
      this.state.monthRuntime.phase = 'intro'
      this.state.phaseHint = '本月开始'
    }
  }

  // ---------- 阶段推进 ----------
  private handleMainChoice(choiceId: string) {
    if (choiceId.startsWith('bond:')) {
      this.state.mainChoice = 'bond'
      this.state.bondTargetId = choiceId.slice('bond:'.length)
    } else if (choiceId === 'study') {
      this.state.mainChoice = 'study'
    } else if (choiceId === 'rest') {
      this.state.mainChoice = 'rest'
    } else {
      return
    }
    this.state.feedback = this.buildFeedback()
    this.state.monthRuntime.phase = 'feedback'
    this.state.phaseHint = '反馈'
  }

  private buildFeedback(): { self: string; peers: string; special?: string } {
    if (this.state.mainChoice === 'study') {
      return { self: '你把这个月大部分精力放在了书本上。', peers: '班里没什么大事。' }
    }
    if (this.state.mainChoice === 'bond') {
      const npc = this.script.npcs.find((n) => n.id === this.state.bondTargetId)
      return {
        self: `你试着和${npc?.name ?? '某人'}多待了一会儿。`,
        peers: '班里同学对此有点好奇。',
      }
    }
    return { self: '这个月你没有刻意做什么。', peers: '时间静静过去。' }
  }

  private toSmallEvent() {
    this.state.flashNarrative = undefined
    this.state.monthRuntime.phase = 'smallEvent'
    this.state.phaseHint = '小事件'
  }

  private toFixedOrInteract1() {
    if (this.state.monthRuntime.isEventMonth && this.state.monthRuntime.fixedEventId) {
      this.state.monthRuntime.phase = 'fixedEvent'
      this.state.phaseHint = '固定事件'
      return
    }
    this.toInteract1()
  }

  private toInteract1() {
    this.state.monthRuntime.phase = 'interact1'
    this.state.phaseHint = '随机互动①'
    const picked = this.pickInteract('all')
    if (!picked) { this.toInteract2(); return }
    this.startInteract(picked, /* isFirst */ true)
  }

  private toInteract2() {
    this.state.monthRuntime.opportunityUsed = 1
    this.state.monthRuntime.phase = 'interact2'
    this.state.phaseHint = '随机互动②'
    const picked = this.pickInteract('shortOnly')
    if (!picked) { this.toSummary(); return }
    this.startInteract(picked, /* isFirst */ false)
  }

  /** 池子为空 → 返回 null（骨架阶段恒为 null） */
  private pickInteract(mode: 'all' | 'shortOnly'): InteractEvent | null {
    const pool = this.script.interactEvents
    if (!pool.length) return null
    const filtered = pool.filter((e) => {
      if (mode === 'shortOnly' && e.kind !== 'short') return false
      if (e.requires?.hasCrush && !this.state.player.crushId) return false
      if (e.requires?.identityFactor && e.requires.identityFactor !== this.state.player.identityFactor) return false
      return true
    })
    if (!filtered.length) return null
    const idx = this.rng.weightedIndex(filtered.map((e) => e.weight))
    return idx >= 0 ? filtered[idx] : null
  }

  private startInteract(event: InteractEvent, isFirst: boolean) {
    this.state.interact = { eventId: event.id, node: event.root, becameLong: false }
    if (event.kind === 'long') {
      this.state.monthRuntime.opportunityUsed = 2
    } else {
      this.state.monthRuntime.opportunityUsed = isFirst ? 1 : 2
    }
    this.state.flashNarrative = event.root.text
    this.state.phaseHint = isFirst ? '随机互动①' : '随机互动②'
  }

  private afterInteract() {
    if (this.state.monthRuntime.opportunityUsed >= 2) {
      this.toSummary()
    } else {
      this.toInteract2()
    }
  }

  private toSummary() {
    this.state.monthRuntime.phase = 'summary'
    this.state.phaseHint = '本月反馈'
  }

  // ---------- 推进到下一月 ----------
  private advanceMonth() {
    const currentMd = this.monthDef()
    if (!currentMd) { this.finish(); return }
    const next = this.script.timeline.find((m) => m.index === currentMd.index + 1)
    if (!next) { this.finish(); return }
    this.enterMonth(next.index)
  }

  // ---------- 结局 ----------
  private finish() {
    this.state.finished = true
    this.state.monthRuntime.phase = 'done'
    this.state.phaseHint = '结束'
    const o = this.script.outcomes[0]
    this.lastOutcomeTitle = o?.title
    this.lastOutcomeNarrative = o?.narrative
  }

  // ---------- 快照 ----------
  snapshot(): Snapshot {
    const md = this.monthDef()
    const panel = Object.entries(this.state.player.affinity)
      .map(([id, value]) => ({ id, value }))
      .sort((a, b) => b.value - a.value)
    const total = panel.reduce((s, p) => s + Math.max(0, p.value), 0)
    const identity = this.script.identities.find((i) => i.id === this.state.player.identityId)

    if (!md || this.state.finished) {
      return {
        monthIndex: this.state.monthIndex,
        year: this.state.year,
        month: this.state.month,
        monthType: md?.type ?? 'school',
        phase: 'done',
        phaseHint: '结束',
        narrative: this.lastOutcomeNarrative ?? '这一段结束了。',
        choices: [],
        finished: true,
        outcomeTitle: this.lastOutcomeTitle,
        outcomeNarrative: this.lastOutcomeNarrative,
        affinityPanel: panel,
        affinityTotal: total,
        affinityCap: this.script.affinityCap,
        identityName: identity?.name ?? '',
        isEventMonth: this.state.monthRuntime.isEventMonth,
      }
    }

    const { narrative, choices } = this.buildPhaseView(md)
    return {
      monthIndex: this.state.monthIndex,
      year: md.year,
      month: md.month,
      monthType: md.type,
      phase: this.state.monthRuntime.phase,
      phaseHint: this.state.phaseHint,
      narrative,
      choices,
      finished: false,
      affinityPanel: panel,
      affinityTotal: total,
      affinityCap: this.script.affinityCap,
      identityName: identity?.name ?? '',
      isEventMonth: this.state.monthRuntime.isEventMonth,
    }
  }

  /** 按当前阶段生成叙述与选项 */
  private buildPhaseView(md: MonthDef): { narrative: string; choices: { id: string; text: string }[] } {
    const ph = this.state.monthRuntime.phase
    const lines: string[] = []
    lines.push(`第 ${md.year} 学年 · ${md.month} 月 · ${md.type === 'holiday' ? '假期' : '上学'}`)
    lines.push(this.identityHint())
    lines.push('')

    if (ph === 'holidaySkip') {
      lines.push('（假期）这个月不上学。')
      return { narrative: lines.join('\n'), choices: [{ id: CHOICE_SKIP, text: '（假期）跳过' }] }
    }

    if (ph === 'intro') {
      lines.push('【导入】')
      lines.push(md.fixedEvent ? '这个月有一件你早就知道的大事。' : '这个月和往常一样。')
      const ev = this.eventById(md.fixedEvent)
      if (ev) lines.push(`${ev.title}：${ev.narrative}`)
      return { narrative: lines.join('\n'), choices: [{ id: 'intro_next', text: '继续' }] }
    }

    if (ph === 'mainChoice') {
      lines.push('【主选项】你把这个月花在哪里？')
      const choices: { id: string; text: string }[] = [{ id: 'study', text: '学习' }]
      for (const npc of this.script.npcs) {
        choices.push({ id: `bond:${npc.id}`, text: `拉近关系 · ${npc.name}` })
      }
      return { narrative: lines.join('\n'), choices }
    }

    if (ph === 'feedback') {
      lines.push('【反馈】')
      if (this.state.feedback) {
        lines.push('自己：' + this.state.feedback.self)
        lines.push('身边：' + this.state.feedback.peers)
        if (this.state.feedback.special) lines.push('特殊：' + this.state.feedback.special)
      }
      return { narrative: lines.join('\n'), choices: [{ id: 'feedback_next', text: '继续' }] }
    }

    if (ph === 'smallEvent') {
      lines.push('【小事件】')
      lines.push(this.state.flashNarrative ?? '这个月没有特别的意外。')
      return { narrative: lines.join('\n'), choices: [{ id: 'small_next', text: '继续' }] }
    }

    if (ph === 'fixedEvent') {
      const ev = this.eventById(this.state.monthRuntime.fixedEventId)
      lines.push(`【固定事件】${ev?.title ?? ''}`)
      if (ev) lines.push(ev.narrative)
      const ctx = this.ctx()
      const choices = (ev?.choices ?? [])
        .filter((c) => evalCondition(c.require, ctx))
        .map((c) => ({ id: c.id, text: c.text }))
      return { narrative: lines.join('\n'), choices }
    }

    if (ph === 'interact1' || ph === 'interact2') {
      lines.push(`【${ph === 'interact1' ? '随机互动①' : '随机互动②'}】`)
      lines.push(this.state.flashNarrative ?? '（本月没有发生随机互动。）')
      if (this.state.interact?.node.choices) {
        const choices = this.state.interact.node.choices.map((c, i) => ({ id: `ic:${i}`, text: c.text }))
        return { narrative: lines.join('\n'), choices }
      }
      return { narrative: lines.join('\n'), choices: [{ id: 'interact_next', text: '继续' }] }
    }

    if (ph === 'summary') {
      lines.push('【本月反馈】')
      lines.push('这个月结束了。')
      return { narrative: lines.join('\n'), choices: [{ id: 'summary_next', text: '进入下个月' }] }
    }

    return { narrative: lines.join('\n'), choices: [] }
  }

  /** 身份因子暗示：玩家可见的"模糊"叙述（不暴露 seal/ancient） */
  private identityHint(): string {
    if (this.state.player.identityFactor === 'seal') {
      return '（你偶尔能听见自己体内，还有另一个心跳。）'
    }
    return '（你偶尔能感觉到，有什么东西在躲着你。）'
  }

  // ---------- 玩家选择入口 ----------
  choose(choiceId: string): Snapshot {
    if (this.state.finished) return this.snapshot()
    const ph = this.state.monthRuntime.phase

    if (ph === 'holidaySkip') {
      if (choiceId === CHOICE_SKIP) this.advanceMonth()
      return this.emitAndSnap()
    }

    if (ph === 'intro') {
      if (choiceId === 'intro_next') {
        this.state.monthRuntime.phase = 'mainChoice'
        this.state.phaseHint = '主选项'
      }
      return this.emitAndSnap()
    }

    if (ph === 'mainChoice') {
      this.handleMainChoice(choiceId)
      return this.emitAndSnap()
    }

    if (ph === 'feedback') {
      if (choiceId === 'feedback_next') this.toSmallEvent()
      return this.emitAndSnap()
    }

    if (ph === 'smallEvent') {
      if (choiceId === 'small_next') this.toFixedOrInteract1()
      return this.emitAndSnap()
    }

    if (ph === 'fixedEvent') {
      const ev = this.eventById(this.state.monthRuntime.fixedEventId)
      const choice = ev?.choices.find((c) => c.id === choiceId)
      if (choice) {
        const ctx = this.ctx()
        const logs = applyEffects(choice.effects, ctx)
        this.state.player.affinity = ctx.affinity
        this.state.player.flags = ctx.flags
        this.state.player.goalProgress = ctx.goalProgress
        if (logs.length) this.state.flashNarrative = logs.join('\n')
      }
      this.toInteract1()
      return this.emitAndSnap()
    }

    if (ph === 'interact1' || ph === 'interact2') {
      // 骨架阶段：交互树尚未展开，直接视为「结束此交互」推进
      this.afterInteract()
      return this.emitAndSnap()
    }

    if (ph === 'summary') {
      if (choiceId === 'summary_next') this.advanceMonth()
      return this.emitAndSnap()
    }

    return this.emitAndSnap()
  }

  private emitAndSnap(): Snapshot {
    const s = this.snapshot()
    this.listeners.forEach((fn) => fn(s))
    return s
  }

  subscribe(listener: (s: Snapshot) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }
}