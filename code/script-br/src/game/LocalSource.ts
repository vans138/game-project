// GameSource 单机实现：选角 → 启动 RunEngine → 转 GameView。
// v4：透传 activeFactors；一局固定 seed（存 localStorage 便于复现）。

import type { GameSource, GameView } from './GameView'
import { SCRIPT_1 } from './script/script1'
import { RunEngine, type Snapshot } from './engine/RunEngine'
import type { Role } from './script/types'

const PLACEHOLDER_BG = 'linear-gradient(160deg, #1f2a44 0%, #33507a 50%, #6a8bbf 100%)'
const SEED_KEY = 'script-br:last-seed'

function backgroundFor(year: number): string {
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
    background: backgroundFor(s.year),
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
    activeFactors: s.activeFactors,
  }
}

export function createLocalSource(): GameSource {
  let engine: RunEngine | null = null
  let lastSnap: Snapshot | null = null
  const listeners = new Set<(view: GameView) => void>()

  function startWithRole(role: Role) {
    // 一局固定 seed：首次生成后落 localStorage，刷新页面同一局仍可复现。
    let seed: number | undefined
    try {
      const stored = localStorage.getItem(SEED_KEY)
      if (stored) seed = Number(stored) >>> 0
      else {
        seed = (Math.random() * 0xffffffff) >>> 0
        localStorage.setItem(SEED_KEY, String(seed))
      }
    } catch {
      // 隐私模式/无 localStorage：退化为纯运行时 seed
    }

    engine = new RunEngine(SCRIPT_1, role, seed)
    lastSnap = engine.snapshot()
    engine.subscribe((s) => {
      lastSnap = s
      const view = toView(s)
      listeners.forEach((fn) => fn(view))
    })
    const view = toView(lastSnap)
    listeners.forEach((fn) => fn(view))
  }

  function rosterView(): GameView {
    return {
      month: 0,
      background: PLACEHOLDER_BG,
      narrative:
        '【轮回校园 · 选择你的身份】\n\n' +
        SCRIPT_1.roles.map((r) => `· ${r.name}｜表面任务：${r.surfaceTask}`).join('\n') +
        `\n\n校园里有 ${SCRIPT_1.npcs.length} 个人会与你相遇。选定后，你将带着一种"身份"走进这三年。`,
      choices: SCRIPT_1.roles.map((r) => ({ id: `role:${r.id}`, text: r.name })),
      finished: false,
      affinity: [],
      affinityTotal: 0,
      affinityCap: SCRIPT_1.affinityCap,
      activeFactors: [],
    }
  }

  return {
    getView() {
      if (!engine) return rosterView()
      return toView(lastSnap ?? engine.snapshot())
    },
    choose(choiceId: string) {
      if (!engine) {
        if (choiceId.startsWith('role:')) {
          const roleId = choiceId.slice('role:'.length)
          const role = SCRIPT_1.roles.find((r) => r.id === roleId)
          if (role) {
            startWithRole(role)
            return lastSnap ? toView(lastSnap) : rosterView()
          }
        }
        return rosterView()
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