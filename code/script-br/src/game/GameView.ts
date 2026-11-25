// GameView：UI 只读快照（v5）
// 变更：
//   - 增加 phase / phaseHint / identityName / isEventMonth / monthType
//   - 不再包含 clues / activeFactors（本批不激活世界因子与线索）；后续需要再补回

export interface GameChoice {
  id: string
  text: string
}

export interface AffinityItem {
  name: string
  value: number
}

export type GamePhase =
  | 'intro'
  | 'mainChoice'
  | 'feedback'
  | 'smallEvent'
  | 'fixedEvent'
  | 'interact1'
  | 'interact2'
  | 'summary'
  | 'holidaySkip'
  | 'done'

export interface GameView {
  month: number
  year: number
  monthOfYear: number
  monthType: 'school' | 'holiday'
  phase: GamePhase
  phaseHint: string
  background: string
  narrative: string
  choices: GameChoice[]
  finished: boolean
  outcomeTitle?: string
  outcomeNarrative?: string
  affinity: AffinityItem[]
  affinityTotal: number
  affinityCap: number
  identityName: string
  isEventMonth: boolean
}

export interface GameSource {
  getView(): GameView
  choose(choiceId: string): GameView
  subscribe(listener: (view: GameView) => void): () => void
}