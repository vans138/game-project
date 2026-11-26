# 项目进度日志

## 基本信息
- 项目：剧本吃鸡（多人共享剧本 · 轮回养成 · 纯文本）
- 阶段：阶段3 编码实现（进行中）
- 当前批次：**第 2.1 批「古龙线骨架」已完成、能跑通、typecheck 通过**
- 更新日期：2026-11-26（连 VPN 后补推一次）

---

## 一、下次开工第一件事（最重要，必读）

### 用户已定的方向：**先做 A = 在现有 6 个月里加"能触发龙迫的好感路径"，先不做时间线扩展。**

下次对话**直接进入这一项，不要再问"要不要做 A"**，用户已经说了 A。

### A 任务的验收目标（做完用户要能亲眼看到）
1. 有选项能把某个 NPC 的好感压到 **≤ -50**。
2. 一旦某 NPC 好感 ≤ -50，**下个月主选项里出现「龙迫（N 个目标）」**。
3. 点「龙迫」→ 选目标 → 本月：
   - 反馈里显示"TA 本月的行动被压下去了"；
   - 小事件被替换成"被人盯着/无时无刻的注视"；
   - 该 NPC 不能再被龙迫（每目标一次），全局限 2 次。
4. 若好感 ≤ -50 且玩家走到"失控"判定 → 走 `it_out_of_control` + 伤害概率（无伤/轻伤/重伤/死亡）。
5. 全程 typecheck 通过。

### 已知的坑（别踩）
- 现在剧本**没有任何选项能把好感压到 -50**，所以龙迫/失控在实机里看不到，必须在 `script1.ts` 里加负好感内容。
- 加负好感选项时，注意 `enforceAffinityCap()` **只管正向**：负向不会被裁剪，能到 -50 甚至更低。
- 好感总计面板 `affinityTotal` 只累加正向（`Math.max(0, v)`），负好感玩家在面板上看到的是"某 NPC 是负数"，这没问题。

---

## 二、可运行目录（唯一）

```
C:\Users\34903\game_project\script-br
```
启动（CMD / PowerShell 都可，但 npm 不在 PATH，必须用完整路径）：
```
cd /d "C:\Users\34903\game_project\script-br"
"C:\Program Files\nodejs\npm.cmd" run dev
```
- 端口 5173。浏览器 `http://localhost:5173`
- 类型检查：`"C:\Program Files\nodejs\npm.cmd" run typecheck`（= tsc --noEmit）
- 构建：`"C:\Program Files\nodejs\npm.cmd" run build`

**最近一次验证（2026-11-26）**：typecheck 通过，dev 能起，湖面事件/线索/战力/唤龙都能看到。

---

## 三、当前代码结构（`script-br/src/game/`，这是活的）

```
game/
  GameView.ts          # UI 快照结构 + GameSource 接口（含 clues / playerPower / acquiredFactors）
  LocalSource.ts       # 单机数据源：选身份 → RunEngine → GameView
  GameScreen.tsx       # 局内 UI（背景+月徽标+选项+下方文本框+右上状态面板，面板含战力/好感/线索）
  styles.css

  engine/
    RunEngine.ts       # 【单文件引擎｜880 行】state/月份流程/主选项/调查/龙迫/小事件/
                       #   失控/随机互动抽取/湖面结算/视图/choose/订阅 全在这里
    balance.ts         # 所有概率与数值常量（事件三档基准、结果两侧基准、龙迫加成、小事件、伤害）
    modifiers.ts       # 概率调制内核：baseTierWeights/applyTierModifier/normalizeTier/pickTier
                       #               baseSideWeights/applySideModifier/normalizeSide/pickSide
    evaluator.ts       # evalCondition + applyEffects（含 powerDelta / acquireFactor / gainClue）
    damage.ts          # calcDamage + damageNarrative（无伤/轻伤/重伤/死亡）
    clues.ts           # acquireClue / investigateClue / listInvestigable / ClueRuntime
    rng.ts             # 种子随机 mulberry32

  script/
    types.ts           # 剧本类型 v8（tier/valence 双维度、outcomes 概率结果、ClueDef、后天因子等）
    script1.ts         # 第一份剧本（Y1-9 ~ Y2-2，6 个月）
```

