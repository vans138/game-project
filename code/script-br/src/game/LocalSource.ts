// GameSource 单机实现（v5）
// 变更：
//   - 开局从「选角色」改为「选玄幻身份」，本批只有龙烬余孤一个选项
//   - 身份选定后，引擎随机决定 seal/ancient（玩家不可见）
//   - 透传新字段（phase / phaseHint / identityName / isEventMonth 等）

import type { GameSource, GameView } from './GameView'
import { SCRIPT_1 } from './script/script1'
import { RunEngine, type Snapshot } from './engine/RunEngine'

const PLACEHOLDER_BG = 'linear-gradient(160deg, #1f2a44 0%, #33507a 50%, #6a8bbf 100%)'
const SEED_KEY = 'script-br:last-seed'

// 背景：学期内/假期用不同色调，本批不接真图
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
    isEventMonth: s.isEventMonth,
  }
}

export function createLocalSource(): GameSource {
  let engine: RunEngine | null = null
  let lastSnap: Snapshot | null = null
  const listeners = new Set<(view: GameView) => void>()

  function startWithIdentity(identityId: string) {
    // 固定种子？暂时每次随机，保证同一身份开局不同
    let seed: number | undefined
    try {
      const stored = localStorage.getItem(SEED_KEY)
      // 本批不强制复用旧种子（身份机制需要每局有变化），先忽略 stored，用真随机
      seed = undefined
      if (!stored) localStorage.setItem(SEED_KEY, String((Math.random() * 0xffffffff) >>> 0))
    } catch {}

    engine = new RunEngine(SCRIPT_1, identityId, seed)
    lastSnap = engine.snapshot()
    engine.subscribe((s) => {
      lastSnap = s
      const view = toView(s)
      listeners.forEach((fn) => fn(view))
    })
    const view = toView(lastSnap)
    listeners.forEach((fn) => fn(view))
  }

  function identityView(): GameView {
    const id = SCRIPT_1.identities[0]
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
      identityName: id?.name ?? '',
      isEventMonth: false,
    }
  }

  return {
    getView() {
      if (!engine) return identityView()
      return toView(lastSnap ?? engine.snapshot())
    },
    choose(choiceId: string) {
      if (!engine) {
        if (choiceId.startsWith('identity:')) {
          const identityId = choiceId.slice('identity:'.length)
          const found = SCRIPT_1.identities.find((x) => x.id === identityId)
          if (found) {
            startWithIdentity(found.id)
            return lastSnap ? toView(lastSnap) : identityView()
          }
        }
        return identityView()
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