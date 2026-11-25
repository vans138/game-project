// GameView：UI 只读快照（v6）

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
  /** 开局选定的"在意的人"（没选则为空串） */
  crushName: string
  isEventMonth: boolean
}

export interface GameSource {
  getView(): GameView
  choose(choiceId: string): GameView
  subscribe(listener: (view: GameView) => void): () => void
}