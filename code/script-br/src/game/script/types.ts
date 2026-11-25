// 剧本数据层类型：结构对齐 JSON，全程可序列化，未来可原样导出为配置文件。
// 设计原则（对接头充足性）：
//   1) 矛盾点是剧本核心"插座"，核心字段最小化，其余塞进 data 袋；
//   2) 节点之间用 id 弱引用连接；
//   3) 关系走外部关系表（id + kind + data 袋）；
//   4) Condition / Effect 保留 custom 逃生口。
//
// 版本：
//   v2：矛盾=事件源；矛盾→NPC影响（动态、带 require）
//   v3：因子层（开局抽取、局内演化）
//   v4（本版）：因子层收敛为「互斥组」模型
//        - FactorDef 只保留身份信息（id/title/data），无 tier / 无 children
//        - FactorGroup：一组成员（factorId + chance），chance 之和 ≤ 1；剩余=「都不选」
//        - FactorGroup.special：'future' 标记「因子未来」特殊组
//        - 因子未来组的 id 约定为 "<原因子id>::future"（ASCII 分隔，便于机器识别）
//        - 运行态用 Set<FactorId>，不再有 FactorState / intensity / transform
//        - 组与组之间不结构化（谁触发谁由配置层人工约定）
//        - factorShift / factorIntensityAtLeast 全部删除；Condition 只留 factorActive

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
  | { factorActive: string }   // 因子是否在已激活集合内
  | CustomCondition

// ---------- 效果 ----------

export type Effect =
  | { type: 'affinity'; target: string; value: number }
  | { type: 'unlock'; target: string }
  | { type: 'flag'; target: string }
  | { type: 'goalProgress'; target: string; value: number }
  | { type: 'log'; text: string }
  | CustomEffect

// ---------- 选择 ----------

export interface Choice {
  id: string
  text: string
  require?: Condition
  effects: Effect[]
  /** 强制转移：有则进入下一段事件；缺省则按锚点/池逻辑占步 */
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
  /** 事件池抽取权重，默认 1 */
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

// ---------- 因子（互斥组模型） ----------

export type FactorId = string

/** 因子定义：只有身份信息；不含任何"大小/层级/概率"语义 */
export interface FactorDef {
  id: FactorId
  title: string
  data?: Record<string, unknown>
}

/** 组内成员：factorId + 自带概率 */
export interface FactorGroupMember {
  factorId: FactorId
  /** 落在 [0,1]；同组内 chance 之和建议 ≤ 1，剩余概率代表「都不选」 */
  chance: number
}

/** 特殊组类型：目前只定义 future；将来可扩展其它特殊组（如 forced / scripted） */
export type FactorGroupSpecial = 'future'

/**
 * 因子互斥组：一次演化 = 在本组内按概率独立互斥选取（或者一个都不选）。
 *   - 普通组：概率抽取；都不选合法。
 *   - 特殊组 special='future'（因子未来）：
 *       * 一定触发（必然命中组内某成员）
 *       * 视为该因子本轮"最后一次触发"
 *       * 触发后原因子从已激活集合中移除（off）
 *       * 组 id 约定：`<原因子id>::future`
 * 组与组之间的关系不结构化（由配置层人工约定触发顺序/条件）。
 */
export interface FactorGroup {
  id: string
  /** 特殊组标记；普通组可不填 */
  special?: FactorGroupSpecial
  members: FactorGroupMember[]
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
  /** 因子池：开局按权抽取初始化；因子为互斥组模型 */
  factorPool: FactorDef[]
  /** 因子互斥组：演化按组进行 */
  factorGroups: FactorGroup[]
  affinityCap: number
}