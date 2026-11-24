// 剧本数据层的类型定义（结构对齐 JSON，将来可原样转成 JSON 文件）
// 所有条件/效果都写成可序列化的纯数据，杜绝函数，方便未来替换为策划配置或 AI 生成。

/** 条件：可组合（all/any 嵌套），叶子是原子判断 */
export type Condition =
  | { all: Condition[] }
  | { any: Condition[] }
  | { hasIdentity: string } // 玩家身份包含该 tag
  | { affinityAtLeast: [npcId: string, value: number] } // 对某 NPC 好感 >= 值
  | { flag: string } // 拥有某 flag
  | { goalProgressAtLeast: [goalId: string, value: number] } // 私人目标进度 >= 值
  | { monthAtLeast: number } // 月份 >= 值（用于解锁后段剧情）

/** 效果：选项被选中的后果 */
export type Effect =
  | { type: 'affinity'; target: string; value: number } // NPC 好感增减
  | { type: 'unlock'; target: string } // 解锁分支/选项 id
  | { type: 'flag'; target: string } // 打上标记
  | { type: 'goalProgress'; target: string; value: number } // 私人目标进度
  | { type: 'log'; text: string }; // 追加一段叙述文本（渲染用）

/** 一个选项 */
export interface Choice {
  id: string
  text: string
  require?: Condition // 不满足则不可见（MVP 直接隐藏）
  effects: Effect[]
}

/** 事件：固定活动 / 随机活动 / 同框关系事件 / 静默学习 */
export type EventKind = 'fixed' | 'random' | 'samebox' | 'study'

export interface EventDef {
  id: string
  kind: EventKind
  title: string // 事件标题（渲染用）
  narrative: string // 事件叙述正文
  choices: Choice[]
}

/** 私人目标定义 */
export interface GoalDef {
  id: string
  title: string
  target: number // 进度达到 target = 完成
}

/** 月回合定义：一学年 10 回合，三年共 30 */
export interface MonthDef {
  index: number // 1-based 全局月份
  year: number // 1-3
  month: number // 1-10（学年内月份）
  fixedEvent?: string // 固定活动事件 id
  randomPool?: string[] // 随机活动池（每次从里抽一个）
  silentStudy?: boolean // 本月是否含"上课静默结算"
}

/** NPC 定义 */
export interface NpcDef {
  id: string
  name: string
  type: 'resident' | 'random' // 常驻 / 随机
  personality: string
  affinityStart: number
  persistAcrossRuns: boolean // 常驻可跨轮回
}

/** 玩家可选角色（表面任务 + 私人目标 + 初始身份） */
export interface Role {
  id: string
  name: string
  surfaceTask: string // 表面任务（公开）
  privateGoalId: string // 私人目标 id
  identityTags: string[] // 初始身份标签（含玄幻身份）
}

/** 结局规则：按私人目标完成度 + 关系 + 关键真相结合判定 */
export interface OutcomeDef {
  id: string
  title: string
  narrative: string
  // 命中条件（取所有满足项中优先级最高的，MVP 用有序数组，先命中先用）
  require?: Condition
  // 简化的门槛：私人目标完成率 >= 该值（0-1），不写则不看
  minGoalRatio?: number
}

/** 完整剧本 */
export interface Script {
  id: string
  meta: { title: string; era: string; place: string }
  roles: Role[]
  npcs: NpcDef[]
  timeline: MonthDef[]
  events: EventDef[]
  goals: GoalDef[]
  outcomes: OutcomeDef[] // 有序，从具体到兜底
}