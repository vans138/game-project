// UI：背景 + 月/阶段 + 选项 + 下方文本框 + 右上身份/好感面板
// v5：去掉线索/因子按钮（本批不激活世界因子）；增加"阶段提示"与"身份名"显示。
//    选项区与旧版一致，靠 GameView.choices 渲染，不关心阶段语义。

import { useEffect, useRef, useState } from 'react'
import type { GameSource, GameView } from './GameView'
import './styles.css'

export default function GameScreen({ source }: { source: GameSource }) {
  const [view, setView] = useState<GameView>(() => source.getView())
  const [showPanel, setShowPanel] = useState(false)
  const textRef = useRef<HTMLDivElement>(null)

  useEffect(() => source.subscribe(setView), [source])
  useEffect(() => { textRef.current?.scrollTo({ top: 0 }) }, [view.narrative])

  const onChoose = (id: string) => setView(source.choose(id))
  const showAdvance = view.choices.length === 0 && !view.finished

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
          <div className="g-panel-head">好感 {view.affinityTotal}/{view.affinityCap}</div>
          {view.affinity.length === 0 && <div className="g-panel-empty">暂无</div>}
          {view.affinity.map((a) => (
            <div key={a.name} className="g-panel-row">
              <span>{a.name}</span><span>{a.value}</span>
            </div>
          ))}
        </div>
      )}

      <div className="g-middle">
        {view.month > 0 && (
          <div className="g-month" aria-label="回合数">{view.month}</div>
        )}

        {view.phaseHint && view.month > 0 && (
          <div className="g-phase">{view.phaseHint}{view.isEventMonth ? ' · 事件月' : ''}</div>
        )}

        {view.finished && (
          <div className="g-outcome">
            <div className="g-outcome-title">{view.outcomeTitle ?? '结局'}</div>
          </div>
        )}

        <div className="g-choices">
          {view.choices.map((c) => (
            <button key={c.id} className="g-choice" onClick={() => onChoose(c.id)}>{c.text}</button>
          ))}
          {showAdvance && (
            <button className="g-choice" onClick={() => onChoose('__advance__')}>推进</button>
          )}
        </div>
      </div>

      <div className="g-textbox">
        <div className="g-text" ref={textRef}>{view.narrative}</div>
      </div>
    </div>
  )
}