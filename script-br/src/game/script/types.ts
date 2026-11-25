// 剧本数据层类型（v6）
// Condition 正式支持 identityFactorIs（不需要 as never 临时 cast）

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
  | { identityFactorIs: 'seal' | 'ancient' }
  | CustomCondition

export type Effect =
  | { type: 'affinity'; target: string; value: number }
  | { type: 'unlock'; target: string }
  | { type: 'flag'; target: string }
  | { type: 'goalProgress'; target: string; value: number }
  | { type: 'log'; text: string }
  | { type: 'setTerminate'; groupId: string; value: 0 | 1 }
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
  weight?: number
  choices: Choice[]
  data?: Record<string, unknown>
}

export type FactorId = string
export interface FactorConflict {
  title: string
  parties: string[]
  fog: number
  solvePaths?: string[]
}
export interface FactorDef {
  id: FactorId
  title: string
  conflict?: FactorConflict
  data?: Record<string, unknown>
}

export type FactorMemberSpecial = 'terminate'
export interface FactorGroupMember {
  factorId: FactorId
  chance: number
  special?: FactorMemberSpecial
}
export type FactorGroupSpecial = 'future'
export interface FactorGroup {
  id: string
  special?: FactorGroupSpecial
  members: FactorGroupMember[]
  data?: Record<string, unknown>
}

export interface FactorRuntime {}

export type IdentityFactorId = 'seal' | 'ancient'

export interface IdentityDef {
  id: string
  name: string
  desc: string
  identityFactorPool: IdentityFactorId[]
}

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

export interface GoalDef { id: string; title: string; target: number }

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

export type InteractKind = 'short' | 'maybeLong' | 'long'

export interface InteractRequires {
  hasCrush?: boolean
  sameClass?: boolean
  identityFactor?: IdentityFactorId
}

export interface InteractChoice {
  text: string
  requires?: InteractRequires
  next?: InteractNode | { byMutual: InteractNode; byOneSide: InteractNode }
}

export interface InteractNode {
  text: string
  choices?: InteractChoice[]
  chance?: { p: number; ifHit: InteractNode; ifMiss: InteractNode }
}

export interface InteractEvent {
  id: string
  kind: InteractKind
  weight: number
  requires?: InteractRequires
  root: InteractNode
}

export interface Script {
  id: string
  meta: { title: string; era: string; place: string }
  identities: IdentityDef[]
  roles: Role[]
  npcs: NpcDef[]
  timeline: MonthDef[]
  events: EventDef[]
  goals: GoalDef[]
  outcomes: OutcomeDef[]
  factorPool: FactorDef[]
  factorGroups: FactorGroup[]
  interactEvents: InteractEvent[]
  affinityCap: number
}