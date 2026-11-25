# 《剧本吃鸡》月度回合流程 v1

> 本文档定义"玩家进入一个月后经历什么"。
> 定稿于：2026-11-24。**本版之后，代码以此为准**。

---

## 0. 前提与范围

- 本版**只做"身份因子"**（第一个身份：龙烬余孤 → `封龙` / `古龙` 随机二选一）。
- **世界因子（家族/旧楼/学业）本批不做**，代码保留但不激活。
- **同框判定**：本批**引擎支持**，但**内容先不填**（后续填）。
- 固定事件仅出现在"事件月"，普通月没有固定事件。
- "一个月"不再等于"一个选项"。一个月由 8 个阶段组成。

---

## 1. 月流程（8 阶段）

```
【进入新月】
 ① 导入信息
 ② 主选项
 ③ 反馈层
 ④ 小事件（概率触发）
 ⑤ 固定事件（仅事件月，额外层，不占随机互动机会）
 ⑥ 随机互动机会①
 ⑦ 随机互动机会②（条件性出现）
 ⑧ 本月反馈
【推进下月】
```

### 阶段 ① 导入信息

- 播放本月的开篇叙述。
- 内容来源：世界氛围 / 特殊月播报（如"本月将举行运动会"）/ 身份暗示（根据当前身份因子 `seal` / `ancient`，给不同措辞）。
- 玩家**只读**，无选择。

### 阶段 ② 主选项

玩家本月主动做什么。MVP 提供两项（第三项结构留空）：

1. **学习** — 影响"小事件"中学习类事件的出现概率（↑）
2. **拉近关系** — 先选一个人（NPC 或将来其他玩家），进行好感推进

> 第三项留空。结构上 `mainChoiceOptions: MainChoiceOption[]` 可扩展。

### 阶段 ③ 反馈层

- **自己**：主选项执行后的直接结果（如"你这个月学得很扎实"）。
- **身边人**：班级里发生的小事（营造有人活着的世界）。
- **特殊关系人**：与"在意的人"相关的一条变化（如"她和别人走得很近"）。
- 三段均为叙述，无选择。**特殊关系人这一段会修改小事件概率**（见 §3）。

### 阶段 ④ 小事件（概率触发）

- 由"主选择 + 关系状态 + 身份因子"共同决定的**出现概率**。
- 抽中 → 播放一段短叙述，可能带 1 个选项；没抽中 → 跳过。
- **负向权重远大于正向**：打扰学习因素的影响 > 学习本身加成。
- 小事件**不占**随机互动机会。

### 阶段 ⑤ 固定事件（仅事件月）

- 玩家事先知道的既定大事（期末考、运动会等）。
- 有明确选项，选项效果影响关系 / 目标 / 身份迹象。
- **不占随机互动机会**。机会计数与固定事件完全独立。

### 阶段 ⑥ 随机互动机会①

- 抽**随机互动事件**。抽取规则见 §2。
- 抽到后进入该事件的**决策树**。
- 依据事件类型与被选路径，决定是否占用机会②（见 §2.2）。

### 阶段 ⑦ 随机互动机会②

- **仅当机会①未把本月机会耗尽时**进入。
- 池子被**强制收窄**为"纯短事件"（见 §2.2）。

### 阶段 ⑧ 本月反馈

- 收束叙述：把本月发生的关键事做一句话总结。
- 推进到下个月。

---

## 2. 随机互动事件：抽取与机会消耗

### 2.1 事件分类

| 类别 | 定义 | 机会消耗 |
|---|---|---|
| **定义型长事件**（`long`） | 事件本身是长时段（如"一整晚的对话"） | 抽到 → 立即吃 2 次机会，本月结束 |
| **选择型长事件**（`maybeLong`） | 一开始是短事件，**是否变长由运行时玩家选择决定**（如"要不要主动找她"+ 双方主动 → 深入） | 抽到吃 1 次；若出现"双方主动"分支 → 追加吃 1 次 → 本月结束 |
| **纯短事件**（`short`） | 一定是短事件 | 吃 1 次 |

### 2.2 机会池规则（按位置，不按剩余量）

- **机会①**：池子 = **全部随机互动事件**（long + maybeLong + short）。
- **机会②**：池子 = **纯短事件（short）**。**排除** `long` 和 `maybeLong`。
  - 原因：机会②是本月最后一次，给它变长空间会造成"机会不够用"。

### 2.3 "双方主动"判定

在 `maybeLong` 事件中，出现"是否深入"的分叉时：

- **对方是 NPC**：由**好感度是否达到阈值**决定（达到 → 视为"对方也主动"）。
- **对方是真人玩家**（未来联网）：由**对方实际选择**决定。
- 单机 MVP：一律按 NPC 逻辑（好感阈值）。

