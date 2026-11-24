# 《剧本吃鸡》技术方案 v1.0

## 1. 技术选型

### 1.1 核心形态
纯文本 + 选项驱动 + 按月同步 + 跨轮回存档。无战斗、无实时、无物理/碰撞。**本质是"多人共享状态的文字游戏 + 数据持久化"**。

### 1.2 选型建议（MVP 验证向，不追商业）

| 层 | 选型 | 理由 |
|---|---|---|
| 客户端 | **Web（React + TypeScript）** | 文本/选项 UI 天然适合；跨平台；迭代快；便于多人测试 |
| 状态管理 | **Zustand / 轻量 store** | 纯文本选项流转，状态机轻 |
| UI 渲染 | React 组件（场景背景图 + 文本 + 选项按钮） | 2D 背景图 = `<img>` 切换，无需地图引擎 |
| 后端 | **Node.js + TypeScript（同语言）** | 前后端同栈，MVP 快 |
| 通信 | **WebSocket（实时同步时间片/事件）** | 多人按月同步、事件共享 |
| 数据存储 | **SQLite（MVP）→ 可换 Postgres** | 零配置起步；剧本/存档/好感数据量小 |
| 剧本数据 | **JSON / YAML 定义** | 剧本=数据，人工配置；便于后续 AI 生成替换 |
| 构建/运行 | Vite + pnpm | 快 |

**不引入**：ECS、物理引擎、游戏引擎（Unity/Godot）、实时 netcode、AI 服务。

### 1.3 架构总览
```
[React 客户端] <--WebSocket--> [Node 服务]
                                   |-- 房间/同步模块（时间片）
                                   |-- 剧本引擎（事件/选项/条件求值）
                                   |-- 矛盾引擎（互锁目标/好感/关系事件）
                                   |-- 结算与结局判定
                                   |-- 持久化（SQLite）
[剧本数据 JSON]  <--加载-->  剧本引擎
```

---

## 2. 模块拆分

### M1 剧本数据层（内容定义）
- 剧本 = 结构化 JSON：`meta`(时代/校园)、`cast`(角色/身份池)、`npcs`(常驻/随机+性格)、`timeline`(月回合表)、`events`(固定活动/随机活动/同框事件)、`goals`(表面任务/私人目标/互锁表)、`outcomes`(结局条件)。
- **人工配置**；schema 化，便于校验与未来替换为 AI 生成。

### M2 房间与同步（时间片）
- 创建/加入房间（6–10 人）。
- **按月回合**推进：回合开始 → 广播事件 → 玩家提交选项 → 回合结算 → 推进下一月。
- 权威在服务端；客户端只提交指令、渲染状态。
- 掉线/重连：拉取当前回合状态。

### M3 剧本引擎（事件与选项）
- **条件求值器**：选项可见/可选由条件（身份、好感、解锁、真相进度）决定。
- **事件触发**：固定活动按时间表；随机活动按池子抽取；同框事件按"关系相关者同处一时段"判定自动触发。
- **静默结算**：上课时段推进 + 学习收益结算。

### M4 矛盾引擎
- **目标互锁图**：角色/私人目标为节点，互斥/依赖/争稀缺物为边；校验 ≥3 强互斥点、无孤立角色。
- **好感系统**：NPC 好感变化（受选择影响），跨轮回带出（总封顶，需分配）。
- **关系事件**：同框/邀请/介入逻辑。

### M5 结算与结局
- 三年结束：私人目标完成度 + 关系结局 + 关键真相 → 综合结局（表驱动或加权规则）。

### M6 局外养成（轮回存档）
- 携带：唯一身份 + 好感（总封顶分配）+ 分支解锁。
- 轮回存档读写；跨局延续。

### M7 持久化
- 表：`rooms`、`players`、`saves`(轮回)、`run_state`(当前局)、`flags`。

---

## 3. 数据结构（核心）

