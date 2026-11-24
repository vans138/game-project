// 把 RunEngine 包装成 GameSource 接口：GameScreen 只认 GameView + GameSource。
// 未来联网版只需把 createLocalSource 换成 createRemoteSource，UI 不动。

import type { GameSource, GameView } from './GameView'
import { SCRIPT_1 } from './script/script1'
import { RunEngine, type Snapshot } from './engine/RunEngine'
import type { Role } from './script/types'

const PLACEHOLDER_BG =
  'linear-gradient(160deg, #1f2a44 0%, #33507a 50%, #6a8bbf 100%)'

/** 每学年、月对应不同背景（MVP 用渐变示意，将来换图片 URL） */
function backgroundFor(year: number, month: number): string {
  const palettes: Record<number, string> = {
    1: 'linear-gradient(160deg, #24324f 0%, #3c5a86 60%, #7aa0cf 100%)', // 春/秋清爽
    2: 'linear-gradient(160deg, #3a2a44 0%, #6a4a6e 55%, #b98ec2 100%)', // 紫调
    3: 'linear-gradient(160deg, #1a1a24 0%, #3a3a52 55%, #7777a0 100%)', // 沉暗收尾
  }
  return palettes[year] ?? PLACEHOLDER_BG
}

/** 把引擎 Snapshot 转成 UI 用的 GameView */
function toView(s: Snapshot, prevAffinityText?: string): GameView {
  let narrative = s.narrative
  if (prevAffinityText) narrative = prevAffinityText + '\n\n' + narrative
  return {
    month: s.monthIndex,
    background: backgroundFor(s.year, s.month),
    narrative,
    choices: s.choices.map((c) => ({ id: c.id, text: c.text })),
    finished: s.finished,
    outcomeTitle: s.outcomeTitle,
    outcomeNarrative: s.outcomeNarrative,
  }
}

export function createLocalSource(): GameSource {
  // 延迟创建引擎：先让 UI 选角色
  let engine: RunEngine | null = null
  let lastSnap: Snapshot | null = null
  const listeners = new Set<(view: GameView) => void>()

  // 角色选择阶段：给定一份可用角色列表，player 选一个后 engine 开跑
  function startWithRole(role: Role) {
    engine = new RunEngine(SCRIPT_1, role)
    lastSnap = engine.snapshot()
    engine.subscribe((s) => {
      lastSnap = s
      const view = toView(s)
      listeners.forEach((fn) => fn(view))
    })
    const view = toView(lastSnap)
    listeners.forEach((fn) => fn(view))
  }

  /** 未开局时展示角色选择 */
  function rosterView(): GameView {
    return {
      month: 0,
      background: PLACEHOLDER_BG,
      narrative:
        '【轮回校园 · 选择你的角色】\n\n' +
        SCRIPT_1.roles
          .map((r) => `· ${r.name}｜表面任务：${r.surfaceTask}`)
          .join('\n') +
        '\n\n选定后，你将带着一种"身份"走进这三年。',
      choices: SCRIPT_1.roles.map((r) => ({ id: `role:${r.id}`, text: r.name })),
      finished: false,
    }
  }

  return {
    getView() {
      if (!engine) return rosterView()
      return toView(lastSnap ?? engine.snapshot())
    },
    choose(choiceId: string) {
      // 角色选择阶段
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
      // 已开局：交给引擎
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