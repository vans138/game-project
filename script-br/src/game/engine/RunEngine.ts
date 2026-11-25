// 局内引擎 v7：接 crush 系统 + "她"的完整分叉树 + 两处地基修复
//
// v7 变更：
//   1) 玩家在开局选定"在意的人"（crushId），byMutual 改为按好感阈值判定（不再抛硬币）
//   2) 随机互动支持 chance 节点（"她在不在""校门口遇不遇到"），并支持选项自带 effects
//   3) 好感总封顶改为"只限制新增"：不再回头按比例裁剪已积累的好感
//   4) 同月随机互动 ①/② 不重复抽同一个事件
//   5) 任意阶段收到 __advance__ 时会推进到下一阶段，避免空选项永久卡死
//   6) 小事件的"负向权重 > 正向"真正生效（学习时，在意的人好感过低 → -0.4）

import type {
  Script,
  EventDef,
  MonthDef,
  InteractEvent,
  InteractNode,
  InteractChoice,
  IdentityFactorId,
  Effect,
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
  /** 本月已抽到过的随机互动事件 id（①/② 不再重复抽同一个） */
  usedEventIds: string[]
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
  feedback?: { self: string; peers: string; special?: string }
  phaseHint: string
  /** 累积日志：所有阶段产生的叙述都追加到这里，不再被覆盖 */
  monthLog: string[]
  /** 当前阶段专用的临时叙述（如小事件文本、互动节点文本） */
  stageNarrative?: string
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
  /** 开局势力的"在意的人"名字（没选则为空串） */
  crushName: string
  isEventMonth: boolean
}

export const CHOICE_SKIP = '__skip__'

function hashSeed(s: string): number {
  let h = 2166136261 >>> 0
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0 }
  return h >>> 0
}

export interface RunOptions {
  seed?: number
  /** 开局选定的"在意的人"（npc id）；不传则该局没有 crush，相关互动不进池 */
  crushId?: string
}

export class RunEngine {
  private state: RunState
  private script: Script
  private listeners = new Set<(s: Snapshot) => void>()
  private rng: Rng
  private lastOutcomeTitle?: string
  private lastOutcomeNarrative?: string

  constructor(script: Script, identityId: string, opts: RunOptions = {}) {
    this.script = script
    const identity = script.identities.find((i) => i.id === identityId) ?? script.identities[0]
    this.rng = createRng(opts.seed ?? hashSeed(identity.id + ':' + Date.now()))

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
        crushId: opts.crushId && affinity[opts.crushId] !== undefined ? opts.crushId : undefined,
      },
      monthRuntime: {
        index: firstMonth?.index ?? 1,
        phase: 'intro',
        isEventMonth: !!firstMonth?.fixedEvent,
        fixedEventId: firstMonth?.fixedEvent,
        opportunityUsed: 0,
        usedEventIds: [],
      },
      interact: null,
      phaseHint: '',
      monthLog: [],
      stageNarrative: undefined,
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

  /** 追加一条日志到本月累积 */
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
    this.state.feedback = undefined
    this.state.monthLog = []
    this.state.stageNarrative = undefined