**外部依赖不变**：`LocalSource.ts` 只 `import { RunEngine, type Snapshot } from './engine/RunEngine'`。拆文件时不要改这个入口。

---

## 四、本轮（第 2.1 批）已经做成的能力

### 1. 事件双维度（已落地）
- `EventDef` / `InteractEvent` 都有 `tier`（common/rare/critical）和 `valence`（favorable/unfavorable/neutral 权重表）。
- **注意：valence 目前只在龙迫调制里被用到；平时抽取"先按 tier 两段抽、档内按 weight 抽"**。valence 的"平时是否影响抽取"用户还没最终定，**下次做 A 时不要动这块**，除非用户明确要。

### 2. 统一概率模型（已落地）
- 事件：先按 tier 三档归一化抽档，再档内抽事件。
- 结果：`Choice.outcomes` 分 favorable/unfavorable 两段抽。
- 数值全在 `balance.ts`：
  - 事件基准：common 70 / rare 25 / critical 5
  - 结果基准：favorable 75 / unfavorable 25
  - 龙迫加成：tier 危急+10 稀有+5；side 不利+15
  - **无上限兜底**（用户明确要求）
- `modifierSource()` 目前恒返回 `dragonCoercedThisMonth: false`（因为龙迫目标是 NPC，不是玩家自己），所以对"玩家自己抽事件"的调制暂时不生效。**这是预期**：等以后有多方龙迫玩家时才接。

### 3. 湖面事件（已落地）
- `it_lake_dragon`：必遇（onceGuaranteed）+ 一次性 + priority 100。
- 封龙看到"锈色锁链"，古龙看到"暗金鳞片无锁链"（用 byMutual 复用做身份分叉）。
- **无论选哪个分支**，走完都统一结算（`settleLakeDragon`）：
  - 线索《龙？》+1
  - 战力 +10
  - 后天因子「唤龙」
- 月志里会出现：`🔍 你获得了一条线索：《龙？》` 和 `🧬 你获得了后天因子「唤龙」`。

### 4. 线索系统（雏形已落地）
- `ClueDef` 多阶段；《龙？》有 3 阶段。
- 主选项里有「调查线索（N 条可查）」，每查一次推进一阶段。
- 状态面板显示线索 `stage/total`。

### 5. 龙迫机制（已实现，但实机触发不到）
- 代码已就绪：主选项检测好感 ≤ -50 → 出现「龙迫」；每目标一次 / 全局最多 2 次。
- 效果：小事件换成"被人盯着"，标记 `coerceState`。
- **问题：剧本里还没有能把好感压到 -50 的选项，所以看不到。这就是 A 任务要补的。**

### 6. 失控 + 伤害（已实现，实机触发不到）
- `checkOutOfControl()`：好感 ≤ -50 的任意对象 → 强制占两次机会 → `it_out_of_control`。
- 伤害：`calcDamage` 按战力差 + 恨意算四档概率（无伤/轻伤/重伤/死亡）。
- **同样因为好感压不下去，实机看不到。**

### 7. 唤龙（已实现）
- 玩家有 `acq_call_dragon` 后天因子，且当前是 `tier === 'critical'` 的固定事件时，固定事件选项里会多一条 `【唤龙】去应答那个呼唤`。
- **注意：现在剧本没有 critical 固定事件，所以这个选项暂时看不到。** 做 A 时可以顺手加一个 critical 事件来验证。

---

## 五、落盘工具（chat_with_state.py）现状

- 已改成 **fail-safe 落盘**：`extract_saves()` 会用 `looks_truncated()` 检查可疑截断（末行坏结尾 / 括号不配平 / 反引号奇数），**疑似截断就拒写，转存 `.pending/`**。
- 因此：**永远不会再出现"好文件被半截覆盖成坏的"**。
- `.pending/` 已自动加进 `.gitignore`，且不喂给模型。
- **单文件长度红线：≤200 行**（只针对"用本脚本一次性重发整份文件"这一种情况）。超过 200 行请拆成多个小文件——这套限制正是当初把引擎拆成 `RunEngineBase.ts` + `RunEngine.ts` 的原因。
- **例外：`script-br/src/game/engine/RunEngine.ts` 已于 2026-11-26 合并回单文件（880 行）**。如果用本脚本改它，不要整份重发（大概率输出被截断 → 被 .pending 拒绝）：优先只发改动片段，或交给没有输出长度限制的工具改这个文件。
- 如果某轮有文件被拒写，终端会打印 `❌ 拒绝写入 …`，去 `.pending/` 找到那份内容即可。

