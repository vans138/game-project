// GameView：UI 只读快照。
// v4：新增 activeFactors（本局世界因子展示，玩家可见"布线"）。

export interface GameChoice {
  id: string
  text: string
}

export interface AffinityItem {
  name: string
  value: number
}

export interface ActiveFactorItem {
  id: string
  title: string
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
  affinityTotal: number
  affinityCap: number
  /** 世界因子（本局激活布线） */
  activeFactors: ActiveFactorItem[]
}

export interface GameSource {
  getView(): GameView
  choose(choiceId: string): GameView
  subscribe(listener: (view: GameView) => void): () => void
}