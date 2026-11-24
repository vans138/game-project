// GameView 扩展：加入"是否结束 + 结局标题/正文"，并明确无选项时的推进语义。
// 保持纯数据，UI 只读不改，未来联网版产出相同结构。

export interface GameChoice {
  id: string
  text: string
}

export interface GameView {
  /** 当前全局月份（1-based）；0 表示还处在"开局/选角"阶段 */
  month: number
  background: string
  narrative: string
  choices: GameChoice[]
  /** 是否已到三年结束 */
  finished: boolean
  /** 结局标题（finished 时有值） */
  outcomeTitle?: string
  /** 结局正文（finished 时有值） */
  outcomeNarrative?: string
}

export interface GameSource {
  getView(): GameView
  choose(choiceId: string): GameView
  subscribe(listener: (view: GameView) => void): () => void
}