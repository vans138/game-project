import type { GameSource, GameView } from './GameView'

/**
 * 本地单机数据源（MVP）。
 *
 * 本批只做"骨架验证"：一段占位剧情 + 一个选项，点击后回合数 +1，文本变化。
 * 真正的剧情 JSON / 结算 / 三年逻辑在后续批次接入——
 * 届时只需替换本文件内部实现，UI 与 GameSource 接口保持不变。
 */

// 占位背景：用纯色渐变，避免依赖外部图片资源
const PLACEHOLDER_BG =
  'linear-gradient(160deg, #1f2a44 0%, #33507a 50%, #6a8bbf 100%)'

// 占位剧情：按回合数循环取不同文案，验证"文本会变"
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

  function emit() {
    const view = buildView()
    listeners.forEach((fn) => fn(view))
  }

  return {
    getView() {
      return buildView()
    },
    choose(_choiceId: string) {
      // MVP 骨架：任何选择都只推进回合数
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