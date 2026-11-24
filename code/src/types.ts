// ===== 核心类型定义 =====
// 说明：数据结构按"多玩家"预留（players 为字典），MVP 单机只填 1 个玩家，
// 未来升级多人时无需改结构。

export type SceneId = string;

// 场景：纯色占位 + 名称。换真图时给 image 字段即可，逻辑不变。
export interface Scene {
  id: SceneId;
  name: string;        // 如"教室"
  color: string;       // 纯色占位色值，如 "#3b4a5a"
  image?: string;      // 可选：真图路径；为空则用 color 占位
}

// NPC 定义
export interface NpcDef {
  id: string;
  name: string;
  personality: string;       // 性格归 NPC
  resident: boolean;         // true=常驻；false=随机刷出
}

// 条件：用于选项可见/可选、事件触发
export interface Condition {
  hasIdentity?: string;              // 携带有某身份
  affinityAtLeast?: [string, number];// [npcId, 阈值]
  flag?: string;                     // 某 flag 为真
}

// 效果：选项/事件产生的影响
export type Effect =
  | { type: 'affinity'; npc: string; value: number }          // 好感变化
  | { type: 'flag'; name: string }                            // 置 flag
  | { type: 'goalProgress'; value: number }                   // 私人目标进度 +value
  | { type: 'unlock'; id: string }                            // 解锁分支/选项
  | { type: 'worldShift'; scene: SceneId };                   // 世界变化→切场景

// 选项
export interface Choice {
  id: string;
  text: string;
  require?: Condition;        // 不满足则不可选
  effects: Effect[];
}

// 事件（一个回合里的核心内容）
export interface EventDef {
  id: string;
  title: string;
  scene: SceneId;             // 发生场景（切换背景）
  text: string;
  choices: Choice[];
}

// 月回合定义
export interface MonthDef {
  index: number;              // 月序号（1..36）
  label: string;              // 如 "高一 · 9月"
  eventId?: string;           // 本月事件；为空则"静默学习"
  silentStudy?: boolean;      // 静默学习回合
}

// 剧本
export interface Script {
  id: string;
  title: string;
  scenes: Record<SceneId, Scene>;
  npcs: Record<string, NpcDef>;
  months: MonthDef[];         // 三年 = 36 回合
  events: Record<string, EventDef>;
}

// 玩家运行态
export interface PlayerState {
  identity: string;                       // 唯一身份
  affinity: Record<string, number>;       // NPC 好感
  flags: string[];
  unlocked: string[];
  goalProgress: number;                   // 私人目标进度
}

// 单局状态
export interface RunState {
  monthIdx: number;                       // 当前月下标
  players: Record<string, PlayerState>;   // 多玩家预留；MVP 只有 "p1"
  log: string[];                          // 事件日志
  finished: boolean;
  ending?: string;
}

// 轮回存档（局外，跨局）
export interface RosterSave {
  runIndex: number;
  identity: string;
  affinity: Record<string, number>;       // 好感总封顶，结算时裁剪
  unlocked: string[];
}