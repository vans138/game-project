// UI：背景 + 月数 + 选项 + 下方文本框；右上角关系面板；左上角世界因子面板。
// v4.2：移除"推进到下一月"按钮（引擎自动推进；空步由引擎给"（继续）"伪选项）。

import { useEffect, useRef, useState } from 'react'
import type { GameSource, GameView } from './GameView'
import './styles.css'

export default function GameScreen({ source }: { source: GameSource }) {
  const [view, setView] = useState<GameView>(() => source.getView())
  const [showPanel, setShowPanel] = useState(false)
  const [showFactors, setShowFactors] = useState(false)
  const textRef = useRef<HTMLDivElement>(null)

  useEffect(() => source.subscribe(setView), [source])
  useEffect(() => { textRef.current?.scrollTo({ top: 0 }) }, [view.narrative])

  const onChoose = (id: string) => setView(source.choose(id))

  return (
    <div className="g-root">
      <div className="g-bg" style={{ background: view.background }} />

      {view.month > 0 && (
        <button className="g-panel-toggle" onClick={() => setShowPanel((v) => !v)}>
          {showPanel ? '收起' : '关系'}
        </button>
      )}
      {showPanel && (
        <div className="g-panel">
          <div className="g-panel-head">
            好感 {view.affinityTotal}/{view.affinityCap}
          </div>
          {view.affinity.length === 0 && <div className="g-panel-empty">暂无</div>}
          {view.affinity.map((a) => (
            <div key={a.name} className="g-panel-row">
              <span>{a.name}</span><span>{a.value}</span>
            </div>
          ))}
        </div>
      )}

      {view.activeFactors.length > 0 && (
        <>
          <button className="g-factors-toggle" onClick={() => setShowFactors((v) => !v)}>
            {showFactors ? '因子 ×' : `因子 ${view.activeFactors.length}`}
          </button>
          {showFactors && (
            <div className="g-factors">
              {view.activeFactors.map((f) => (
                <div key={f.id} className="g-factors-row">{f.title}</div>
              ))}
            </div>
          )}
        </>
      )}

      <div className="g-middle">
        {view.month > 0 && <div className="g-month" aria-label="回合数">{view.month}</div>}

        {view.finished && (
          <div className="g-outcome">
            <div className="g-outcome-title">{view.outcomeTitle ?? '结局'}</div>
          </div>
        )}

        <div className="g-choices">
          {view.choices.map((c) => (
            <button key={c.id} className="g-choice" onClick={() => onChoose(c.id)}>{c.text}</button>
          ))}
        </div>
      </div>

      <div className="g-textbox">
        <div className="g-text" ref={textRef}>{view.narrative}</div>
      </div>
    </div>
  )
}