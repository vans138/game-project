// 剧本数据层类型：结构对齐 JSON，全程可序列化，未来可原样导出为配置文件。
// 设计原则（对接头充足性）：
//   1) 矛盾点是剧本核心"插座"，核心字段最小化，其余全部塞进 data 袋，永不回改接口；
//   2) 节点之间用 id 弱引用连接，不内嵌对象，一对多/多对一都不撕裂；
//   3) 关系走外部 conflictLinks（id + kind 字符串），不污染节点本身；
//   4) Condition / Effect 保留 custom 逃生口，新增类型不用改类型定义。

// ---------- 通用逃生口 ----------

/** 条件自定义逃生口：未来新条件类型走这里，不改 Condition 联合类型 */
export interface CustomCondition {
  type: 'custom'
  /** 具体子类型标识，供求值器分发 */
  kind: string
  /** 任意负载 */
  payload?: Record<string, unknown>
}

/** 效果自定义逃生口：未来新效果类型走这里，不改 Effect 联合类型 */
export interface CustomEffect {
  type: 'custom'
  kind: string
  payload?: Record<string, unknown>
}

// ---------- 条件与效果 ----------

export type Condition =
  | { all: Condition[] }
  | { any: Condition[] }
  | { hasIdentity: string }
  | { affinityAtLeast: [npcId: string, value: number] }
  | { flag: string }
  | { goalProgressAtLeast: [goalId: string, value: number] }
  | { monthAtLeast: number }
  | CustomCondition

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
  /**
   * 链式多步：指向下一段事件的 id。
   * 有 next 则本次选择不结束当月，而是进入下一段（配合"月内多步"）。
   * 为 null/缺省则按当月步数逻辑收尾。
   */
  next?: string | null
}

// ---------- 事件 ----------

export type EventKind = 'fixed' | 'random' | 'samebox' | 'study' | 'clue' | 'investigate'

/** 事件所属时段：上学 / 假期 / 皆可 */
export type Season = 'school' | 'holiday' | 'both'

export interface EventDef {
  id: string
  kind: EventKind
  /** 时段归属，引擎按当前月 type 分流随机池 */
  season: Season
  title: string
  narrative: string
  /** 同框事件：需要哪些位置的人同时在场才触发（MVP 用位置标签交集判断） */
  sameboxPlace?: string
  /** 若本事件由某条线索派生，则指向线索 id（弱引用） */
  fromClue?: string
  /** 若本事件服务于某条矛盾，则指向矛盾 id（弱引用，便于结局按矛盾汇总） */
  fromConflict?: string
  choices: Choice[]
  /** 事件自定义袋：触发器细节、证词文本、同框扩展等，统一走这里 */
  data?: Record<string, unknown>
}

// ---------- 矛盾点（剧本核心插座） ----------
//
// 核心字段务必最小、最稳。诉求 / 可非伤害解决途径 / 张力 / 迷雾 等语义
// 一律放进 data 袋或外部 conflictLinks，不进结构，避免改接口。

export type ConflictId = string

export interface Conflict {
  id: ConflictId
  /** 人类可读名，如 "父母不合" */
  title: string
  /** 这条矛盾卷进了谁：NPC id / 势力 id / 身份标签，字符串数组 */
  parties: string[]
  /** 机器筛选标签：如 family / campus / vampire，用于按身份加权投影线索 */
  tags: string[]
  /** 其余一切（诉求、解决方式、张力、迷雾、证词、时间锁……）都放这里 */
  data: Record<string, unknown>
}

/** 矛盾关系类型（字符串，方便未来扩展新边） */
export type ConflictLinkKind = string

/** 矛盾关系边：互斥 / 依赖 / 争稀缺物 / 证词分歧 …… 全部走这里 */
export interface ConflictLink {
  from: ConflictId
  to: ConflictId
  kind: ConflictLinkKind
  data?: Record<string, unknown>
}

// ---------- 线索（矛盾点的投影） ----------
//
// 线索不是源头，是矛盾点被投射出来的碎片。
// 上学月投影 → 假期月可顺着线索调查，往矛盾本体收。

export type ClueId = string

export interface Clue {
  id: ClueId
  /** 指向源头矛盾（弱引用） */
  conflictId: ConflictId
  /** 一句话线索文本，如 "父母有些许不合" */
  text: string
  /** 投影到哪个月（由引擎写入，剧本可为空表示运行时随机） */
  projectedMonth?: number
  /** 线索信息深度：0=只有一句话，越大可深挖空间越多（数值语义在 data 内约定） */
  depth: number
  data?: Record<string, unknown>
}

// ---------- 目标 / NPC / 角色（沿用上一版） ----------

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
  /** 常处位置标签，供同框事件判定 */
  place: string
  /** 关系标签（友/尊/谜/敌等），便于结局与关系线归类 */
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

// ---------- 月份定义（时间片） ----------

/** 月份类型：上学月 / 假期月 */
export type MonthType = 'school' | 'holiday'

export interface MonthDef {
  /** 全局回合序号（从 1 起） */
  index: number
  year: number
  /** 实际月份 1-12 */
  month: number
  /** 上学 / 假期（决定随机池与月内步数） */
  type: MonthType
  /** 月内固定步数（上学月先定，假期月按线索动态可覆盖） */
  stepCount: number
  /** 固定锚点事件（如开学、期中、学年末） */
  fixedEvent?: string
  /** 随机事件池（引擎按 type 过滤 season 后再抽） */
  randomPool?: string[]
  /** 是否静默结算学习收益 */
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
  /** 矛盾点：剧本核心插座 */
  conflicts: Conflict[]
  /** 矛盾关系边 */
  conflictLinks: ConflictLink[]
  /** 好感总封顶（跨 NPC 分配上限） */
  affinityCap: number
}