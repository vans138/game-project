// 剧本数据层类型（v4.2）：在 v4 基础上补 Script.clues（矛盾投影出的线索池）。
// 说明：仅新增 clues 字段，其余结构与 v4 一致。

export interface CustomCondition { type: 'custom'; kind: string; payload?: Record<string, unknown> }
export interface CustomEffect { type: 'custom'; kind: string; payload?: Record<string, unknown> }

export type Condition =
  | { all: Condition[] }
  | { any: Condition[] }
  | { hasIdentity: string }
  | { affinityAtLeast: [npcId: string, value: number] }
  | { flag: string }
  | { goalProgressAtLeast: [goalId: string, value: number] }
  | { monthAtLeast: number }
  | { factorActive: string }
  | CustomCondition

export type Effect =
  | { type: 'affinity'; target: string; value: number }
  | { type: 'unlock'; target: string }
  | { type: 'flag'; target: string }
  | { type: 'goalProgress'; target: string; value: number }
  | { type: 'log'; text: string }
  | CustomEffect

export interface Choice {
  id: string
  text: string
  require?: Condition
  effects: Effect[]
  next?: string | null
}

export type EventKind = 'fixed' | 'random' | 'samebox' | 'study' | 'clue' | 'investigate'
export type Season = 'school' | 'holiday' | 'both'

export interface EventDef {
  id: string
  kind: EventKind
  season: Season
  title: string
  narrative: string
  sameboxPlace?: string
  fromClue?: string
  fromConflict?: string
  weight?: number
  choices: Choice[]
  data?: Record<string, unknown>
}

export type ConflictId = string
export interface Conflict {
  id: ConflictId
  title: string
  parties: string[]
  tags: string[]
  data: Record<string, unknown>
}
export type ConflictLinkKind = string
export interface ConflictLink { from: ConflictId; to: ConflictId; kind: ConflictLinkKind; data?: Record<string, unknown> }
export interface ConflictEventLink {
  conflictId: ConflictId; eventId: string; kind: ConflictLinkKind; season?: Season; require?: Condition; data?: Record<string, unknown>
}
export interface ConflictNpcEffect {
  conflictId: ConflictId; npcId: string; value: number; reversible: boolean; require?: Condition; data?: Record<string, unknown>
}

export type ClueId = string
export interface Clue {
  id: ClueId
  conflictId: ConflictId
  text: string
  projectedMonth?: number
  depth: number
  data?: Record<string, unknown>
}

export type FactorId = string
export interface FactorDef { id: FactorId; title: string; data?: Record<string, unknown> }
export interface FactorGroupMember { factorId: FactorId; chance: number }
export type FactorGroupSpecial = 'future'
export interface FactorGroup {
  id: string
  special?: FactorGroupSpecial
  members: FactorGroupMember[]
  data?: Record<string, unknown>
}

export interface GoalDef { id: string; title: string; target: number }
export interface NpcDef {
  id: string
  name: string
  type: 'resident' | 'random'
  personality: string
  affinityStart: number
  persistAcrossRuns: boolean
  place: string
  relation: string
}
export interface Role {
  id: string
  name: string
  surfaceTask: string
  privateGoalId: string
  identityTags: string[]
}
export interface OutcomeDef {
  id: string
  title: string
  narrative: string
  require?: Condition
  minGoalRatio?: number
}

export type MonthType = 'school' | 'holiday'
export interface MonthDef {
  index: number
  year: number
  month: number
  type: MonthType
  stepCount: number
  fixedEvent?: string
  randomPool?: string[]
  silentStudy?: boolean
}

export interface Script {
  id: string
  meta: { title: string; era: string; place: string }
  roles: Role[]
  npcs: NpcDef[]
  timeline: MonthDef[]
  events: EventDef[]
  goals: GoalDef[]
  outcomes: OutcomeDef[]
  conflicts: Conflict[]
  conflictLinks: ConflictLink[]
  conflictEventLinks: ConflictEventLink[]
  conflictNpcEffects: ConflictNpcEffect[]
  factorPool: FactorDef[]
  factorGroups: FactorGroup[]
  /** 线索池：矛盾的投影来源（v4.2 新增） */
  clues: Clue[]
  affinityCap: number
}