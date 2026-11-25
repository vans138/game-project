// 剧本数据层类型（v7）
// 相对 v6：
//   1) NpcDef 增加 power（战力）
//   2) InteractEvent 增加 onceGuaranteed / priority（必遇一次性高优先级事件）
//   3) 新增 ClueDef / ClueStageDef（线索定义，支持多阶段调查）
//   4) 新增 DamageTier 类型（伤害结果档位）

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
  // v7 新增：留下一条线索（线索 id）
  | { type: 'gainClue'; clueId: string }
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
  /** v7：基础战力（玩家的初始战力基数，来自身份） */
  basePower: number
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
  /** v7：NPC 战力（写死，后续可调） */
  power: number
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

// ---------- 随机互动事件 ----------
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
  // v7：节点结束时留下的线索（多个对应多种分支）
  gainClue?: string
}

export interface InteractEvent {
  id: string
  kind: InteractKind
  weight: number
  requires?: InteractRequires
  root: InteractNode
  /**
   * v7：必遇一次性事件。
   * - onceGuaranteed=true：只要条件满足，第一次进入随机抽取必定命中；
   * - 触发一次后本局不再出现；
   * - 若同一月有多个必遇事件，按 priority 降序，先抽到高优先级。
   */
  onceGuaranteed?: boolean
  priority?: number
}

// ---------- 线索 ----------
export interface ClueStageDef {
  /** 阶段标题（如：第一印象） */
  title: string
  /** 本阶段揭示文本 */
  text: string
}

export interface ClueDef {
  id: string
  /** 线索标题（如：失控？） */
  title: string
  /** 来源事件 id（用于展示"线索来源"，不参与逻辑） */
  fromEventId?: string
  /** 多阶段线索；数组长度=可调查次数 */
  stages: ClueStageDef[]
}

// ---------- 伤害 ----------
export type DamageTier = 'none' | 'light' | 'heavy' | 'death'

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
  clues: ClueDef[]
  affinityCap: number
}