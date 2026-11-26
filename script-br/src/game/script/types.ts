// 剧本数据层类型（v9）
//
// ===== 核心设计公理：A / V 模型（详见 docs/state_model.md）=====
//
//   状态 A（因子集合）——三类，按「获得途径」划分：
//     · 身份因子 IdentityFactor：只能由开局选的身份获得（如 龙烬余孤 → seal / ancient）
//     · 事件因子 EventFactor  ：只能靠达成某些事件获得（如 唤龙）
//     · 信息因子 InfoFactor   ：随时变化的状态，是事件判定的输入（月、好感、战力、flag、目标进度）
//
//   动作 V（= 事件发生的机会，共三个发生点）：
//     · V1 主选项后的随机互动机会① / ② → 在【随机互动池 A】interactEvents 里抽
//     · V2 主选项执行完后的小事件     → 在【小事件池 B】smallEvents 里抽（可能抽空）
//     · V3 每月开始                   → 在【世界事件池 C】worldEvents 里抽（可能抽空）
//
//   结果：事件发生 / 改变 / 结束 + 获得事件因子 + 改变信息因子
//
//   因子（A）可以调制三池里每个事件的概率：
//     · 可以改「难度档位分布」（common/rare/critical 的权重）
//     · 也可以改「同一档内某个具体事件的权重」

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
  | { identityFactorIs: 'seal' | 'ancient' }
  | CustomCondition

export type Effect =
  | { type: 'affinity'; target: string; value: number }
  | { type: 'unlock'; target: string }
  | { type: 'flag'; target: string }
  | { type: 'goalProgress'; target: string; value: number }
  | { type: 'log'; text: string }
  | { type: 'gainClue'; clueId: string }
  // v8：战力提升、事件因子获得
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

// ---------- 随机互动事件（池 A） ----------
export type InteractKind = 'short' | 'maybeLong' | 'long'

export interface InteractRequires {
  hasCrush?: boolean
  sameClass?: boolean
  identityFactor?: IdentityFactorId
}

/**
 * 因子对概率的调制。
 * 两个层级可分别调：
 *   · tierWeights  —— 改「难度档位分布」的权重（common/rare/critical）
 *   · weightDelta  —— 改「同一档内这个事件本身」的权重（正负都可）
 * 条件不满足时整条 modifier 不生效。
 */
export interface WeightModifier {
  /** 见 Condition；同一事件可挂多条，全部匹配的才叠加 */
  when?: Condition
  tierWeights?: Partial<Record<EventTier, number>>
  weightDelta?: number
}

export interface InteractChoice {
  text: string
  requires?: InteractRequires
  /** v9：走到这一选项时应用的效果（好感/flag/目标/战力/线索/事件因子） */
  effects?: Effect[]
  next?: InteractNode | { byMutual: InteractNode; byOneSide: InteractNode }
}

export interface InteractNode {
  text: string
  choices?: InteractChoice[]
  chance?: { p: number; ifHit: InteractNode; ifMiss: InteractNode }
  gainClue?: string
  /** v9：进入这个节点时应用的效果 */
  effects?: Effect[]
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
  /** v9：因子对这个事件概率的调制（档位 + 事件权重） */
  weightModifiers?: WeightModifier[]
  /** v9：抽中这个事件时，强制占用几次随机互动机会（默认由 kind 决定；显式写则覆盖） */
  opportunityCost?: 0 | 1 | 2
}

// ---------- 小事件（池 B） ----------
// V2：主选项执行完后，在小事件池里抽；可能抽空。
export interface SmallEventDef {
  id: string
  weight: number
  /** 文本（多段用 \n） */
  text: string
  /** 出现条件（不满足不进池） */
  require?: Condition
  /** 抽中时应用的效果 */
  effects?: Effect[]
  /** v9：因子对这个事件概率的调制 */
  weightModifiers?: WeightModifier[]
}

// ---------- 世界事件（池 C） ----------
// V3：每月开始时在世界事件池里抽；可能抽空。抽中通常会给「事件因子」。
export interface WorldEventDef {
  id: string
  weight: number
  title: string
  text: string
  require?: Condition
  effects?: Effect[]
  weightModifiers?: WeightModifier[]
  /** 是否一局只触发一次（默认 true） */
  once?: boolean
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

// ---------- 事件因子 ----------
// 事件因子 = 只能靠达成某些事件获得的能力/状态（如「唤龙」）。
// 与「身份因子」（开局获得）相对；运行态存在 PlayerRuntime.acquiredFactors。
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
  /** 固定事件（挂在 MonthDef.fixedEvent 上） */
  events: EventDef[]
  goals: GoalDef[]
  outcomes: OutcomeDef[]
  /** 随机互动池 A（V1） */
  interactEvents: InteractEvent[]
  /** 小事件池 B（V2） */
  smallEvents: SmallEventDef[]
  /** 世界事件池 C（V3） */
  worldEvents: WorldEventDef[]
  clues: ClueDef[]
  /** 事件因子池 */
  acquiredFactors: AcquiredFactorDef[]
  /** 默认"单人好感上限"（身份可用 npcAffinityCap 覆盖；没有全局总封顶） */
  affinityCap: number
}