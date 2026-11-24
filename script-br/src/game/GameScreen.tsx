// UI 层：只依赖 GameView + GameSource。加入"无选项"时的推进按钮与结局展示。
import { useEffect, useRef, useState } from 'react'
import type { GameSource, GameView } from './GameView'
import './styles.css'

export default function GameScreen({ source }: { source: GameSource }) {
  const [view, setView] = useState<GameView>(() => source.getView())
  const textRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const unsub = source.subscribe(setView)
    return unsub
  }, [source])

  // 每次叙述变化，文本框回到顶部
  useEffect(() => {
    textRef.current?.scrollTo({ top: 0 })
  }, [view.narrative])

  const onChoose = (id: string) => {
    const next = source.choose(id)
    setView(next)
  }

  // 无选项时显示一个"推进"按钮：用于无事件的静默月、以及结局后的重置提示
  const showAdvance = view.choices.length === 0 && !view.finished

  return (
    <div className="g-root">
      <div className="g-bg" style={{ background: view.background }} />

      <div className="g-middle">
        {view.month > 0 && (
          <div className="g-month" aria-label="回合数">{view.month}</div>
        )}

        {view.finished && (
          <div className="g-outcome">
            <div className="g-outcome-title">{view.outcomeTitle ?? '结局'}</div>
          </div>
        )}

        <div className="g-choices">
          {view.choices.map((c) => (
            <button key={c.id} className="g-choice" onClick={() => onChoose(c.id)}>
              {c.text}
            </button>
          ))}
          {showAdvance && (
            <button className="g-choice" onClick={() => onChoose('__advance__')}>
              推进到下一月
            </button>
          )}
        </div>
      </div>

      <div className="g-textbox">
        <div className="g-text" ref={textRef}>{view.narrative}</div>
      </div>
    </div>
  )
}