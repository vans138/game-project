import type { GameSource, GameView } from './GameView'

const PLACEHOLDER_BG =
  'linear-gradient(160deg, #1f2a44 0%, #33507a 50%, #6a8bbf 100%)'

const NARRATIVES = [
  '开学第一天。你站在校门口，看着陌生的校园，心里清楚——这三年，会不止一次重来。',
  '第一个月过去了。教室里的人渐渐熟悉，但你隐约觉得，有些事并不像表面那样简单。',
  '某天深夜，你在旧教学楼看见一个不该出现的身影。',
  '又一次轮回的痕迹开始显现。这一次，你想走得更远。',
]

function narrativeFor(month: number): string {
  return NARRATIVES[(month - 1) % NARRATIVES.length]
}

export function createLocalSource(): GameSource {
  let month = 1
  const listeners = new Set<(view: GameView) => void>()

  function buildView(): GameView {
    return {
      month,
      background: PLACEHOLDER_BG,
      narrative: narrativeFor(month),
      choices: [
        { id: 'continue', text: '继续' },
        { id: 'observe', text: '先观察四周' },
      ],
    }
  }

  return {
    getView() {
      return buildView()
    },
    choose(_choiceId: string) {
      month += 1
      const view = buildView()
      listeners.forEach((fn) => fn(view))
      return view
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}