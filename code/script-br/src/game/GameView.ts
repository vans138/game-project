// GameView：UI 只读快照。
// v4.3：新增 clues（本局投影出的线索，带调查深度）。

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

export interface ClueItem {
  clueId: string
  text: string
  conflictTitle: string
  remaining: number
  totalDepth: number
}

export interface GameView {
  month: number
  background: string
  narrative: string
  choices: GameChoice[]
  finished: boolean
  outcomeTitle?: string
  outcomeNarrative?: string
  affinity: AffinityItem[]
  affinityTotal: number
  affinityCap: number
  activeFactors: ActiveFactorItem[]
  clues: ClueItem[]
}

export interface GameSource {
  getView(): GameView
  choose(choiceId: string): GameView
  subscribe(listener: (view: GameView) => void): () => void
}