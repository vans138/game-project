# 状态模型（A / V）· v9

> 本文是 `script-br/src/game/script/types.ts` 顶部注释的展开版。
> 代码里的"因子"就是状态 A；"事件机会"就是动作 V。

## 1. 状态 A：因子（三类，按获得途径分）

| 类型 | 来源 | 例子 | 运行时存放 |
|---|---|---|---|
| **身份因子** IdentityFactor | 只能由开局选的身份获得 | 龙烬余孤 → `seal`（封龙）/ `ancient`（古龙） | `player.identityFactor` |
| **事件因子** EventFactor | 只能靠达成某些事件获得 | `acq_call_dragon`（唤龙） | `player.acquiredFactors` |
| **信息因子** InfoFactor | 随时变化，是事件判定的输入 | 月份、好感、战力、flag、目标进度、是否死亡 | `player.*` / `monthIndex` |

身份因子和事件因子都能"调制概率"（见 §3）；信息因子不参与调制，只参与条件判断。

## 2. 动作 V：事件机会（三个发生点、三个池）

| 机会 | 发生时机 | 池 | 字段 | 特点 |
|---|---|---|---|---|
| **V1** | 主选项之后 | 随机互动池 A | `interactEvents` | 有两个机会点 ①/②；`kind` 决定占几次机会，`opportunityCost` 可覆盖 |
| **V2** | 主选项执行完 | 小事件池 B | `smallEvents` | 先按 `SMALL_EVENT` 概率决定"这个月有没有意外"，再从池里加权抽；可能抽空 |
| **V3** | 每月开始 | 世界事件池 C | `worldEvents` | 月初抽，抽中先播"世界事件"再进 intro；`once` 默认 true；可能抽空 |

抽空时不会卡住：V2 走"这个月没有发生什么特别的意外"，V3 直接进 intro。

## 3. 因子怎么调概率

`WeightModifier` 挂在池 A / B / C 的条目上，可挂多条：

```ts
{
  when?: Condition          // 条件不满足则这条不生效
  tierWeights?: { common?: number; rare?: number; critical?: number }  // 改"难度档位"分布
  weightDelta?: number      // 改"同一档内这个事件"的权重（可正可负）
}
```

抽 V1 的顺序：先按 `tierWeights`（基准 + 各条 modifier）归一化抽档 → 再在该档里按 `base weight + weightDelta` 抽具体事件。
V2 / V3 没有档位，只按 `base weight + weightDelta` 抽。

## 4. 一个月的阶段

```
worldEvent（可选）→ intro → mainChoice → feedback → smallEvent
→ fixedEvent（仅事件月）→ interact1（随机互动①）→ interact2（随机互动②）→ summary
```

- 假期月只有 `holidaySkip`。
- 好感 ≤ -50 时可能插入 `失控`（走 interact1 层，占两次机会，每目标一局一次）。
- 抽到 `long` 事件会直接吃满机会；`maybeLong` 走到"双方主动"分支时追加吃机会。

## 5. 结果怎么落地

事件/选项通过 `effects` 改状态：`affinity / flag / goalProgress / powerDelta / gainClue / acquireFactor / log`。
选项副作用有两层入口：

- 固定事件：`Choice.effects` 或 `Choice.outcomes`（按 favorable/unfavorable 两段抽）
- 随机互动：`InteractChoice.effects`（选中时）、`InteractNode.effects`（进入节点时）、`InteractNode.gainClue`

好感只受"单人上限"约束（普通 100 / 龙 80），没有全局总封顶；所有加好感的路径都走 `applyEffectsCapped()`。

## 6. 当前剧本用到了多少

- 池 A：5 个事件（湖面必遇 / 长椅 / 天台 / 旧楼 / 失控占位）
- 池 B：3 个（黑鸟 / 纸条 / 头晕）
- 池 C：**空** —— 所以 `worldEvent` 阶段实机暂时不会出现
- `weightModifiers`：**还没有剧本条目使用**（引擎已支持）

## 7. 与 v8 的差异（别按旧文档写代码）

- 删除 `Script.factorPool` / `Script.factorGroups` / `FactorDef` / `FactorGroup`；世界因子不再是独立结构，统一由"因子 + 池"表达。
- 删除 `Condition.factorActive` 与 `Effect.setTerminate`。
- 新增 `smallEvents` / `worldEvents` / `WeightModifier` / `InteractEvent.opportunityCost` / `InteractChoice.effects` / `InteractNode.effects`。
