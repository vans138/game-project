// 剧本数据层类型：结构对齐 JSON，全程可序列化，未来可原样导出为配置文件。
// 设计原则（对接头充足性）：
//   1) 矛盾点是剧本核心"插座"，核心字段最小化，其余全部塞进 data 袋，永不回改接口；
//   2) 节点之间用 id 弱引用连接，不内嵌对象，一对多/多对一都不撕裂；
//   3) 关系走外部关系表（id + kind 字符串 + data 袋），不污染节点本身；
//   4) Condition / Effect 保留 custom 逃生口，新增类型不用改类型定义。
//
// 版本：
//   v2：矛盾=事件源；矛盾→NPC影响（动态、带 require）
//   v3：因子层（开局抽取、局内可变的"因子/布线"）
//        - FactorDef / FactorState / Effect.factorShift / Script.factorPool
//        - 因子大小仅靠 tier（major/minor）表达，不结构化 scope，人工规范影响范围

// ---------- 通用逃生口 ----------

export interface CustomCondition {
  type: 'custom'
  kind: string
  payload?: Record<string, unknown>
}

export interface CustomEffect {
  type: 'custom'
  kind: string
  payload?: Record<string, unknown>
}

// ---------- 条件 ----------

export type Condition =
  | { all: Condition[] }
  | { any: Condition[] }
  | { hasIdentity: string }
  | { affinityAtLeast: [npcId: string, value: number] }
  | { flag: string }
  | { goalProgressAtLeast: [goalId: string, value: number] }
  | { monthAtLeast: number }
  | { factorActive: string }               // 因子处于激活态（v3）
  | { factorIntensityAtLeast: [factorId: string, value: number] } // 因子强度（v3）
  | CustomCondition

// ---------- 效果 ----------

/** 因子变化：局内因子状态的操作单位一律是因子 id */
export type FactorShift =
  | { type: 'factorShift'; mode: 'toggle'; target: string; active: boolean }
  | { type: 'factorShift'; mode: 'intensity'; target: string; delta: number }
  | { type: 'factorShift'; mode: 'transform'; target: string; toFactorId: string }

export type Effect =
  | { type: 'affinity'; target: string; value: number }
  | { type: 'unlock'; target: string }
  | { type: 'flag'; target: string }
  | { type: 'goalProgress'; target: string; value: number }
  | { type: 'log'; text: string }
  | FactorShift
  | CustomEffect

// ---------- 选择 ----------

export interface Choice {
  id: string
  text: string
  require?: Condition
  effects: Effect[]
  /** 链式多步：有则进入下一段事件（写死的强制转移）；缺省则按锚点/池逻辑占步 */
  next?: string | null
}

// ---------- 事件 ----------

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
  /** 事件池内的抽取权重，默认 1（v3：轻事件=池内加权抽取） */
  weight?: number
  choices: Choice[]
  data?: Record<string, unknown>
}

// ---------- 矛盾点 ----------

export type ConflictId = string

export interface Conflict {
  id: ConflictId
  title: string
  parties: string[]
  tags: string[]
  data: Record<string, unknown>
}

export type ConflictLinkKind = string

export interface ConflictLink {
  from: ConflictId
  to: ConflictId
  kind: ConflictLinkKind
  data?: Record<string, unknown>
}

export interface ConflictEventLink {
  conflictId: ConflictId
  eventId: string
  kind: ConflictLinkKind
  season?: Season
  require?: Condition
  data?: Record<string, unknown>
}

export interface ConflictNpcEffect {
  conflictId: ConflictId
  npcId: string
  value: number
  reversible: boolean
  require?: Condition
  data?: Record<string, unknown>
}

// ---------- 线索 ----------

export type ClueId = string

export interface Clue {
  id: ClueId
  conflictId: ConflictId
  text: string
  projectedMonth?: number
  depth: number
  data?: Record<string, unknown>
}

// ---------- 因子 ----------

export type FactorId = string

/** 因子大小：大因子定整局基调，小因子定局部摆动 */
export type FactorTier = 'major' | 'minor'

/**
 * 因子定义（剧本配置）：只定义"存在哪些因子、入池权重、大小"。
 * 影响范围不做结构化表达，由配置者按 tier 人工规范。
 */
export interface FactorDef {
  id: FactorId
  title: string
  tier: FactorTier
  /** 开局抽取权重，默认 1 */
  weight?: number
  data?: Record<string, unknown>
}

/**
 * 因子运行态（局内，可变）。
 * 玩家的行为/选择可以通过 Effect.factorShift 改写它：
 *   toggle    激活/失活
 *   intensity 强度增减（0~N）
 *   transform 转化为另一个因子（本因子失活、目标因子激活）
 */
export interface FactorState {
  id: FactorId
  active: boolean
  intensity: number
  data?: Record<string, unknown>
}

// ---------- 目标 / NPC / 角色 ----------

export interface GoalDef {
  id: string
  title: string
  target: number
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

export interface OutcomeDef {
  id: string
  title: string
  narrative: string
  require?: Condition
  minGoalRatio?: number
}

// ---------- 月份定义 ----------

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

// ---------- 剧本根 ----------

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
  /** 因子池：开局按权抽取，局内可变（v3） */
  factorPool: FactorDef[]
  affinityCap: number
}