---

## 六、已知简化 / 未做（下次避雷）

1. **时间线只有 6 个月**（Y1-9 ~ Y2-2）。第 6 个月（2 月寒假）走完就 `finish()`，结局固定 `outcomes[0]`「【暂时】学期未完」。用户已确认这是 MVP 边界，**不是 bug**。
2. **结局页文案**：目前只显示标题，没强调"这是学期未完"。用户曾问过要不要改，**还没做**。可顺手加一句"第一学期 · 完，后续在做"。
3. **龙迫看不到**（好感压不到 -50）—— A 任务的核心。
4. **唤龙选项看不到**（没有 critical 固定事件）。
5. **湖面事件还是渐变占位背景**，没接真的龙的图。
6. `it_bench` / `it_rooftop` / `it_oldfloor` 没有 `effects`，也没有后果（仍是最早的占位树）。
7. `it_latenight` 依赖 `hasCrush`，但现在还没 crush 系统 → 它永远不出现在随机池。**crush 系统是更后面的事，用户之前说先做古龙线，别现在碰。**
8. `NpcDef.power` 已经写死有值；玩家 `power` 从 `identity.basePower` 起始，湖面 +10。暂无其它成长途径。
9. 单机对局不可复现（seed 来自 Date.now()），也没有"重新开始"，要刷新页面。
10. 世界因子（家族/旧楼/学业）未激活（`factorPool: []`、`factorGroups: []`）。

---

## 七、环境坑（老生常谈）

- npm 不在 PATH：必须 `& "C:\Program Files\nodejs\npm.cmd" run xxx`。
- 不要往 `code\script-br\src\` 或 `code\src\` 写代码（那是 deprecated 旧备份，用户要求保留不删、不改）。
- **新代码只写 `script-br\src\`**。
- `node_modules` 被提交进仓库了，`git status` 慢是正常的，不是卡住。
- 保存代码必须写相对项目根 `game_project` 的真实路径，如 `script-br/src/game/engine/RunEngine.ts`。

---

## 八、给下次 AI 的推荐工作顺序

1. **第一步就干 A**：在 `script1.ts` 里给固定事件加"把某 NPC 好感压到 -50"的选项（建议放在 `e_oct_walk` 的某个分支"翻脸/撕破脸/故意疏远"之类）。
2. 加完后自己跑一次 6 个月，确认：
   - 好感能到 -50；
   - 下个月主选项出现「龙迫」；
   - 龙迫后小事件变成"被盯着"；
   - 失控能触发（如果当回合好感已经 -50 且走到判定点）。
3. 如果用户想看唤龙：顺手加一个 `tier: 'critical'` 的固定事件（比如旧楼深夜 / 考试后失控），验证"唤龙"额外选项。
4. 顺手把结束文案改成「【第一学期 · 完】后续内容在做」，避免用户以为游戏坏了。
5. 以上都不涉及拆文件、不涉及概率调参。**不要主动扩展到三年**，用户没要。

---

## 九、变更记录（小日志）

- 2026-11-26：**把 `RunEngineBase.ts` + `RunEngine.ts` 合并回单文件 `RunEngine.ts`（880 行）**，`RunEngineBase.ts` 已删除；原来 `protected` 全部收回 `private`。合并前后用同一个探针跑了 10 局（含强制 -55 触发失控/龙迫），输出 415 行**逐字节一致**；typecheck / 构建通过。
- 2026-11-26：第 2.1 批完成（古龙线骨架 + 线索 + 战力 + 唤龙 + 龙迫 + 失控/伤害 + 双维度事件 + 两段抽概率 + fail-safe 落盘）。typecheck 通过，dev 能跑。
- 2026-11-26：连 VPN 后补推一次（内容不变，仅本日志加此行）。