**双方主动** → 判定为"变长" → 追加消耗机会② → 本月随机互动到此结束。

### 2.4 抽取流程

```
if 机会①:
    pool = allInteractEvents(按因子/关系过滤)
    event = weightedPick(pool, weights)
    if event.kind == 'long':
        consume(2); goto 本月反馈
    else:
        playTree(event)      # 树中可能变长
        if becameLong:
            consume(2); goto 本月反馈
        else:
            consume(1); goto 机会②
else if 机会②:
    pool = interactEvents.filter(e => e.kind == 'short')
    pool = filterByFactorAndRelation(pool)
    event = weightedPick(pool, weights)
    playTree(event)          # 强制 short，不可能变长
    consume(1); goto 本月反馈
```

---

## 3. 小事件概率模型

```
p = clamp(base + mainChoiceBonus + relationModifier + factorModifier, 0, 1)

base = 0.4                          # 基础概率
mainChoiceBonus:
  · 学习 → 学习类小事件 +0.25，其余小事件 +0
  · 拉近关系 → 关系类小事件 +0.25
relationModifier:
  · "在意的人"最近与他人亲近 → 学习类小事件 -0.4（负向权重远大于正向）
  · "在意的人"最近独来独往 → 关系类小事件 +0.15
factorModifier:
  · 身份因子相关的暗示事件按设计微调（封龙/古龙差异，MVP 暂固定）
```

**负向权重 > 正向**是硬约束：任何"打扰学习"的关系变动，其对学习概率的削减（-0.4）大于学习本身带来的加成（+0.25）。

---

## 4. 数据结构草案

```ts
// ===== 身份因子（本批唯一因子）=====
type IdentityFactorId = 'seal' | 'ancient'   // 封龙 / 古龙

interface IdentityRuntime {
  identityId: string                  // 'longjin_yugu' (龙烬余孤)
  factorId: IdentityFactorId          // 开局随机二选一，玩家不可见
}

// ===== 关系状态（简化版）=====
interface RelationRuntime {
  id: string                 // NPC 或 玩家 id
  kind: 'npc' | 'player'
  affinity: number           // 好感数值
  state: 'stranger' | 'acquaintance' | 'close' | 'crush'
  sameClass: boolean         // 是否同班
}

interface RelationsRuntime {
  crushId?: string           // 在意的人（relation 的 id）
  list: RelationRuntime[]
}

// ===== 随机互动事件 =====
type InteractKind = 'short' | 'maybeLong' | 'long'

interface InteractEvent {
  id: string
  kind: InteractKind
  weight: number
  requires?: {
    hasCrush?: boolean
    sameClass?: boolean
    identityFactor?: IdentityFactorId
  }
  root: InteractNode
}

interface InteractNode {
  text: string
  choices?: InteractChoice[]                       // 无 choices = 叶节点
  chance?: { p: number; ifHit: InteractNode; ifMiss: InteractNode }
}

interface InteractChoice {
  text: string
  requires?: { sameClass?: boolean; identityFactor?: IdentityFactorId }
  next?: InteractNode | {
    byMutual: InteractNode      // 对方也主动 / 好感达阈值
    byOneSide: InteractNode     // 对方未主动
  }
}

// ===== 月运行时 =====
interface MonthRuntime {
  index: number
  phase: 'intro' | 'mainChoice' | 'feedback' | 'smallEvent'
       | 'fixedEvent' | 'interact1' | 'interact2' | 'summary' | 'done'
  isEventMonth: boolean
  fixedEventId?: string
  opportunityUsed: 0 | 1 | 2
}
```

---

## 5. 与旧版的差异（迁移提示）

- **旧版**：一步 = 一月，`RunEngine.choose()` 直接推进 `monthIndex`。
- **新版**：一月有 8 个阶段，`RunEngine` 维护 `MonthRuntime.phase`，`choose()` 按当前 phase 分派。
- **GameView** 需要增加字段：当前阶段提示、小事件反馈、固定事件提示、互动事件决策树视图等。
- **UI** 层继续只依赖 `GameView` + `GameSource`，不变。

---

## 6. 本批完成判据

1. 用"龙烬余孤"身份跑通 Y1-9 到 Y2-2 共 6 个月。
2. 6 个月内，封龙/古龙 的**文本与选项**能体现出差异（不需显式状态机）。
3. 随机互动事件的**机会池规则**正确（长事件只在①，②强制短）。
4. 小事件概率**能看出**负向权重 > 正向。
5. 固定事件月（期末考、运动会）能正确插入且不占机会。