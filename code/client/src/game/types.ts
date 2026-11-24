// ============================================================
// 游戏对外类型定义（快照 + 接口 + 剧本数据结构）
// 说明：
//   - GameView 是"给界面看的只读快照"，界面只认它
//   - GameSource 是"游戏大脑"的统一接口
//   - 其余是剧本/运行态的内部数据结构（会随迭代变化）
// ============================================================

// ---------- 1. 给界面看的快照 ----------
// 界面只依赖这个结构；引擎内部怎么变都不影响界面。
export interface GameView {
  /** 当前背景图 URL（相对 public 路径，如 /bg/classroom.jpg） */
  background: string;
  /** 文本框要显示的内容（可能含换行） */
  text: string;
  /** 选项列表；每个选项自带是否可选（不可选则置灰/隐藏） */
  choices: ChoiceView[];
  /** 圆形徽标上的回合数（当前 UI 是纯数字，这里给数字） */
  round: number;
  /** 兜底字段：临时加的新东西先塞这里，稳定后再做成正式字段 */
  extra?: Record<string, unknown>;
}

export interface ChoiceView {
  id: string;
  text: string;
  /** 是否可选：false 表示条件不满足，界面置灰或隐藏 */
  enabled: boolean;
  /** 不可选时的原因（用于提示，可选） */
  reason?: string;
}

// ---------- 2. 游戏大脑的统一接口 ----------
export interface GameSource {
  /** 获取当前快照 */
  getView(): GameView;
  /** 提交玩家选择；返回是否被接受 */
  submitChoice(choiceId: string): boolean;
  /** 订阅状态变化；返回取消订阅函数 */
  subscribe(listener: (view: GameView) => void): () => void;
}

// ---------- 3. 剧本数据结构（内部，后续会逐步扩充） ----------

/** 条件：所有字段都可选，组合成"与" */
export interface Condition {
  /** 需要拥有某个身份 */
  hasIdentity?: string;
  /** [npcId, 最低好感] */
  affinityAtLeast?: [string, number];
  /** 需要已解锁某个 flag/解锁项 */
  flag?: string;
  /** 需要某个私人目标进度 >= 值 */
  goalAtLeast?: [string, number];
}

/** 效果 */
export type Effect =
  | { type: 'affinity'; npc: string; value: number }        // 好感增减
  | { type: 'unlock'; target: string }                       // 解锁分支/选项
  | { type: 'flag'; target: string }                         // 置一个 flag
  | { type: 'goalProgress'; goal: string; value: number };   // 私人目标进度

/** 选项定义（剧本里配的） */
export interface ChoiceDef {
  id: string;
  text: string;
  /** 不满足则不可选；不填表示永远可选 */
  require?: Condition;
  effects?: Effect[];
  /** 选后跳到下一个"事件/旁白节点"，不填则走默认推进逻辑 */
  next?: string;
}

/** 事件定义 */
export interface EventDef {
  id: string;
  /** fixed=固定活动 random=随机活动 samebox=同框关系 study=学习/旁白 */
  kind: 'fixed' | 'random' | 'samebox' | 'study';
  background: string;
  text: string;
  choices: ChoiceDef[];
}

/** 月回合表 */
export interface MonthDef {
  /** 第几个月（从 1 开始） */
  index: number;
  /** 固定触发的活动事件 id */
  fixedEventId?: string;
  /** 随机池（随机抽一个触发），优先级低于 fixedEventId */
  randomPool?: string[];
  /** 本月若无事发生，给一个静默学习的旁白事件 id */
  silentEventId?: string;
}

/** 私人目标定义 */
export interface GoalDef {
  id: string;
  title: string;
  /** 目标总进度（达到即完成） */
  target: number;
}

/** 结局定义（表驱动，MVP 先简单加权） */
export interface OutcomeDef {
  id: string;
  title: string;
  text: string;
  /** 判定条件：所有 goalProgress 之和 >= threshold 即匹配（可后续扩展） */
  require?: { totalGoalAtLeast?: number; flag?: string };
}

/** 整份剧本 */
export interface ScriptDef {
  id: string;
  meta: { title: string; era: string; place: string };
  /** 初始背景图 */
  startBackground: string;
  months: MonthDef[];
  events: EventDef[];
  goals: GoalDef[];
  outcomes: OutcomeDef[];
  /** 随机活动每月抽取用的随机数种子策略：MVP 用真随机，这里留空 */
}