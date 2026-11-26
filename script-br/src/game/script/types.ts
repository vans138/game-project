// 剧本数据层类型（v8）
// 相对 v7 变更：
//   1) 事件双维度：tier（难度 common/rare/critical）+ valence（倾向权重表，可同时有利不利）
//   2) 选项结果概率：Choice.outcomes（按权重抽一套 effects 执行），effects 保留为单套 100%
//   3) 结果概率也受状态调制（把 outcomes 权重乘修饰器）
//   4) 线索改名后无结构变化；湖面事件结束时给后天因子「唤龙」+ 战力提升，通过 effects 落地
//   5) 新增后天因子（acquiredFactors）相关类型
//   6) 新增龙迫（dragonCoerce）状态：目标本月行动失效 + 状态修饰

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
  | { type: 'gainClue'; clueId: string }
  // v8 新增：战力提升、后天因子获得
  | { type: 'powerDelta'; value: number }
  | { type: 'acquireFactor'; factorId: string }
  | CustomEffect

export interface Choice {
  id: string
  text: string
  require?: Condition
  /** 固定效果（若 outcomes 为空，则用这个，等价于一条 100% 结果） */
  effects?: Effect[]
  /** v8：概率结果表；按权重抽一套执行。若提供，则忽略 effects */
  outcomes?: ChoiceOutcome[]
  next?: string | null
}

export interface ChoiceOutcome {
  weight: number
  effects: Effect[]
  /** 可选：这条结果触发后额外写的一行日志（用于区分结果） */
  note?: string
}

// ---------- 事件双维度 ----------
export type EventTier = 'common' | 'rare' | 'critical'
export interface Valence {
  favorable?: number    // 有利权重
  unfavorable?: number  // 不利权重
  neutral?: number      // 中立权重
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
  /** v8：难度 */
  tier: EventTier
  /** v8：倾向权重 */
  valence: Valence
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
  basePower: number
  /**
   * 该身份下，单个 NPC 对玩家的好感上限。
   * 省略则用 Script.affinityCap（默认 100）；"龙"只有 80——没人能和一条龙真正亲近。
   */
  npcAffinityCap?: number
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
  gainClue?: string
}

export interface InteractEvent {
  id: string
  kind: InteractKind
  weight: number
  requires?: InteractRequires
  root: InteractNode
  onceGuaranteed?: boolean
  priority?: number
  /** v8：难度 */
  tier: EventTier
  /** v8：倾向权重 */
  valence: Valence
}

// ---------- 线索 ----------
export interface ClueStageDef {
  title: string
  text: string
}

export interface ClueDef {
  id: string
  title: string
  fromEventId?: string
  stages: ClueStageDef[]
}

// ---------- 伤害 ----------
export type DamageTier = 'none' | 'light' | 'heavy' | 'death'

// ---------- 后天因子 ----------
// 后天因子 = 不是开局定的身份因子，而是通过各种事件获得的"能力/状态"
export interface AcquiredFactorDef {
  id: string
  name: string
  desc: string
  /** 若为 true，则玩家拥有后，在危急事件里自动多一个选项（由引擎处理） */
  grantsCriticalOption?: string  // 例如 '唤龙'
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
  clues: ClueDef[]
  /** v8：后天因子池 */
  acquiredFactors: AcquiredFactorDef[]
  /** 默认"单人好感上限"（身份可用 npcAffinityCap 覆盖；没有全局总封顶） */
  affinityCap: number
}