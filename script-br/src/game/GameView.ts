// GameView：UI 只读快照。新增好感面板字段。

export interface GameChoice {
  id: string
  text: string
}

export interface AffinityItem {
  name: string
  value: number
}

export interface GameView {
  month: number
  background: string
  narrative: string
  choices: GameChoice[]
  finished: boolean
  outcomeTitle?: string
  outcomeNarrative?: string
  /** 好感面板（已按值降序，0 值过滤） */
  affinity: AffinityItem[]
  /** 好感总投入（正向和） */
  affinityTotal: number
  /** 好感总封顶 */
  affinityCap: number
}

export interface GameSource {
  getView(): GameView
  choose(choiceId: string): GameView
  subscribe(listener: (view: GameView) => void): () => void
}