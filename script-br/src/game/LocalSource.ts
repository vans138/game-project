// GameSource 单机实现（v6）：开局选身份 → 选"在意的人" → RunEngine → GameView
//
// 两步开局：
//   1) 选玄幻身份（本批只有"龙烬余孤"）
//   2) 选"在意的人"（crushId）——它决定随机互动里"她"的树是否进池、以及 byMutual 的判定对象

import type { GameSource, GameView } from './GameView'
import { SCRIPT_1 } from './script/script1'
import { RunEngine, type Snapshot } from './engine/RunEngine'

const PLACEHOLDER_BG = 'linear-gradient(160deg, #1f2a44 0%, #33507a 50%, #6a8bbf 100%)'

function backgroundFor(year: number, type: 'school' | 'holiday'): string {
  if (type === 'holiday') {
    return 'linear-gradient(160deg, #2e2640 0%, #4a3c5e 55%, #8a7ba0 100%)'
  }
  const palettes: Record<number, string> = {
    1: 'linear-gradient(160deg, #24324f 0%, #3c5a86 60%, #7aa0cf 100%)',
    2: 'linear-gradient(160deg, #3a2a44 0%, #6a4a6e 55%, #b98ec2 100%)',
    3: 'linear-gradient(160deg, #1a1a24 0%, #3a3a52 55%, #7777a0 100%)',
  }
  return palettes[year] ?? PLACEHOLDER_BG
}

function npcName(id: string): string {
  return SCRIPT_1.npcs.find((n) => n.id === id)?.name ?? id
}

function toView(s: Snapshot): GameView {
  return {
    month: s.monthIndex,
    year: s.year,
    monthOfYear: s.month,
    monthType: s.monthType,
    phase: s.phase,
    phaseHint: s.phaseHint,
    background: backgroundFor(s.year, s.monthType),
    narrative: s.narrative,
    choices: s.choices.map((c) => ({ id: c.id, text: c.text })),
    finished: s.finished,
    outcomeTitle: s.outcomeTitle,
    outcomeNarrative: s.outcomeNarrative,
    affinity: s.affinityPanel
      .filter((p) => p.value !== 0)
      .map((p) => ({ name: npcName(p.id), value: p.value })),
    affinityTotal: s.affinityTotal,
    affinityCap: s.affinityCap,
    identityName: s.identityName,
    crushName: s.crushName,
    isEventMonth: s.isEventMonth,
  }
}

export function createLocalSource(): GameSource {
  let engine: RunEngine | null = null
  let lastSnap: Snapshot | null = null
  let stage: 'identity' | 'crush' | 'run' = 'identity'
  let chosenIdentity: string | null = null
  const listeners = new Set<(view: GameView) => void>()

  function notify(view: GameView) {
    listeners.forEach((fn) => fn(view))
  }

  function startRun(crushId: string) {
    if (!chosenIdentity) return
    engine = new RunEngine(SCRIPT_1, chosenIdentity, { crushId })
    lastSnap = engine.snapshot()
    stage = 'run'
    engine.subscribe((s) => {
      lastSnap = s
      notify(toView(s))
    })
    notify(toView(lastSnap))
  }

  function identityView(): GameView {
    const first = SCRIPT_1.identities[0]
    return {
      month: 0,
      year: 0,
      monthOfYear: 0,
      monthType: 'school',
      phase: 'intro',
      phaseHint: '',
      background: PLACEHOLDER_BG,
      narrative:
        '【轮回校园 · 选择你的玄幻身份】\n\n' +
        SCRIPT_1.identities.map((x) => `· ${x.name}\n  ${x.desc}`).join('\n\n') +
        '\n\n选定后，你会带着一种身份走进这三年。',
      choices: SCRIPT_1.identities.map((x) => ({ id: `identity:${x.id}`, text: x.name })),
      finished: false,
      affinity: [],
      affinityTotal: 0,
      affinityCap: SCRIPT_1.affinityCap,
      identityName: first?.name ?? '',
      crushName: '',
      isEventMonth: false,
    }
  }

  function crushView(): GameView {
    return {
      month: 0,
      year: 0,
      monthOfYear: 0,
      monthType: 'school',
      phase: 'intro',
      phaseHint: '',
      background: PLACEHOLDER_BG,
      narrative:
        '【轮回校园 · 你在意的人】\n\n' +
        '这三年里，你总会不自觉地看向某个人。\n' +
        'TA 是谁，会决定你深夜会不会绕路、会不会在人群里先找那一张脸。\n\n' +
        '（选定后不可更改。你与 TA 的好感达到 30，才会出现"双方都主动"的分支。）',
      choices: SCRIPT_1.npcs.map((n) => ({ id: `crush:${n.id}`, text: `${n.name} · ${n.relation}` })),
      finished: false,
      affinity: [],
      affinityTotal: 0,
      affinityCap: SCRIPT_1.affinityCap,
      identityName: chosenIdentity ?? '',
      crushName: '',
      isEventMonth: false,
    }
  }

  return {
    getView() {
      if (stage === 'identity') return identityView()
      if (stage === 'crush' || !engine) return crushView()
      return toView(lastSnap ?? engine.snapshot())
    },
    choose(choiceId: string) {
      if (stage === 'identity') {
        if (choiceId.startsWith('identity:')) {
          const identityId = choiceId.slice('identity:'.length)
          const found = SCRIPT_1.identities.find((x) => x.id === identityId)
          if (found) {
            chosenIdentity = found.id
            stage = 'crush'
            const view = crushView()
            notify(view)
            return view
          }
        }
        return identityView()
      }
      if (stage === 'crush' || !engine) {
        if (choiceId.startsWith('crush:')) {
          const crushId = choiceId.slice('crush:'.length)
          if (SCRIPT_1.npcs.some((n) => n.id === crushId)) {
            startRun(crushId)
            return lastSnap ? toView(lastSnap) : crushView()
          }
        }
        return crushView()
      }
      const snap = engine.choose(choiceId)
      lastSnap = snap
      return toView(snap)
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}
