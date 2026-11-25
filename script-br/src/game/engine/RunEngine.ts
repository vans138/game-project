// RunEngine v9（精简完整版）
// - 数据层继承自 RunEngineBase
// - 本文件只放：Snapshot 结构、buildPhaseView、identityHint、choose、emitAndSnap、subscribe
// - 外部只 import { RunEngine, type Snapshot }，接口不变

import type { Script } from '../script/types'
import { evalCondition } from './evaluator'
import { listInvestigable } from './clues'
import { RunEngineBase, CHOICE_SKIP, type MonthPhase } from './RunEngineBase'
import { acquireClue } from './clues'

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
  acquiredFactors: string[]
  coercedTargetName?: string
}

export class RunEngine extends RunEngineBase {
  private listeners = new Set<(s: Snapshot) => void>()

  constructor(script: Script, identityId: string, seed?: number) {
    super(script, identityId, seed)
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
          id: c.id, title: c.title, stage: entry.stage,
          total: c.stages.length, done: entry.stage >= c.stages.length,
        }
      })

    const acquiredFactors = [...this.state.player.acquiredFactors]
      .map((id) => this.script.acquiredFactors.find((a) => a.id === id)?.name ?? id)

    const coercedTargetName = this.state.coerceState
      ? this.npcName(this.state.coerceState.targetId)
      : undefined

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
        acquiredFactors,
        coercedTargetName,
      }
    }

    const { narrative, choices } = this.buildPhaseView()
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
      acquiredFactors,
      coercedTargetName,
    }
  }

  private monthLogBlock(): string {
    if (this.state.monthLog.length === 0) return ''
    return '【本月已发生】\n' +
      this.state.monthLog.map((l) => (l.startsWith('  ') ? l : '· ' + l)).join('\n') + '\n\n'
  }

  private identityHint(): string {
    if (this.state.player.identityFactor === 'seal') {
      return '（你偶尔能听见自己体内，还有另一个心跳。）'
    }
    return '（你偶尔能感觉到，有什么东西在躲着你。）'
  }

  private buildPhaseView(): { narrative: string; choices: { id: string; text: string }[] } {
    const md = this.monthDef()
    if (!md) return { narrative: '', choices: [] }
    const ph = this.state.monthRuntime.phase
    const head: string[] = []
    head.push(`第 ${md.year} 学年 · ${md.month} 月 · ${md.type === 'holiday' ? '假期' : '上学'}`)
    head.push(this.identityHint())
    head.push('')
    const prefix = head.join('\n') + '\n' + this.monthLogBlock()

    if (ph === 'holidaySkip') {
      return { narrative: prefix + '（假期）这个月不上学。', choices: [{ id: CHOICE_SKIP, text: '（假期）跳过' }] }
    }

    if (ph === 'intro') {
      const ev = this.eventById(md.fixedEvent)
      const body = ev ? `【导入】\n${ev.title}：\n${ev.narrative}` : '【导入】\n这个月和往常一样。'
      return { narrative: prefix + body, choices: [{ id: 'intro_next', text: '继续' }] }
    }

    if (ph === 'mainChoice') {
      if (this.state.mainChoice === 'investigate') {
        const investigable = listInvestigable(this.script.clues, this.state.player.clueRuntime)
        const choices: { id: string; text: string }[] = investigable.map((c) => ({
          id: `investigate:${c.id}`,
          text: `调查 · ${c.title}`,
        }))
        choices.push({ id: 'investigate:__cancel__', text: '算了，改做别的' })
        return { narrative: prefix + '【调查线索】你要查哪一条？', choices }
      }
      if (this.state.mainChoice === 'coerce') {
        const candidates = this.coerceCandidates()
        const choices: { id: string; text: string }[] = candidates.map((id) => ({
          id: `coerce:${id}`,
          text: `龙迫 · ${this.npcName(id)}`,
        }))
        choices.push({ id: 'coerce:__cancel__', text: '算了，改做别的' })
        return { narrative: prefix + '【龙迫】你要把体内的呼唤压向谁？', choices }
      }

      const choices: { id: string; text: string }[] = [{ id: 'study', text: '学习' }]
      for (const npc of this.script.npcs) {
        choices.push({ id: `bond:${npc.id}`, text: `拉近关系 · ${npc.name}` })
      }
      const investigable = listInvestigable(this.script.clues, this.state.player.clueRuntime)
      if (investigable.length > 0 && !this.state.investigatedThisMonth) {
        choices.push({ id: 'investigate', text: `调查线索（${investigable.length} 条可查）` })
      }
      const coerceCandidates = this.coerceCandidates()
      if (coerceCandidates.length > 0 && this.state.player.dragonCoerceUsed < 2) {
        choices.push({ id: 'coerce', text: `龙迫（${coerceCandidates.length} 个目标）` })
      }
      return { narrative: prefix + '【主选项】你把这个月花在哪里？', choices }
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
      if (ev?.tier === 'critical' && this.state.player.acquiredFactors.has('acq_call_dragon')) {
        choices.push({ id: '__call_dragon__', text: '【唤龙】去应答那个呼唤' })
      }
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
      if (this.state.mainChoice === 'coerce') {
        if (choiceId === 'coerce:__cancel__') {
          this.state.mainChoice = undefined
          this.state.phaseHint = '主选项'
        } else {
          this.handleCoerceChoice(choiceId)
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
      if (choiceId === '__call_dragon__') {
        this.log('你应答了那个呼唤。有什么东西在你身体里伸了个懒腰。')
        if (this.checkOutOfControl()) return this.emitAndSnap()
        this.toInteract1()
        return this.emitAndSnap()
      }
      const choice = ev?.choices.find((c) => c.id === choiceId)
      if (choice) {
        this.log(`固定事件 · ${ev?.title ?? ''} → ${choice.text}`)
        this.applyChoice(choice)
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