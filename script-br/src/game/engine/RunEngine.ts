// 局内引擎 v7：接线索 + 古龙/封龙湖面事件 + 战力 + 失控分支
//
// 相对 v6.2 变更：
//   1) PlayerRuntime 增加 power、clueRuntime
//   2) 必遇一次性事件调度（onceGuaranteed / priority / firedOnceEvents）
//   3) 湖面事件按身份因子分叉（封龙有锁链 / 古龙无锁链），结束留线索
//   4) 失控分支：检测好感 ≤ -50 的对象，强制占用两次机会 → 走伤害计算
//   5) 线索调查入口：主选项里多一条「调查线索」
//   6) Snapshot 增加 clues / playerPower 字段

import type {
  Script,
  EventDef,
  MonthDef,
  InteractEvent,
  InteractNode,
  InteractChoice,
  IdentityFactorId,
  ClueDef,
} from '../script/types'
import { evalCondition, applyEffects, type EvalContext } from './evaluator'
import type { Rng } from './rng'
import { createRng } from './rng'
import { calcDamage, damageNarrative } from './damage'
import {
  acquireClue,
  investigateClue,
  listInvestigable,
  type ClueRuntime,
} from './clues'

interface PlayerRuntime {
  identityId: string
  identityFactor: IdentityFactorId
  affinity: Record<string, number>
  flags: Set<string>
  goalProgress: Record<string, number>
  crushId?: string
  power: number
  clueRuntime: ClueRuntime
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
  mainChoice?: 'study' | 'bond' | 'rest' | 'investigate'
  bondTargetId?: string
  feedback?: { self: string; peers: string; special?: string }
  phaseHint: string
  monthLog: string[]
  stageNarrative?: string
  firedOnceEvents: Set<string>
  investigatedThisMonth: string | null
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
  clues: { id: string; title: string; stage: number; total: number; done: boolean }[]
  playerPower: number
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
        power: identity.basePower,
        clueRuntime: {},
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
      stageNarrative: undefined,
      firedOnceEvents: new Set(),
      investigatedThisMonth: null,
    }

    this.enterMonth(this.state.monthIndex)
  }

  // ---------- 工具 ----------
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
  private clueDef(id: string): ClueDef | undefined {
    return this.script.clues.find((c) => c.id === id)
  }
  private npcName(id: string): string {
    return this.script.npcs.find((n) => n.id === id)?.name ?? id
  }

  private log(s: string) {
    if (s) this.state.monthLog.push(s)
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
    this.state.monthLog = []
    this.state.stageNarrative = undefined
    this.state.investigatedThisMonth = null

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
    if (choiceId === 'investigate') {
      this.state.mainChoice = 'investigate'
      this.state.monthRuntime.phase = 'mainChoice'
      this.state.phaseHint = '调查线索'
      return
    }

    if (choiceId.startsWith('bond:')) {
      this.state.mainChoice = 'bond'
      const targetId = choiceId.slice('bond:'.length)
      this.state.bondTargetId = targetId
      const npc = this.script.npcs.find((n) => n.id === targetId)
      const bump = npc?.relation === '友' ? 8 : npc?.relation === '尊' ? 5 : 4
      const before = this.state.player.affinity[targetId] ?? 0
      this.state.player.affinity[targetId] = before + bump
      this.enforceAffinityCap()
      const after = this.state.player.affinity[targetId] ?? 0
      this.state.feedback = {
        self:
          `你试着和${npc?.name ?? '某人'}多待了一会儿。` +
          (npc?.relation === '友' ? '你们聊得比想象中轻松。' : ''),
        peers: '班里同学对此有点好奇。',
        special: npc?.relation === '谜' ? 'TA 看你的眼神，比往常多停留了一秒。' : undefined,
      }
      this.log(`好感 · ${npc?.name ?? targetId} ${after - before >= 0 ? '+' : ''}${after - before}`)
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

  private handleInvestigate(choiceId: string) {
    if (!choiceId.startsWith('investigate:')) {
      this.state.mainChoice = undefined
      this.state.phaseHint = '主选项'
      return
    }
    const clueId = choiceId.slice('investigate:'.length)
    const def = this.clueDef(clueId)
    if (!def) {
      this.state.mainChoice = undefined
      this.state.phaseHint = '主选项'
      return
    }
    const r = investigateClue(def, this.state.player.clueRuntime)
    if (r) {
      this.state.investigatedThisMonth = clueId
      this.log(`调查线索「${def.title}」`)
      for (const line of r.text.split('\n')) this.log('  ' + line)
      if (r.done) this.log(`（线索「${def.title}」已彻底查清）`)
    }
    this.state.mainChoice = 'rest'
    this.state.feedback = {
      self: '你把这段时间用来翻看、回想那条线索。',
      peers: '没有人在意你在做什么。',
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
      this.state.stageNarrative = '这个月没有发生什么特别的意外。'
    } else {
      const variants = [
        '课间，走廊尽头的窗子外面，有一只黑鸟一直盯着你看。',
        '放学时你在储物柜里发现一张没有落款的纸条，只写了两个字：“小心。”',
        '某个午后你忽然头晕，眼前的课本一页页翻过去，像在快进。',
      ]
      const idx = this.rng.weightedIndex(variants.map(() => 1))
      this.state.stageNarrative = variants[idx >= 0 ? idx : 0]
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
    if (this.checkOutOfControl()) return
    this.toInteract1()
  }

  /** 检测好感 ≤ -50 的对象 → 触发失控，占两次机会 */
  private checkOutOfControl(): boolean {
    const threshold = -50
    const aff = this.state.player.affinity
    let worstId: string | null = null
    let worstValue = 0
    for (const id of Object.keys(aff)) {
      const v = aff[id]
      if (v <= threshold && v < worstValue) {
        worstValue = v
        worstId = id
      }
    }
    if (!worstId) return false

    this.state.monthRuntime.opportunityUsed = 2
    this.state.monthRuntime.phase = 'interact1'
    this.state.phaseHint = '失控'

    const targetNpc = this.script.npcs.find((n) => n.id === worstId)
    const targetName = targetNpc?.name ?? worstId
    const defenderPower = targetNpc?.power ?? 20

    const dmg = calcDamage(
      {
        attackerPower: this.state.player.power,
        defenderPower,
        defenderAffinityToAttacker: worstValue,
      },
      this.rng,
    )

    const event = this.script.interactEvents.find((e) => e.id === 'it_out_of_control')
    const rt: InteractRuntime = {
      eventId: 'it_out_of_control',
      kind: 'short',
      node: event?.root ?? { text: '……' },
      becameLong: false,
      pendingChoices: [],
    }
    this.state.interact = rt

    const dmgText = damageNarrative(dmg.tier, targetName)
    const powerNote = `（战力对比：你 ${this.state.player.power} / ${targetName} ${defenderPower}；` +
      `TA 对你的好感 ${worstValue}）`
    this.state.stageNarrative =
      '你体内有什么东西冲了出来，快得你自己都没反应过来。\n' +
      dmgText + '\n' + powerNote
    this.log(`【失控 · ${targetName}】`)
    this.log(dmgText)

    rt.pendingChoices = [{ id: 'oc_next', text: '……', src: { text: '……' } }]
    return true
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

  private pickInteract(mode: 'all' | 'shortOnly'): InteractEvent | null {
    const pool = this.script.interactEvents
    if (!pool.length) return null

    const filtered = pool.filter((e) => {
      if (mode === 'shortOnly' && e.kind !== 'short') return false
      if (e.requires?.hasCrush === true && !this.state.player.crushId) return false
      if (e.requires?.identityFactor && e.requires.identityFactor !== this.state.player.identityFactor) return false
      if (e.onceGuaranteed && this.state.firedOnceEvents.has(e.id)) return false
      if (e.weight <= 0) return false
      return true
    })
    if (!filtered.length) return null

    const guaranteed = filtered
      .filter((e) => e.onceGuaranteed)
      .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))
    if (guaranteed.length > 0) {
      return guaranteed[0]
    }

    const idx = this.rng.weightedIndex(filtered.map((e) => e.weight))
    return idx >= 0 ? filtered[idx] : null
  }

  private startInteract(event: InteractEvent, isFirst: boolean) {
    if (event.onceGuaranteed) this.state.firedOnceEvents.add(event.id)

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
    this.state.stageNarrative = event.root.text
    this.state.phaseHint = isFirst ? '随机互动①' : '随机互动②'
    this.refreshInteractChoices()
    if (rt.pendingChoices.length === 0) {
      this.finishInteract()
    }
  }

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
        if (r.hasCrush === true && !this.state.player.crushId) return false
        return true
      })
  }

  private handleInteractChoice(choiceId: string) {
    const rt = this.state.interact
    if (!rt) { this.finishInteract(); return }
    const picked = rt.pendingChoices.find((c) => c.id === choiceId)
    if (!picked) return

    if (rt.node.text) this.log(rt.node.text)

    const nextRaw = picked.src.next
    if (!nextRaw) {
      this.finishInteract()
      return
    }

    if (typeof (nextRaw as { byMutual?: unknown }).byMutual === 'object' &&
        typeof (nextRaw as { byOneSide?: unknown }).byOneSide === 'object') {
      const branches = nextRaw as { byMutual: InteractNode; byOneSide: InteractNode }
      // 湖面事件：byMutual/byOneSide 用作身份因子分叉（古龙 / 封龙）
      const isLakeDragon = rt.eventId === 'it_lake_dragon'
      const mutual = isLakeDragon
        ? this.state.player.identityFactor === 'ancient'
        : this.rng.chance(0.6)
      const chosen = mutual ? branches.byMutual : branches.byOneSide
      rt.node = chosen
      this.state.stageNarrative = chosen.text
      if (mutual && rt.kind === 'maybeLong' && !rt.becameLong) {
        rt.becameLong = true
        this.state.monthRuntime.opportunityUsed = 2
      }
      if (chosen.gainClue) {
        acquireClue(this.state.player.clueRuntime, chosen.gainClue)
        const cd = this.clueDef(chosen.gainClue)
        this.log(`获得线索「${cd?.title ?? chosen.gainClue}」`)
      }
      this.refreshInteractChoices()
      if (rt.pendingChoices.length === 0) this.finishInteract()
      return
    }

    const nextNode = nextRaw as InteractNode
    rt.node = nextNode
    this.state.stageNarrative = nextNode.text
    if (nextNode.gainClue) {
      acquireClue(this.state.player.clueRuntime, nextNode.gainClue)
      const cd = this.clueDef(nextNode.gainClue)
      this.log(`获得线索「${cd?.title ?? nextNode.gainClue}」`)
    }
    this.refreshInteractChoices()
    if (rt.pendingChoices.length === 0) {
      this.finishInteract()
    }
  }

  private finishInteract() {
    if (this.state.interact?.node.text) this.log(this.state.interact.node.text)
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

  snapshot(): Snapshot {
    const md = this.monthDef()
    const panel = Object.entries(this.state.player.affinity)
      .map(([id, value]) => ({ id, value }))
      .sort((a, b) => b.value - a.value)
    const total = panel.reduce((s, p) => s + Math.max(0, p.value), 0)
    const identity = this.script.identities.find((i) => i.id === this.state.player.identityId)

    const cluesSnap = this.script.clues
      .filter((c) => this.state.player.clueRuntime[c.id])
      .map((c) => {
        const entry = this.state.player.clueRuntime[c.id]
        return {
          id: c.id,
          title: c.title,
          stage: entry.stage,
          total: c.stages.length,
          done: entry.stage >= c.stages.length,
        }
      })

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
        clues: cluesSnap,
        playerPower: this.state.player.power,
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
      clues: cluesSnap,
      playerPower: this.state.player.power,
    }
  }

  private monthLogBlock(): string {
    if (this.state.monthLog.length === 0) return ''
    return '【本月已发生】\n' +
      this.state.monthLog.map((l) => (l.startsWith('  ') ? l : '· ' + l)).join('\n') +
      '\n\n'
  }

  private buildPhaseView(md: MonthDef): { narrative: string; choices: { id: string; text: string }[] } {
    const ph = this.state.monthRuntime.phase
    const head: string[] = []
    head.push(`第 ${md.year} 学年 · ${md.month} 月 · ${md.type === 'holiday' ? '假期' : '上学'}`)
    head.push(this.identityHint())
    head.push('')

    const prefix = head.join('\n') + '\n' + this.monthLogBlock()

    if (ph === 'holidaySkip') {
      return {
        narrative: prefix + '（假期）这个月不上学。',
        choices: [{ id: CHOICE_SKIP, text: '（假期）跳过' }],
      }
    }

    if (ph === 'intro') {
      const ev = this.eventById(md.fixedEvent)
      const body = ev ? `【导入】\n${ev.title}：\n${ev.narrative}` : '【导入】\n这个月和往常一样。'
      return { narrative: prefix + body, choices: [{ id: 'intro_next', text: '继续' }] }
    }

    if (ph === 'mainChoice') {
      if (this.state.mainChoice === 'investigate') {
        const investigable = listInvestigable(this.script.clues, this.state.player.clueRuntime)
        const lines = [prefix + '【调查线索】你要查哪一条？']
        const choices: { id: string; text: string }[] = investigable.map((c) => ({
          id: `investigate:${c.id}`,
          text: `调查 · ${c.title}`,
        }))
        choices.push({ id: 'investigate:__cancel__', text: '算了，改做别的' })
        return { narrative: lines.join('\n'), choices }
      }

      const lines = [prefix + '【主选项】你把这个月花在哪里？']
      const choices: { id: string; text: string }[] = [{ id: 'study', text: '学习' }]
      for (const npc of this.script.npcs) {
        choices.push({ id: `bond:${npc.id}`, text: `拉近关系 · ${npc.name}` })
      }
      const investigable = listInvestigable(this.script.clues, this.state.player.clueRuntime)
      if (investigable.length > 0 && !this.state.investigatedThisMonth) {
        choices.push({ id: 'investigate', text: `调查线索（${investigable.length} 条可查）` })
      }
      return { narrative: lines.join('\n'), choices }
    }

    if (ph === 'feedback') {
      const lines = [prefix + '【反馈】']
      if (this.state.feedback) {
        lines.push('自己：' + this.state.feedback.self)
        lines.push('身边：' + this.state.feedback.peers)
        if (this.state.feedback.special) lines.push('特殊：' + this.state.feedback.special)
      }
      return { narrative: lines.join('\n'), choices: [{ id: 'feedback_next', text: '继续' }] }
    }

    if (ph === 'smallEvent') {
      return {
        narrative: prefix + '【小事件】\n' + (this.state.stageNarrative ?? '这个月没有特别的事。'),
        choices: [{ id: 'small_next', text: '继续' }],
      }
    }

    if (ph === 'fixedEvent') {
      const ev = this.eventById(this.state.monthRuntime.fixedEventId)
      let body = `【固定事件】${ev?.title ?? ''}`
      if (ev) body += '\n' + ev.narrative
      const ctx = this.ctx()
      const choices = (ev?.choices ?? [])
        .filter((c) => evalCondition(c.require, ctx))
        .map((c) => ({ id: c.id, text: c.text }))
      return { narrative: prefix + body, choices }
    }

    if (ph === 'interact1' || ph === 'interact2') {
      const rt = this.state.interact
      const hint = this.state.phaseHint
      let body = `【${hint}】`
      if (!rt) {
        body += '\n（本月没有发生随机互动。）'
        return { narrative: prefix + body, choices: [{ id: 'interact_next', text: '继续' }] }
      }
      body += '\n' + (this.state.stageNarrative ?? rt.node.text)
      const choices = rt.pendingChoices.map((c) => ({ id: c.id, text: c.text }))
      if (choices.length === 0) {
        return { narrative: prefix + body, choices: [{ id: 'interact_next', text: '继续' }] }
      }
      return { narrative: prefix + body, choices }
    }

    if (ph === 'summary') {
      return {
        narrative: prefix + '【本月反馈】\n这个月结束了。',
        choices: [{ id: 'summary_next', text: '进入下个月' }],
      }
    }

    return { narrative: prefix, choices: [] }
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
      if (this.state.mainChoice === 'investigate') {
        if (choiceId === 'investigate:__cancel__') {
          this.state.mainChoice = undefined
          this.state.phaseHint = '主选项'
        } else {
          this.handleInvestigate(choiceId)
        }
        return this.emitAndSnap()
      }
      this.handleMainChoice(choiceId)
      return this.emitAndSnap()
    }

    if (ph === 'feedback') {
      if (choiceId === 'feedback_next') this.runSmallEvent()
      return this.emitAndSnap()
    }

    if (ph === 'smallEvent') {
      if (choiceId === 'small_next') {
        if (this.state.stageNarrative) this.log('小事件：' + this.state.stageNarrative)
        this.state.stageNarrative = undefined
        this.toFixedOrInteract1()
      }
      return this.emitAndSnap()
    }

    if (ph === 'fixedEvent') {
      const ev = this.eventById(this.state.monthRuntime.fixedEventId)
      const choice = ev?.choices.find((c) => c.id === choiceId)
      if (choice) {
        const ctx = this.ctx()
        const { logs, gainedClues } = applyEffects(choice.effects, ctx)
        this.state.player.affinity = ctx.affinity
        this.state.player.flags = ctx.flags
        this.state.player.goalProgress = ctx.goalProgress
        this.enforceAffinityCap()
        this.log(`固定事件 · ${ev?.title ?? ''} → ${choice.text}`)
        for (const l of logs) this.log(l)
        for (const cid of gainedClues) {
          acquireClue(this.state.player.clueRuntime, cid)
          const cd = this.clueDef(cid)
          this.log(`获得线索「${cd?.title ?? cid}」`)
        }
      }
      if (this.checkOutOfControl()) return this.emitAndSnap()
      this.toInteract1()
      return this.emitAndSnap()
    }

    if (ph === 'interact1' || ph === 'interact2') {
      if (choiceId === 'oc_next') {
        this.toSummary()
        return this.emitAndSnap()
      }
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