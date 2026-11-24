// 剧本数据层类型。结构对齐 JSON，可序列化，未来原样导出 JSON。
// 本轮新增：NPC 的位置/关系标签、玩家好感总封顶常量，为"同框判定""好感总封顶"预留字段。

export type Condition =
  | { all: Condition[] }
  | { any: Condition[] }
  | { hasIdentity: string }
  | { affinityAtLeast: [npcId: string, value: number] }
  | { flag: string }
  | { goalProgressAtLeast: [goalId: string, value: number] }
  | { monthAtLeast: number }

export type Effect =
  | { type: 'affinity'; target: string; value: number }
  | { type: 'unlock'; target: string }
  | { type: 'flag'; target: string }
  | { type: 'goalProgress'; target: string; value: number }
  | { type: 'log'; text: string }

export interface Choice {
  id: string
  text: string
  require?: Condition
  effects: Effect[]
}

export type EventKind = 'fixed' | 'random' | 'samebox' | 'study'

/** 参与同框判定时 NPC 的常态位置标签（如 '教学楼' '图书馆'） */
export type PlaceTag = string

export interface EventDef {
  id: string
  kind: EventKind
  title: string
  narrative: string
  /** 同框事件：需要哪些位置的人同时在场才触发（MVP 用位置标签交集判断） */
  sameboxPlace?: PlaceTag
  choices: Choice[]
}

export interface GoalDef {
  id: string
  title: string
  target: number
}

export interface MonthDef {
  index: number
  year: number
  month: number
  fixedEvent?: string
  randomPool?: string[]
  silentStudy?: boolean
}

export interface NpcDef {
  id: string
  name: string
  type: 'resident' | 'random'
  personality: string
  affinityStart: number
  persistAcrossRuns: boolean
  /** 常处位置标签，供同框事件判定；随机 NPC 也先给默认位置 */
  place: PlaceTag
  /** 关系标签，便于结局与关系线归类（友/尊/谜/敌等） */
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

export interface Script {
  id: string
  meta: { title: string; era: string; place: string }
  roles: Role[]
  npcs: NpcDef[]
  timeline: MonthDef[]
  events: EventDef[]
  goals: GoalDef[]
  outcomes: OutcomeDef[]
  /** 好感总封顶（跨 NPC 分配上限） */
  affinityCap: number
}