    this.state.monthRuntime = {
      index: md.index,
      phase: 'intro',
      isEventMonth: !!md.fixedEvent,
      fixedEventId: md.fixedEvent,
      opportunityUsed: 0,
      usedEventIds: [],
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
      const npc = this.script.npcs.find((n) => n.id === targetId)
      const bump = npc?.relation === '友' ? 8 : npc?.relation === '尊' ? 5 : 4
      const gained = this.addAffinity(targetId, bump)
      this.state.feedback = {
        self:
          `你试着和${npc?.name ?? '某人'}多待了一会儿。` +
          (npc?.relation === '友' ? '你们聊得比想象中轻松。' : ''),
        peers: '班里同学对此有点好奇。',
        special: npc?.relation === '谜' ? 'TA 看你的眼神，比往常多停留了一秒。' : undefined,
      }
      this.log(
        gained > 0
          ? `好感 · ${npc?.name ?? targetId} +${gained}`
          : `好感 · ${npc?.name ?? targetId} 已到总上限，这次没能再拉近`
      )
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

  // ---------- 好感：总封顶只限制"新增"，不回头改历史 ----------
  private positiveTotal(): number {
    let sum = 0
    for (const v of Object.values(this.state.player.affinity)) sum += Math.max(0, v)
    return sum
  }

  /**
   * 增加好感，但受"总好感封顶"约束：只把剩余额度给它，超出部分直接丢弃。
   * 关键点：绝不按比例回缩已有好感（旧实现会让玩家越玩数值越低）。
   * 返回实际增加的值。
   */
  private addAffinity(target: string, delta: number): number {
    const aff = this.state.player.affinity
    if (delta <= 0) {
      aff[target] = Math.max(0, (aff[target] ?? 0) + delta)
      return delta
    }
    const headroom = Math.max(0, this.script.affinityCap - this.positiveTotal())
    const gain = Math.min(delta, headroom)
    if (gain > 0) aff[target] = (aff[target] ?? 0) + gain
    return gain
  }

  /**
   * 跑完 applyEffects 之后调用：把"本次新增"裁到封顶额度内。
   * before 是结算前的好感快照，只会削减增量，不会动存量。
   */
  private settleAffinityGains(before: Record<string, number>) {
    const aff = this.state.player.affinity
    let over = this.positiveTotal() - this.script.affinityCap
    if (over <= 0) return
    for (const k of Object.keys(aff)) {
      if (over <= 0) break
      const gain = aff[k] - (before[k] ?? 0)
      if (gain <= 0) continue
      const cut = Math.min(gain, over)
      aff[k] -= cut
      over -= cut
    }
  }

  // ---------- 小事件 ----------
  private crushAffinity(): number {
    const cid = this.state.player.crushId
    if (!cid) return 0
    return this.state.player.affinity[cid] ?? 0
  }

  private rollSmallEvent(): boolean {
    const base = 0.4
    let mainBonus = 0
    if (this.state.mainChoice === 'study' || this.state.mainChoice === 'bond') mainBonus = 0.25

    // 负向权重 > 正向（硬约束）：在意的人跟你还很生疏时，学习会被分心，-0.4 > +0.25。
    // 等"她与别人走得很近"的正式事件接入后，这里的代理条件可以替换。
    let relationMod = 0
    if (this.state.mainChoice === 'study') {
      relationMod = this.state.player.crushId && this.crushAffinity() < 10 ? -0.4 : 0
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

  private pickInteract(mode: 'all' | 'shortOnly'): InteractEvent | null {
    const pool = this.script.interactEvents
    if (!pool.length) return null
    const used = new Set(this.state.monthRuntime.usedEventIds)
    const filtered = pool.filter((e) => {
      if (mode === 'shortOnly' && e.kind !== 'short') return false
      // 同一个月里 ①/② 不重复抽同一个事件
      if (used.has(e.id)) return false
      // hasCrush: true 且玩家开局没有选定"在意的人" → 过滤掉
      if (e.requires?.hasCrush === true && !this.state.player.crushId) return false
      if (e.requires?.identityFactor && e.requires.identityFactor !== this.state.player.identityFactor) return false
      if (e.requires?.crushAffinityAtLeast !== undefined) {
        if (!this.state.player.crushId) return false
        if (this.crushAffinity() < e.requires.crushAffinityAtLeast) return false
      }
      return true
    })
    if (!filtered.length) return null
    const idx = this.rng.weightedIndex(filtered.map((e) => e.weight))
    return idx >= 0 ? filtered[idx] : null
  }

  private startInteract(event: InteractEvent, isFirst: boolean) {
    const rt: InteractRuntime = {
      eventId: event.id,
      kind: event.kind,
      node: event.root,
      becameLong: false,
      pendingChoices: [],
    }
    this.state.interact = rt
    this.state.monthRuntime.usedEventIds.push(event.id)
    if (event.kind === 'long') {
      this.state.monthRuntime.opportunityUsed = 2
    } else {
      this.state.monthRuntime.opportunityUsed = isFirst ? 1 : 2
    }
    this.state.phaseHint = isFirst ? '随机互动①' : '随机互动②'
    this.enterNode(event.root)
  }

  /** 把 {crush} 之类占位符换成真实文本，剧本里就不用写死某个 NPC 名字 */
  private render(text: string): string {
    const crushId = this.state.player.crushId
    const crushName = crushId ? (this.script.npcs.find((n) => n.id === crushId)?.name ?? '那个人') : '那个人'
    return text.replace(/\{crush\}/g, crushName)
  }

  /**
   * 剧本里可以用 target: '$crush' 表示"当前的在意的人"，
   * 这样同一棵树套在任何一个 NPC 上都成立。
   */
  private resolveEffects(effects: Effect[] | undefined): Effect[] {
    if (!effects?.length) return []
    const crushId = this.state.player.crushId
    return effects.map((e) =>
      e.type === 'affinity' && e.target === '$crush' && crushId ? { ...e, target: crushId } : e
    )
  }

  /**
   * 进入一个节点：如果是 chance 节点（无 choices 但有概率分支），先掷骰子再进入结果节点。
   * 概率节点的文本会拼进当前正文（"她在不在"的结果要看得见），不再重复塞进月志。
   */
  private enterNode(node: InteractNode) {
    const rt = this.state.interact
    if (!rt) return
    let cur = node
    const parts: string[] = []
    let guard = 0
    while (cur.chance && !(cur.choices?.length) && guard++ < 8) {
      if (cur.text) parts.push(this.render(cur.text))
      cur = this.rng.chance(cur.chance.p) ? cur.chance.ifHit : cur.chance.ifMiss
    }
    rt.node = cur
    parts.push(this.render(cur.text))
    this.state.stageNarrative = parts.join('\n\n')
    this.refreshInteractChoices()
    if (rt.pendingChoices.length === 0) this.finishInteract()
  }

  private refreshInteractChoices() {
    const rt = this.state.interact
    if (!rt) return
    const choices = rt.node.choices ?? []
    rt.pendingChoices = choices
      .map((c, i) => ({ id: `ic:${i}`, text: this.render(c.text), src: c }))
      .filter(({ src }) => {
        const r = src.requires
        if (!r) return true
        if (r.identityFactor && r.identityFactor !== this.state.player.identityFactor) return false
        if (r.hasCrush === true && !this.state.player.crushId) return false
        if (r.crushAffinityAtLeast !== undefined) {
          if (!this.state.player.crushId) return false
          if (this.crushAffinity() < r.crushAffinityAtLeast) return false
        }
        return true
      })
  }

  /** byMutual 判定：有 mutual 规则就按好感阈值，没有才退回旧的 0.6 抛硬币 */
  private isMutual(event: InteractEvent): boolean {
    const rule = event.mutual
    if (!rule) return this.rng.chance(0.6)
    const npcId = rule.from === 'crush' ? this.state.player.crushId : rule.from
    if (!npcId) return false
    return (this.state.player.affinity[npcId] ?? 0) >= rule.threshold
  }

  private handleInteractChoice(choiceId: string) {
    const rt = this.state.interact
    if (!rt) { this.finishInteract(); return }
    const picked = rt.pendingChoices.find((c) => c.id === choiceId)
    if (!picked) return

    // 月志只记"你选了什么"，节点原文留在正文区展示，避免整棵树把正文埋掉
    this.log(`你选择：${picked.text}`)

    // 选项自带的即时效果（好感/flag/目标/日志）
    const choiceEffects = this.resolveEffects(picked.src.effects)
    if (choiceEffects.length) {
      const before = { ...this.state.player.affinity }
      const ctx = this.ctx()
      const logs = applyEffects(choiceEffects, ctx)
      this.settleAffinityGains(before)
      for (const l of logs) this.log(l)
    }

    const nextRaw = picked.src.next
    if (!nextRaw) {
      this.finishInteract()
      return
    }

    if (typeof (nextRaw as { byMutual?: unknown }).byMutual === 'object' &&
        typeof (nextRaw as { byOneSide?: unknown }).byOneSide === 'object') {
      const branches = nextRaw as { byMutual: InteractNode; byOneSide: InteractNode }
      const event = this.script.interactEvents.find((e) => e.id === rt.eventId)
      const mutual = event ? this.isMutual(event) : this.rng.chance(0.6)
      const chosen = mutual ? branches.byMutual : branches.byOneSide
      if (mutual && rt.kind === 'maybeLong' && !rt.becameLong) {
        rt.becameLong = true
        this.state.monthRuntime.opportunityUsed = 2
      }
      this.enterNode(chosen)
      return
    }

    this.enterNode(nextRaw as InteractNode)
  }

  private finishInteract() {
    // 交互结束：把最后的收尾叙述沉淀进月志（中间节点的原文只留在正文区，不重复堆叠）
    if (this.state.stageNarrative) this.log(this.state.stageNarrative)
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
    const crush = this.script.npcs.find((n) => n.id === this.state.player.crushId)

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
        crushName: crush?.name ?? '',
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
      crushName: crush?.name ?? '',
      isEventMonth: this.state.monthRuntime.isEventMonth,
    }
  }

  /** 拼出"月志"区块：保证累积日志在每段顶部可见 */
  private monthLogBlock(): string {
    if (this.state.monthLog.length === 0) return ''
    return '【本月已发生】\n' + this.state.monthLog.map((l) => '· ' + l).join('\n') + '\n\n'
  }

  private buildPhaseView(md: MonthDef): { narrative: string; choices: { id: string; text: string }[] } {
    const ph = this.state.monthRuntime.phase
    const head: string[] = []
    head.push(`第 ${md.year} 学年 · ${md.month} 月 · ${md.type === 'holiday' ? '假期' : '上学'}`)
    head.push(this.identityHint())
    head.push('')

    // 所有阶段都把累积月志放前面
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
      const lines = [prefix + '【主选项】你把这个月花在哪里？']
      const choices: { id: string; text: string }[] = [{ id: 'study', text: '学习' }]
      for (const npc of this.script.npcs) {
        choices.push({ id: `bond:${npc.id}`, text: `拉近关系 · ${npc.name}` })
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
      let body = `【${ph === 'interact1' ? '随机互动①' : '随机互动②'}】`
      if (!rt) {
        body += '\n（本月没有发生随机互动。）'
        return { narrative: prefix + body, choices: [{ id: 'interact_next', text: '继续' }] }
      }
      body += '\n' + (this.state.stageNarrative ?? this.render(rt.node.text))
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
  /**
   * UI 在没有选项时会显示一个"推进"按钮（__advance__）。
   * 这里把它翻译成"当前阶段的默认继续动作"，避免某个阶段选项被条件过滤空后永久卡死。
   */
  private advancePhase() {
    const ph = this.state.monthRuntime.phase
    if (ph === 'holidaySkip') { this.advanceMonth(); return }
    if (ph === 'intro') {
      this.state.monthRuntime.phase = 'mainChoice'
      this.state.phaseHint = '主选项'
      return
    }
    if (ph === 'feedback') { this.runSmallEvent(); return }
    if (ph === 'smallEvent') {
      if (this.state.stageNarrative) this.log('小事件：' + this.state.stageNarrative)
      this.state.stageNarrative = undefined
      this.toFixedOrInteract1()
      return
    }
    if (ph === 'fixedEvent') { this.toInteract1(); return }
    if (ph === 'interact1' || ph === 'interact2') { this.finishInteract(); return }
    if (ph === 'summary') { this.advanceMonth(); return }
  }

  choose(choiceId: string): Snapshot {
    if (this.state.finished) return this.snapshot()
    const ph = this.state.monthRuntime.phase

    if (choiceId === '__advance__') {
      this.advancePhase()
      return this.emitAndSnap()
    }

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
      if (choiceId === 'small_next') {
        // 小事件文本沉淀进月志，避免后续阶段看不到
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
        const before = { ...this.state.player.affinity }
        const ctx = this.ctx()
        const logs = applyEffects(this.resolveEffects(choice.effects), ctx)
        // 封顶只裁掉本次新增，不动以前攒的
        this.settleAffinityGains(before)
        // 记录玩家做了什么
        this.log(`固定事件 · ${ev?.title ?? ''} → ${choice.text}`)
        // 记录效果文本
        for (const l of logs) this.log(l)
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