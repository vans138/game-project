// UI：背景 + 月/阶段 + 选项 + 下方文本框 + 右上关系面板（含战力、线索）

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
          {showPanel ? '收起' : '状态'}
        </button>
      )}
      {showPanel && (
        <div className="g-panel">
          <div className="g-panel-head">战力 {view.playerPower}</div>
          <div className="g-panel-head">好感 {view.affinityTotal}/{view.affinityCap}</div>
          {view.affinity.length === 0 && <div className="g-panel-empty">暂无</div>}
          {view.affinity.map((a) => (
            <div key={a.name} className="g-panel-row">
              <span>{a.name}</span><span>{a.value}</span>
            </div>
          ))}
          {view.clues.length > 0 && (
            <>
              <div className="g-panel-head" style={{ marginTop: 8 }}>线索</div>
              {view.clues.map((c) => (
                <div key={c.id} className="g-panel-row">
                  <span>{c.title}</span>
                  <span>{c.done ? '已查清' : `${c.stage}/${c.total}`}</span>
                </div>
              ))}
            </>
          )}
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