```ts
// 剧本
type Script = {
  id: string; meta: { era: string; place: string };
  cast: Role[]; npcs: NpcDef[]; timeline: MonthDef[];
  events: EventDef[]; goals: GoalDef[]; outcomes: OutcomeDef[];
};

// 角色/身份
type Role = { id: string; surfaceTask: string; privateGoal: GoalRef; unlocks: string[] };

// NPC
type NpcDef = {
  id: string; type: 'resident' | 'random';
  personality: string; affinityStart: number;
  persistAcrossRuns: boolean; // 常驻可跨局
};

// 月回合
type MonthDef = { index: number; fixedEvent?: string; randomPool?: string[]; silentStudy?: boolean };

// 事件
type EventDef = {
  id: string; kind: 'fixed'|'random'|'samebox'|'study';
  trigger: Trigger; choices: Choice[];
};

// 选项（条件求值）
type Choice = {
  id: string; text: string;
  require?: Condition;        // 可见/可选条件
  effects: Effect[];          // 好感/解锁/flag/目标进度
};

// 条件与效果
type Condition = { all?: Condition[]; any?: Condition[]; hasIdentity?: string; affinityAtLeast?: [npcId:string, v:number]; flag?: string };
type Effect = { type: 'affinity'|'unlock'|'flag'|'goalProgress'|'worldShift'; target?: string; value?: any };

// 轮回存档（局外）
type RosterSave = {
  playerId: string; runIndex: number;
  identity: string;                     // 唯一身份
  affinity: Record<string, number>;     // NPC好感，总封顶约束
  unlocked: string[];                   // 解锁分支/选项
};

// 运行态（局内）
type RunState = {
  roomId: string; month: number; year: number;
  players: Record<string, { role: string; goals: any; affinity: Record<string,number>; flags: string[] }>;
  phase: 'awaiting_choice' | 'resolving';
};
```

---

## 4. 关键流程

### 4.1 一月的回合循环（服务端权威）
1. 进入 `month`：广播"本月事件"（固定活动 / 随机活动 / 静默学习）。
2. 玩家提交选项（受 `require` 过滤）。
3. 服务端结算 `effects`：好感、解锁、flag、私人目标进度、世界变化。
4. 判定同框关系事件 → 触发二次事件。
5. `month++, phase=awaiting_choice`，广播新状态。

### 4.2 三年结束
- `year=3 && month=last` → 结算：按 `outcomes` 规则出综合结局。
- 写 `RosterSave`（唯一身份 + 好感总封顶分配结果 + 解锁）。

### 4.3 跨轮回
- 新一局开局：读 `RosterSave` 注入身份/好感/解锁；按世界随机基调生成随机 NPC。

---

## 5. 风险点与对策

| 风险 | 对策 |
|---|---|
| 多人同步复杂度 | MVP 先做"服务端权威 + 回合广播"，不做实时帧同步；每回合等待所有人提交，超时自动推进 |
| 纯文本多人测试成本 | 提供单人 + 规则补位（可后续加），先跑通流程 |
| 剧本 JSON 过大难维护 | 定义 schema + 校验（Zod）；拆事件文件 |
| 内容量 | MVP 只做 1 份剧本（校园/一年先跑通，再扩三年） |
| 好感总封顶分配 | 结算时按玩家配置分配，超出则裁剪 |
| 同框事件判定 | 简化为"同一时段同处一地点"的集合判定 |
| 养成/结局规则写死 | 用表驱动（outcomes 配置），便于调 |
| 未来 AI 生成 | 剧本=数据层，接口预留：`ScriptSource` 可换实现 |

---

## 6. MVP 构建顺序（建议）
1. 剧本数据 schema + 1 份最小剧本（1 月、3 角色）。
2. 单人跑通：事件→选项→效果→结算。
3. 加时间轮（月→年），跑通三年。
4. 加 WebSocket 多人同步。
5. 加好感/解锁/轮回存档。
6. 加结局判定 + 局外带出。
7. 加同框/活动事件。
8. 平衡与验证。

---

## 7. 目录结构（建议）
```
project/
  client/        # React + TS + Vite
    src/
      components/  # 文本/选项/背景图
      store/       # Zustand 状态
      net/         # WebSocket
  server/        # Node + TS
    src/
      room/        # 房间与同步
      engine/      # 剧本引擎/条件求值
      conflict/    # 矛盾引擎/好感/同框
      resolve/     # 结算与结局
      persistence/ # SQLite
  scripts/       # 剧本 JSON + schema 校验
```

---

## 8. 待确认/方案取舍
- MVP 第一份剧本：**先做 1 年跑通，还是直接三年？**（建议先 1 年，降低内容量验证系统）
- 多人 MVP：**必须先做联网，还是先单机验证系统再联网？**（建议先单机验证，联网作为后续）
- 是否保留 WebSocket 双端，还是先纯前端 + 本地存档验证。