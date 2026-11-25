// 剧本数据层类型（v5）
// 相对 v4.3 的变更：
//   1) 引入「玄幻身份」IdentityDef（本批只有龙烬余孤），身份带身份因子池
//   2) 关系状态简化版 RelationsState（crushId + 列表）
//   3) 随机互动事件 InteractEvent / InteractNode / InteractChoice（本批空池，结构化先就位）
//   4) MonthDef 增加 type: 'school' | 'holiday'
//   5) 删掉旧的冲突顶层结构（conflicts/conflictLinks/...），冲突信息改为因子内嵌
//      ——本批不填世界因子，只留 FactorDef.conflict 字段形状，防止后续再改类型

export interface CustomCondition { type: 'custom'; kind: string; payload?: Record<string, unknown> }
export interface CustomEffect { type: 'custom'; kind: string; payload?: Record<string, unknown> }

// ---------- 条件 ----------
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

// ---------- 效果 ----------
export type Effect =
  | { type: 'affinity'; target: string; value: number }
  | { type: 'unlock'; target: string }
  | { type: 'flag'; target: string }
  | { type: 'goalProgress'; target: string; value: number }
  | { type: 'log'; text: string }
  | { type: 'setTerminate'; groupId: string; value: 0 | 1 }
  | CustomEffect

// ---------- 选项 / 事件 ----------
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

// ---------- 因子（世界因子本批不激活，仅类型保留）----------
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
  /** 因子内嵌的冲突根（方案 A：矛盾并入因子） */
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

/** 因子运行态（目前只保留挂点） */
export interface FactorRuntime {}

// ---------- 身份因子（本批核心）----------
export type IdentityFactorId = 'seal' | 'ancient'   // 封龙 / 古龙

/**
 * 玄幻身份定义。身份是跨轮回固定的「携带物」。
 * 定中求变：选身份后，从 identityFactorPool 里随机抽一个作为本局的身份因子。
 */
export interface IdentityDef {
  id: string
  name: string
  desc: string
  /** 身份生成的身份因子池（本批恒为两项：seal / ancient） */
  identityFactorPool: IdentityFactorId[]
}

// ---------- 关系状态（简化版）----------
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

// ---------- 时间轴 ----------
export type MonthType = 'school' | 'holiday'
export interface MonthDef {
  index: number
  year: number
  month: number
  type: MonthType
  stepCount: number
  /** 事件月的固定事件（如期中/期末）。假期为空 */
  fixedEvent?: string
  randomPool?: string[]
  silentStudy?: boolean
}

// ---------- 随机互动事件（本批结构就位，池子先空）----------
export type InteractKind = 'short' | 'maybeLong' | 'long'

export interface InteractRequires {
  hasCrush?: boolean
  sameClass?: boolean
  identityFactor?: IdentityFactorId
}

export interface InteractChoice {
  text: string
  requires?: InteractRequires
  /**
   * 走向：
   *   - 直接给节点 → 进入该节点
   *   - 给 { byMutual, byOneSide } → 由「双方主动」判定落点
   * 出现 byMutual/byOneSide 即意味着该事件可能「变长」
   */
  next?: InteractNode | { byMutual: InteractNode; byOneSide: InteractNode }
}

export interface InteractNode {
  text: string
  choices?: InteractChoice[]
  /** 概率分支：p 命中走 ifHit，否则 ifMiss */
  chance?: { p: number; ifHit: InteractNode; ifMiss: InteractNode }
}

export interface InteractEvent {
  id: string
  kind: InteractKind
  weight: number
  requires?: InteractRequires
  root: InteractNode
}

// ---------- 剧本 ----------
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