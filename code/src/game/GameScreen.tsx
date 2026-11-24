import { useEffect, useRef, useState } from 'react'
import type { GameSource, GameView } from './GameView'
import './styles.css'

/**
 * 局内主界面（UI 层）。
 *
 * 布局（按需求）：
 * - 背景图铺满全屏、自动适应屏幕比例。
 * - 中部：圆形回合数徽标 + 居中排列的小长方形选项。
 * - 底部：全宽文本框，高度按比例，内容溢出可下滑。
 *
 * 只依赖 GameSource 接口，不关心数据来自本地还是联网。
 */
export default function GameScreen({ source }: { source: GameSource }) {
  const [view, setView] = useState<GameView>(() => source.getView())
  const textRef = useRef<HTMLDivElement>(null)

  // 订阅数据源变化（未来联网时服务端推送会走这里）
  useEffect(() => {
    const unsub = source.subscribe(setView)
    return unsub
  }, [source])

  // 每次文本变化，文本框回到顶部，避免残留上一段滚动位置
  useEffect(() => {
    textRef.current?.scrollTo({ top: 0 })
  }, [view.narrative])

  const onChoose = (id: string) => {
    const next = source.choose(id)
    setView(next)
  }

  return (
    <div className="g-root">
      {/* 背景层：铺满全屏 */}
      <div className="g-bg" style={{ background: view.background }} />

      {/* 中部：回合徽标 + 选项 */}
      <div className="g-middle">
        <div className="g-month" aria-label="回合数">
          {view.month}
        </div>

        <div className="g-choices">
          {view.choices.map((c) => (
            <button key={c.id} className="g-choice" onClick={() => onChoose(c.id)}>
              {c.text}
            </button>
          ))}
        </div>
      </div>

      {/* 底部：文本框（全宽、按比例高度、可滚动） */}
      <div className="g-textbox">
        <div className="g-text" ref={textRef}>
          {view.narrative}
        </div>
      </div>
    </div>
  )
}