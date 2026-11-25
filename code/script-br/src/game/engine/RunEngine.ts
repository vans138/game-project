// 局内引擎 v6：8 阶段月流程 + 身份因子 + 关系 + 随机互动树（完整）

import type {
  Script,
  EventDef,
  MonthDef,
  InteractEvent,
  InteractNode,
  InteractChoice,
  IdentityFactorId,
} from '../script/types'
import { evalCondition, applyEffects, type EvalContext } from './evaluator'
import type { Rng } from './rng'
import { createRng } from './rng'

interface PlayerRuntime {
  identityId: string
  identityFactor: IdentityFactorId
  affinity: Record<string, number>
  flags: Set<string>
  goalProgress: Record<string, number>
  crushId?: string
}

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
  kind: 'short' | 'maybeLong' | 'long'
  node: InteractNode
  becameLong: boolean
  pendingChoices: { id: string; text: string; src: InteractChoice }[]
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
  monthLog: string[]
}

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
      monthLog: [],
    }

    this.enterMonth(this.state.monthIndex)
  }

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
    this.state.monthLog = []

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

  // ---------- 主选项 ----------
  private handleMainChoice(choiceId: string) {
    if (choiceId.startsWith('bond:')) {
      this.state.mainChoice = 'bond'
      const targetId = choiceId.slice('bond:'.length)
      this.state.bondTargetId = targetId
      const npc = this.script.npcs.find((n) => n.id === targetId)
      const bump = npc?.relation === '友' ? 8 : npc?.relation === '尊' ? 5 : 4
      this.state.player.affinity[targetId] =
        (this.state.player.affinity[targetId] ?? 0) + bump
      this.enforceAffinityCap()
      this.state.feedback = {
        self:
          `你试着和${npc?.name ?? '某人'}多待了一会儿。` +
          (npc?.relation === '友' ? '你们聊得比想象中轻松。' : ''),
        peers: '班里同学对此有点好奇。',
        special: npc?.relation === '谜' ? 'TA 看你的眼神，比往常多停留了一秒。' : undefined,
      }
    } else if (choiceId === 'study') {
      this.state.mainChoice = 'study'
      this.state.feedback = {
        self: '你把这个月大部分精力放在了书本上。',
        peers: '班里没什么大事。',
      }
    } else if (choiceId === 'rest') {
      this.state.mainChoice = 'rest'
      this.state.feedback = {
        self: '这个月你没有刻意做什么。',
        peers: '时间静静过去。',
      }
    } else {
      return
    }
    this.state.monthRuntime.phase = 'feedback'
    this.state.phaseHint = '反馈'
  }

  private enforceAffinityCap() {
    const cap = this.script.affinityCap
    const aff = this.state.player.affinity
    let positiveSum = 0
    for (const k of Object.keys(aff)) positiveSum += Math.max(0, aff[k])
    if (positiveSum <= cap) return
    const ratio = cap / positiveSum
    for (const k of Object.keys(aff)) {
      if (aff[k] > 0) aff[k] = Math.floor(aff[k] * ratio)
    }
  }

  // ---------- 小事件 ----------
  private rollSmallEvent(): boolean {
    const base = 0.4
    let mainBonus = 0
    if (this.state.mainChoice === 'study') mainBonus = 0.25
    else if (this.state.mainChoice === 'bond') mainBonus = 0.25

    let relationMod = 0
    if (this.state.mainChoice === 'study') {
      const tid = this.state.bondTargetId
      const v = tid ? (this.state.player.affinity[tid] ?? 0) : 0
      if (tid && v < 10) relationMod = -0.4
      else relationMod = 0.01
    } else if (this.state.mainChoice === 'bond') {
      relationMod = 0.15
    }

    const p = Math.max(0, Math.min(1, base + mainBonus + relationMod))
    return this.rng.chance(p)
  }

  private runSmallEvent() {
    const happened = this.rollSmallEvent()
    if (!happened) {
      this.state.flashNarrative = '这个月没有发生什么特别的意外。'
    } else {
      const variants = [
        '课间，走廊尽头的窗子外面，有一只黑鸟一直盯着你看。',
        '放学时你在储物柜里发现一张没有落款的纸条，只写了两个字：“小心。”',
        '某个午后你忽然头晕，眼前的课本一页页翻过去，像在快进。',
      ]
      const idx = this.rng.weightedIndex(variants.map(() => 1))
      this.state.flashNarrative = variants[idx >= 0 ? idx : 0]
    }
    this.state.monthRuntime.phase = 'smallEvent'
    this.state.phaseHint = '小事件'
  }

  // ---------- 固定事件 / 随机互动推进 ----------
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
    this.startInteract(picked, true)
  }

  private toInteract2() {
    this.state.monthRuntime.opportunityUsed = 1
    this.state.monthRuntime.phase = 'interact2'
    this.state.phaseHint = '随机互动②'
    const picked = this.pickInteract('shortOnly')
    if (!picked) { this.toSummary(); return }
    this.startInteract(picked, false)
  }

  // 抽取随机互动事件：mode='shortOnly' 时只留 kind==='short'
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

  // 开始一次交互：把当前 node 里的选项过滤后缓存到 pendingChoices
  private startInteract(event: InteractEvent, isFirst: boolean) {
    const rt: InteractRuntime = {
      eventId: event.id,
      kind: event.kind,
      node: event.root,
      becameLong: false,
      pendingChoices: [],
    }
    this.state.interact = rt
    if (event.kind === 'long') {
      this.state.monthRuntime.opportunityUsed = 2
    } else {
      this.state.monthRuntime.opportunityUsed = isFirst ? 1 : 2
    }
    this.state.flashNarrative = event.root.text
    this.state.phaseHint = isFirst ? '随机互动①' : '随机互动②'
    this.refreshInteractChoices()
    // 若进入时就是叶节点（无选项），直接视为结束
    if (rt.pendingChoices.length === 0) {
      this.finishInteract()
    }
  }

  // 过滤当前 node 的选项（按 requires）
  private refreshInteractChoices() {
    const rt = this.state.interact
    if (!rt) return
    const choices = rt.node.choices ?? []
    rt.pendingChoices = choices
      .map((c, i) => ({ id: `ic:${i}`, text: c.text, src: c }))
      .filter(({ src }) => {
        const r = src.requires
        if (!r) return true
        if (r.identityFactor && r.identityFactor !== this.state.player.identityFactor) return false
        return true
      })
  }

  // 处理一次交互选择
  private handleInteractChoice(choiceId: string) {
    const rt = this.state.interact
    if (!rt) { this.finishInteract(); return }
    const picked = rt.pendingChoices.find((c) => c.id === choiceId)
    if (!picked) return

    const nextRaw = picked.src.next
    if (!nextRaw) {
      // 无后续：视为结束
      this.finishInteract()
      return
    }

    // 判断是否为 {byMutual, byOneSide} 分叉
    if (typeof (nextRaw as { byMutual?: unknown }).byMutual === 'object' &&
        typeof (nextRaw as { byOneSide?: unknown }).byOneSide === 'object') {
      const branches = nextRaw as { byMutual: InteractNode; byOneSide: InteractNode }
      // "对方是否也主动"的判定：单机 MVP 用「交互事件的相关 NPC 好感」近似
      // 简化策略：本批先随机判定（后续接 crush / 好感阈值）
      const mutual = this.rng.chance(0.6)
      const chosen = mutual ? branches.byMutual : branches.byOneSide
      rt.node = chosen
      this.state.flashNarrative = chosen.text
      // 若进入 byMutual 且事件是 maybeLong → 触发变长
      if (mutual && rt.kind === 'maybeLong' && !rt.becameLong) {
        rt.becameLong = true
        this.state.monthRuntime.opportunityUsed = 2
      }
      this.refreshInteractChoices()
      if (rt.pendingChoices.length === 0) this.finishInteract()
      return
    }

    // 普通节点跳转
    const nextNode = nextRaw as InteractNode
    rt.node = nextNode
    this.state.flashNarrative = nextNode.text
    this.refreshInteractChoices()
    if (rt.pendingChoices.length === 0) {
      this.finishInteract()
    }
  }

  // 交互收束：根据 opportunityUsed 决定进 ② 还是总结
  private finishInteract() {
    const used = this.state.monthRuntime.opportunityUsed
    if (used >= 2) {
      this.toSummary()
      return
    }
    this.toInteract2()
  }

  private toSummary() {
    this.state.monthRuntime.phase = 'summary'
    this.state.phaseHint = '本月反馈'
  }

  private advanceMonth() {
    const currentMd = this.monthDef()
    if (!currentMd) { this.finish(); return }
    const next = this.script.timeline.find((m) => m.index === currentMd.index + 1)
    if (!next) { this.finish(); return }
    this.enterMonth(next.index)
  }

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
      const ev = this.eventById(md.fixedEvent)
      if (ev) {
        lines.push(`${ev.title}：`)
        lines.push(ev.narrative)
      } else {
        lines.push('这个月和往常一样。')
      }
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
      lines.push(this.state.flashNarrative ?? '这个月没有特别的事。')
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
      const rt = this.state.interact
      if (!rt) {
        lines.push('（本月没有发生随机互动。）')
        return { narrative: lines.join('\n'), choices: [{ id: 'interact_next', text: '继续' }] }
      }
      lines.push(rt.node.text)
      const choices = rt.pendingChoices.map((c) => ({ id: c.id, text: c.text }))
      if (choices.length === 0) {
        return { narrative: lines.join('\n'), choices: [{ id: 'interact_next', text: '继续' }] }
      }
      return { narrative: lines.join('\n'), choices }
    }

    if (ph === 'summary') {
      lines.push('【本月反馈】')
      lines.push('这个月结束了。')
      return { narrative: lines.join('\n'), choices: [{ id: 'summary_next', text: '进入下个月' }] }
    }

    return { narrative: lines.join('\n'), choices: [] }
  }

  private identityHint(): string {
    if (this.state.player.identityFactor === 'seal') {
      return '（你偶尔能听见自己体内，还有另一个心跳。）'
    }
    return '（你偶尔能感觉到，有什么东西在躲着你。）'
  }

  // ---------- 选择入口 ----------
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
      if (choiceId === 'feedback_next') this.runSmallEvent()
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
        this.enforceAffinityCap()
      }
      this.toInteract1()
      return this.emitAndSnap()
    }

    if (ph === 'interact1' || ph === 'interact2') {
      if (choiceId === 'interact_next') {
        this.finishInteract()
      } else {
        this.handleInteractChoice(choiceId)
      }
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