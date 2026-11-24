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

  useEffect(() => {
    textRef.current?.scrollTo({ top: 0 })
  }, [view.narrative])

  const onChoose = (id: string) => {
    const next = source.choose(id)
    setView(next)
  }

  return (
    <div className="g-root">
      <div className="g-bg" style={{ background: view.background }} />
      <div className="g-middle">
        <div className="g-month" aria-label="回合数">{view.month}</div>
        <div className="g-choices">
          {view.choices.map((c) => (
            <button key={c.id} className="g-choice" onClick={() => onChoose(c.id)}>
              {c.text}
            </button>
          ))}
        </div>
      </div>
      <div className="g-textbox">
        <div className="g-text" ref={textRef}>{view.narrative}</div>
      </div>
    </div>
  )
}