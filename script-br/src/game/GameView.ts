// GameView：UI 只读快照（v6：接线索 + 战力）

export interface GameChoice {
  id: string
  text: string
}

export interface AffinityItem {
  name: string
  value: number
  /** 已故：不再能拉关系/被龙迫，也不占好感额度 */
  dead?: boolean
}

export interface ClueItem {
  id: string
  title: string
  stage: number
  total: number
  done: boolean
}

export type GamePhase =
  | 'worldEvent'
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
  /** v6：线索列表（仅已获得） */
  clues: ClueItem[]
  /** v6：玩家战力 */
  playerPower: number
  /** v11：本月世界事件 id（null/未定义 = 本月没抽到世界事件） */
  worldEventId?: string | null
}

export interface GameSource {
  getView(): GameView
  choose(choiceId: string): GameView
  subscribe(listener: (view: GameView) => void): () => void
}