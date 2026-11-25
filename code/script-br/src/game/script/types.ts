// 剧本数据层类型（v4.3）：
//   - Clue 增加 factorId（线索由哪个因子投影）
//   - FactorGroupMember 增加 special?: 'terminate'
//   - 终结成员规则：chance 只允许 0 或 1；为 1 时硬压制其它成员，必然命中终结
//   - Effect 增加 setTerminate（把某终结成员概率设为 0/1）
//   - 运行态：Map<FactorId, FactorRuntime>，FactorRuntime 目前只有 termination 字段位
//     注意：termination 实际由"未来组终结成员 chance 是否为 1"决定，运行态不必再存布尔；
//     这里保留 FactorRuntime 作为挂点，但本版本不使用。见 factorEvolve.ts 注释。

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
  // 把某"终结成员"概率设为指定值（0 或 1）
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
  /** 该线索由哪个因子投影出来（投影门控依据） */
  factorId: string
  conflictId: ConflictId
  text: string
  projectedMonth?: number
  depth: number
  data?: Record<string, unknown>
}

export type FactorId = string
export interface FactorDef { id: FactorId; title: string; data?: Record<string, unknown> }

export type FactorMemberSpecial = 'terminate'
export interface FactorGroupMember {
  factorId: FactorId
  chance: number
  /** 终结成员：chance 只允许 0/1；为 1 时硬压制其它成员 */
  special?: FactorMemberSpecial
}

export type FactorGroupSpecial = 'future'
export interface FactorGroup {
  id: string
  special?: FactorGroupSpecial
  members: FactorGroupMember[]
  data?: Record<string, unknown>
}

/** 因子运行态：目前不使用额外字段；保留扩展点 */
export interface FactorRuntime {
  // 预留
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
  clues: Clue[]
  affinityCap: number
}