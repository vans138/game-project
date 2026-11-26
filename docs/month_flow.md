# 月度回合流程 v2（v9 三池模型）

> 取代 v1。**权威状态模型见 [state_model.md](state_model.md)**；本文只讲"一个月按什么顺序走、每一步怎么抽"。
> v1 的"固定 8 阶段、没有世界事件"已过时。

## 0. 三个池

| 池 | 字段 | 何时用 |
|---|---|---|
| A 随机互动 | `interactEvents` | 主选项之后的两个机会点（V1） |
| B 小事件 | `smallEvents` | 主选项执行完后（V2），可能抽空 |
| C 世界事件 | `worldEvents` | 每月开始（V3），可能抽空 |

三个池都支持 `weightModifiers`（见 state_model.md §3）；池 A 还有 `tier` 两段抽。

## 1. 阶段顺序

```
[世界事件]（可选）→ intro → mainChoice → feedback → smallEvent
→ fixedEvent（仅事件月）→ interact1 → interact2 → summary → 下个月
```

- 假期月：只有 `holidaySkip`。
- 好感 ≤ -50 且该对象本月还没失控过、也没死：在"固定事件之后、interact1 之前"插入一次**失控**（占满两次机会）。
- `summary` 之后进入下一个月；时间线走完即 `finish()`。

### 1.1 worldEvent（每月开始）

- `enterMonth()` 调 `rollWorldEvent()`：池 C 里按条件过滤（`once` 默认 true，触发过的排除）→ 按权重抽，抽空返回 null。
- 抽中：阶段 = `worldEvent`，正文显示标题+正文；点"继续"（`world_next`）时**才结算 `effects`**、记 `firedWorldEvents`、写月志，然后进 `intro`。
- 抽空：直接 `intro`。

### 1.2 intro

- 有固定事件时：播该事件的标题 + 导入叙述；否则"这个月和往常一样"。
- 只读，选项只有一个"继续"。

### 1.3 mainChoice

- 学习 `study` / 拉近关系 `bond:<npcId>`（死者不出现）/ 调查线索 `investigate` / 龙迫 `coerce`。
- 调查、龙迫是先进入子菜单（`mainChoice` 阶段内二次选择），可取消回主菜单。
- 选完进入 `feedback`。

### 1.4 feedback

- 三段反馈：自己 / 身边 / 特殊（"在意的人"若存在）。
- 只读，点"继续"→ `smallEvent`。

### 1.5 smallEvent（池 B）

- 先掷"这个月有没有意外"：`p = clamp(0.4 + 主选项加成 + 拉关系加成, 0, 1)`。
  - 学习/拉关系：+0.25；拉关系再 +0.15。
- 没抽中 → "这个月没有发生什么特别的意外"，**不进池**。
- 抽中 → 在池 B 里按条件过滤 + `weightModifiers` 加权抽一条 → 显示文本并结算 `effects`。
- 池 B 为空或全被条件过滤 → 同上兜底文本。
- 小事件**不占**随机互动机会。

### 1.6 fixedEvent（仅事件月）

- 选项按 `Condition` 过滤；`tier === 'critical'` 且拥有「唤龙」时额外多一条 `【唤龙】`。
- 选中后：写月志 → 结算 `effects`（或 `outcomes` 两段抽）→ 检查失控 → `interact1`。

### 1.7 随机互动 V1（池 A）

抽取（`pickInteract`）：

1. 过滤：机会②只留 `short`；**本月已抽过的 id 排除**；`hasCrush` / `identityFactor` 条件；`onceGuaranteed` 已触发的排除；`weight <= 0` 排除。
2. 有 `onceGuaranteed` 的候选项 → 按 `priority` 取最高的，直接用它。
3. 否则两段抽：
   - 档位：`baseTierWeights()` + 所有候选项的 `tierWeights` 调制 → 归一化 → 抽 common/rare/critical；
   - 档内：按 `base weight + weightDelta` 加权抽具体事件。
4. 抽到后 `startInteract`：记入"本月已抽"；`opportunityUsed = opportunityCost ?? (long ? 2 : 机会①?1:2)`。

机会①用全部池；机会②只抽 `short`，且排除①抽过的。若②抽空 → 直接 `summary`。

### 1.8 互动树

- 选项按 `identityFactor` / `hasCrush` 过滤；选中时先结算 `InteractChoice.effects`。
- `next` 三种形态：
  - 普通节点：进入后结算 `InteractNode.effects`、给 `gainClue`；
  - `{ byMutual, byOneSide }`：`byMutual` 的判定——湖面事件按身份因子（古龙=mutual），其余按 `rng.chance(0.6)`；
  - `chance` 节点：按 `p` 走 ifHit/ifMiss（当前剧本未使用）。
- `maybeLong` 走到 `byMutual` 会追加占用第二次机会，直接进 `summary`。
- 交互结束：`opportunityUsed >= 2` → `summary`；否则进 `interact2`。

### 1.9 summary

- 收束，点"进入下个月"→ `advanceMonth()`。

## 2. 已知的"可能什么都不发生"

- 世界事件池 C 目前为空 → `worldEvent` 阶段不会出现。
- 小事件池 B 只有 3 条，且要先通过概率门。
- `weightModifiers` 还没有任何剧本条目使用。

## 3. 与 v1 的差异

- 新增 `worldEvent` 阶段与池 C；小事件改成"池 B 加权抽"。
- 删除 `factorPool` / `factorGroups` / `factorActive` / `setTerminate`。
- 随机互动新增：去重、`opportunityCost`、`weightModifiers`、选项/节点 `effects`、`chance` 节点。
