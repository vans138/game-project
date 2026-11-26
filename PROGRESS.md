# 项目进度日志

## 基本信息
- 项目：剧本吃鸡（多人共享剧本 · 轮回养成 · 纯文本）
- 阶段：阶段3 编码实现（进行中）
- 当前批次：**A/V 三池结构收口（v11）已完成，typecheck 通过**；上一批古龙线内容（负好感 / 失控 / 唤龙 / 《锁链》 / 死亡 / 单人好感上限）已完成
- 更新日期：2026-11-26

---

## 一、下次开工第一件事（最重要，必读）

### 现状：A 任务（负好感路径）已经做完，古龙线已经"能玩到"。

用户当前的方向：**继续补充古龙线**（内容为主，不扩三年、不接 crush/同框）。

### A 任务已完成，实机可验证
1. 有选项能把某个 NPC 的好感压到 **≤ -50**：
   - 古龙：开学典礼 `c_show_eyes` -40 → 十月 `c_show_eyes_again` -50 → 邱同学 -70
   - 封龙：`c_swallow` -10 → `c_silent_cut` -20 → 十二月 `c_vent` -45 → -55
2. 跌破 -50 的当月会触发一次**失控**（`it_out_of_control` + 伤害概率），**每个对象只失控一次**。
3. 下个月主选项出现「龙迫」，选目标后：反馈写明"TA 本月的行动被压下去了"，小事件被替换成"无时无刻的注视"。
4. 期末考试已设为 `tier: 'critical'`：拥有「唤龙」时固定事件里会多出【唤龙】选项，选了战力 +5、目标进度 +2、flag `answered_the_call`。
5. 第二条线索《锁链》**封龙专属**：旧楼事件选「伸手，隔着门去摸」必得（不再走随机分支），可调查 2 阶段；古龙拿不到。

### 下一步建议（按用户"继续补古龙线"的方向）
1. **做古龙/封龙的随机事件（当前主任务）**：情节与机制效果由用户给，AI 只负责按 `weightModifiers` + `effects` 写法把文本创作落进 `interactEvents`（事件挂的是"因子"，用 `requires.identityFactor`）。结构已就绪，见 §九。
2. **假期月（Y2-2）**：目前只是 `holidaySkip` 占位，假期月的玩法尚未设计，等用户定。
3. **让《龙？》《锁链》真正影响结局**：现在结局固定 `outcomes[0]`，线索查清与否不影响任何东西。可先做最简单的：按线索完成数给不同结局文案。
4. **（已修）同月①/②重复抽同一事件**：`MonthRuntime.usedEventIds` 去重已落地；用户决定等事件足够多后再复查体感。
<<<END>>

<<<PATCH:PROGRESS.md>>>

### 已知的坑（别踩）
- `enforceAffinityCap()` **只管正向**：负向不会被裁剪，能到 -50 甚至更低。
- 好感总计面板 `affinityTotal` 只累加正向；负好感会显示成负数，这是预期。
- 失控的伤害可能是"死亡"档，但引擎没有死亡状态：死掉的 NPC 之后仍会出现在好感面板/龙迫候选里。这是已知简化。


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
    RunEngine.ts       # 【单文件引擎】state/月份流程（含 worldEvent）/主选项/调查/龙迫/小事件池/
                       #   失控/随机互动抽取（三池 + 因子调权重）/湖面结算/视图/choose/订阅
    balance.ts         # 所有概率与数值常量（事件三档基准、结果两侧基准、龙迫加成、小事件、伤害）
    modifiers.ts       # 概率调制内核：baseTierWeights/applyTierModifier/normalizeTier/pickTier
                       #               baseSideWeights/applySideModifier/normalizeSide/pickSide
    evaluator.ts       # evalCondition + applyEffects（含 powerDelta / acquireFactor / gainClue）
    damage.ts          # calcDamage + damageNarrative（无伤/轻伤/重伤/死亡）
    clues.ts           # acquireClue / investigateClue / listInvestigable / ClueRuntime
    rng.ts             # 种子随机 mulberry32

  script/
    types.ts           # 剧本类型 v9：A/V 三池模型（interactEvents / smallEvents / worldEvents）
                       #   + WeightModifier（tierWeights / weightDelta）+ InteractChoice/Node.effects
    script1.ts         # 第一份剧本（Y1-9 ~ Y2-2，6 个月；池 B 3 条，池 C 空）

docs/
  month_flow.md        # 月度流程 v2（v9 三池模型，与代码同步；状态模型见 state_model.md）
  state_model.md       # 【重要】A/V 状态模型 v9：因子分类、三池、加权、阶段顺序、与 v8 的差异
```

**外部依赖不变**：`LocalSource.ts` 只 `import { RunEngine, type Snapshot } from './engine/RunEngine'`。拆文件时不要改这个入口。

---

## 四、已经做成的能力（累计）

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

### 4. 线索系统（已落地）
- `ClueDef` 多阶段；《龙？》3 阶段（湖面事件必得），《锁链》2 阶段（**封龙专属**：旧楼事件选「伸手去摸」必得）。
- 主选项里有「调查线索（N 条可查）」，每查一次推进一阶段；状态面板显示 `stage/total`。

### 5. 龙迫机制（实机可达）
- 主选项检测好感 ≤ -50 → 出现「龙迫」；每目标一次 / 全局最多 2 次。
- 效果：小事件换成"被人盯着"，标记 `coerceState`。
- 负好感路径（2026-11-26 补）：
  - 开学典礼：`c_push_away` -25（共通）/ `c_swallow` -10（封龙）/ `c_show_eyes` -40（古龙）
  - 十月操场：`c_cut` -30（共通）/ `c_silent_cut` -20（封龙）/ `c_show_eyes_again` -50（古龙）
  - 十二月初雪：`c_vent` -45（封龙）/ `c_answer_snow` 战力+5（古龙）

### 6. 失控 + 伤害（实机可达，每目标一次）
- `checkOutOfControl()`：好感 ≤ -50 的任意对象 → 强制占两次机会 → `it_out_of_control`。
- **2026-11-26 修**：加了 `outOfControlTargets`，每个对象一局只失控一次；否则好感一旦跌破 -50，会月月吞掉整月（实测 M2~M5 连触 4 次）。
- 伤害：`calcDamage` 按战力差 + 恨意算四档概率（无伤/轻伤/重伤/死亡）。

### 7. 唤龙（实机可达）
- 玩家有 `acq_call_dragon` 后天因子，且当前是 `tier === 'critical'` 的固定事件时，选项里多一条 `【唤龙】去应答那个呼唤`。
- **期末考试已设为 `tier: 'critical'`**（第一个危急事件）；选【唤龙】→ 战力 +5、g_truth +2、flag `answered_the_call`。

### 8. 结局文案（2026-11-26 改）
- `outcomes[0]` 改为「【第一学期 · 完】」，正文写了"体内那个东西还在 / 后续内容在做"，避免玩家以为游戏坏了。

### 9. 好感上限（2026-11-26 改：去掉总封顶，只留单人上限）
- **没有全局总封顶**。只有"单人好感上限"：普通身份 100，**"龙"（龙烬余孤）80**——没人能和一条龙真正亲近到 100。
- 配置位：`IdentityDef.npcAffinityCap`（省略则用 `Script.affinityCap`，默认 100）；当前剧本身份里写的 80。
- `addAffinity()`：加好感后直接夹到单人上限（超出丢弃），负向照常、不低于 0。
- `applyEffectsCapped()`：所有效果结算后统一 `clampAffinityToCap()`，固定事件也绕不过上限。
- 面板文案：`好感总 X · 单人上限 80`（X 是所有人正向上的和，没有上限）。

### 10. 死亡处理（2026-11-26）
- 失控的伤害判定为 `death` 时：把对象加入 `deadNpcs`、打 flag `killed:<npcId>`、月志写【死亡 · XX】+ 收尾叙述。
- 死者：不再出现在「拉近关系」列表，不再进「龙迫」候选，不再参与失控判定；状态面板显示"已故"。
- 结局附言："这个学期，XX 没能走到最后。"

### 12. A/V 三池结构收口（v11，2026-11-26 本轮）
- **`script/types.ts`**：删世界因子占位（`FactorDef` / `FactorGroup` / `FactorRuntime` / `Script.factorPool` / `Script.factorGroups` / `Condition.factorActive` / `Effect.setTerminate`）；新增 `SmallEventDef`（池 B）、`WorldEventDef`（池 C）、`WeightModifier`；`InteractNode`/`InteractChoice` 加 `effects?: Effect[]`；`InteractEvent` 加 `weightModifiers?` / `opportunityCost?: 0|1|2`；`Script` 加 `smallEvents` / `worldEvents`。
- **`engine/RunEngine.ts`**：`MonthPhase` 加 `worldEvent`；`RunState` 加 `worldEventId` / `firedWorldEvents`；`enterMonth` 调 `rollWorldEvent()`（抽中进 `worldEvent` phase）；新增 `effectiveWeight()`（档内自权重）/ `applyTierWeightMods()`（档位分布）；`pickInteract` 两处改用新工具；`startInteract` 支持 `opportunityCost`；`handleInteractChoice` 三处应用 `effects`（选项 / byMutual-byOneSide 节点 / 单节点）；`runSmallEvent` 改从 `smallEvents` 抽；`buildPhaseView` / `choose` 加 `worldEvent` 分支；`Snapshot` 暴露 `worldEventId`。
- **`engine/evaluator.ts`**：删 `factorActive` 分支。
- **`script/script1.ts`**：删 `factorPool` / `factorGroups` 与 import；三条硬编码小事件搬进 `smallEvents`；`worldEvents: []`。
- **`GameView.ts` / `LocalSource.ts`**：透传 `worldEventId`。
- **验证**：`npm run typecheck` 通过。因为 `worldEvents: []`、`weightModifiers` 无人使用，**实机行为与 v10 一致**。

### 11. v9 A/V 三池模型（2026-11-26 落地，由另一个对话改的）
<<<END>>
- 因子分三类：**身份因子**（开局身份）/ **事件因子**（事件获得，如唤龙）/ **信息因子**（月/好感/战力/flag/目标进度）。
- 事件机会三池：
  - **V1 随机互动池 A** `interactEvents`（机会①/②；`opportunityCost` 可覆盖占几次）
  - **V2 小事件池 B** `smallEvents`（主选项后抽，可能抽空）
  - **V3 世界事件池 C** `worldEvents`（月初抽；新增 `worldEvent` 阶段；`once` 默认 true）
- 因子调概率：池条目可挂 `weightModifiers`（`when` 条件 + `tierWeights` 改档位分布 + `weightDelta` 改同档内权重）。
- 互动选项/节点可带 `effects`（选中时 / 进入节点时执行）。
- 删除：`Script.factorPool` / `factorGroups` / `FactorDef` / `FactorGroup`、`Condition.factorActive`、`Effect.setTerminate`。
- **权威说明见 [docs/state_model.md](docs/state_model.md)**；月度顺序见 [docs/month_flow.md](docs/month_flow.md)（v2，已同步）。
- **现状**：池 C `worldEvents: []`（V3 实机暂时不会出现）；`weightModifiers` 还没有任何剧本条目使用。

---

## 五、落盘工具（chat_with_state.py）现状

### 1. SAVE：整份写
- `extract_saves()` 会用 `looks_truncated()` 检查可疑截断（末行坏结尾 / 括号不配平 / 反引号奇数），**疑似截断就拒写，转存 `.pending/`**。
- `.pending/` 已自动加进 `.gitignore`，且不喂给模型。

### 2. PATCH：增量改（2026-11-26 新增）
- 格式：
  ```
  <<<PATCH:相对路径>>>
  <<<OLD>>>
  逐字复制的原文（含缩进）
  <<<NEW>>>
  替换后的内容
  <<<END>>>
  ```
- 一个 PATCH 块里可以连续写多组 OLD/NEW；一次回复可以写多个 PATCH 块（同一文件按顺序执行）。
- OLD 必须逐字一致、且在整个文件里**只出现一次**；找不到或匹配到多处 → 拒绝，文件不会被改动。
- `.py` 改完自动 `compile()` 校验，`.json` 改完自动 `json.loads()` 校验；失败**回滚不落盘**。
- 文件不存在会提示改用 SAVE；含 `..` 的路径直接拒绝。
- CRLF 文件按原换行符写回，不会把整个文件改成 LF。

### 3. 长度限制与红线
- **单文件长度红线 ≤200 行**，只针对"用 SAVE 一次性重发整份文件"这一种情况。超过 200 行请拆成多个小文件——这套限制正是当初把引擎拆成 `RunEngineBase.ts` + `RunEngine.ts` 的原因。
- **改大文件请用 PATCH**：`RunEngine.ts` 现在约 950 行，用 PATCH 只写变动片段即可，不需要整份重发。

### 4. 两个已修的坑（别踩回去）
- **续写标记自毁**：以前 `replace("<<<MORE>>>", "")` 对整条回复生效，模型写本脚本源码时会把源码里的标记一起删掉 → `has_more` 恒真 → 无限请求、永远不回话。现在检测/剥离只作用于 SAVE/PATCH 块之外，并且续写最多 8 段。
- **UTF-8 控制台**：Windows 控制台默认 GBK，`print` 遇到 ❌ / 🐉 会 `UnicodeEncodeError` 崩掉；启动时已把 stdout/stderr 切成 UTF-8。
- 如果某轮有文件被拒写，终端会打印 `❌ 拒绝写入 …`，去 `.pending/` 找到那份内容即可。

### 5. 上下文装配（2026-11-26 收紧）
- **不再喂 deprecated 目录**：`code/`、`script-br-patch/` 已加入 `SCAN_SKIP_DIRS`。`code/chat.py` 里还带着旧 prompt（`<<<SAVE:code/文件名>>>`），喂进去会把下一个 AI 带偏。
- **不喂锁文件**：`package-lock.json` / `pnpm-lock.yaml` / `yarn.lock`（两个 lock 就 12 万字符）。
- **总预算**：`CTX_BUDGET = 260_000` 字符，超出按顺序省略并在文末标注被省略的文件。
- 实测：上下文从 **344k 字符 / 60 个文件** 降到 **130k 字符 / 28 个文件**。
- `SYSTEM_PROMPT` 顶部新增【项目现状】：写明已在阶段3、唯一在跑的是 `script-br/`、`code/` 是 deprecated、当前方向是古龙线；并明确"不要回阶段1/2 重确认 GDD"。

---

## 六、已知简化 / 未做（下次避雷）

1. **（已修）同月①/②重复**：`pickInteract` 现在排除本月已抽过的 id（`MonthRuntime.usedEventIds`）。
2. **时间线只有 6 个月**（Y1-9 ~ Y2-2）。第 6 个月（2 月寒假）走完就 `finish()`，结局固定 `outcomes[0]`「【第一学期 · 完】」。用户已确认这是 MVP 边界，**不是 bug**。
3. **结局与线索/目标无关**：查清《龙？》《锁链》目前不改变结局，也没有"私人目标完成度"判定。
4. **湖面事件还是渐变占位背景**，没接真的龙的图。
5. `it_bench` / `it_rooftop` / `it_oldfloor` 仍没有 `effects`（旧楼对封龙多给一条《锁链》），交互本身不改变好感/目标。
6. `it_latenight` 依赖 `hasCrush`，但还没 crush 系统 → 永远不出现在随机池。**crush 是更后面的事，先别碰。**
7. `NpcDef.power` 写死；玩家 `power` 从 `identity.basePower` 起始，湖面 +10、唤龙 +5、古龙两个选项再各 +5。暂无其它成长途径。
8. 单机对局不可复现（seed 来自 `Date.now()`），也没有"重新开始"，要刷新页面。
9. 世界事件池 C 是空的（`worldEvents: []`），所以 `worldEvent` 阶段实机不会出现；池 B 只有 3 条（黑鸟/纸条/头晕）；`weightModifiers` 还没有任何条目使用。
10. 死亡已处理（`deadNpcs`：不进拉关系/龙迫候选、面板显示"已故"、结局附言），但**已故者仍可能被固定事件的 effects 加好感**（面板显示"已故"，不影响别人）。另外目前只有 `e_oct_walk` 会提到邱同学，且死亡发生在其后，所以暂时没有"事件里出现死人"的问题。
11. `valence` 字段仍然没有任何地方读取；`Choice.outcomes` 也还没被剧本使用（固定事件结果仍走 `effects`）。
12. `GameScreen` 在没有选项时会发 `__advance__`：引擎已加兜底映射（worldEvent/intro/feedback/smallEvent/interact/summary/holidaySkip/fixedEvent），不会再卡死。


---

## 七、环境坑（老生常谈）

- npm 不在 PATH：必须 `& "C:\Program Files\nodejs\npm.cmd" run xxx`。
- 不要往 `code\script-br\src\` 或 `code\src\` 写代码（那是 deprecated 旧备份，用户要求保留不删、不改）。
- **新代码只写 `script-br\src\`**。
- `node_modules` 被提交进仓库了，`git status` 慢是正常的，不是卡住。
- 保存代码必须写相对项目根 `game_project` 的真实路径，如 `script-br/src/game/engine/RunEngine.ts`。

---

## 八、给下次 AI 的推荐工作顺序

A 任务已完成（负好感路径 / 失控 / 龙迫 / 唤龙 / 第二线索），**不要再重做**。下一步按"继续补古龙线"：

1. 池 B/C 填内容：让"小事件"和"世界事件"真正参与古龙线（现在池 C 是空的）。
2. **给古龙线加事件**：现在 6 个月只有 5 个固定事件，古龙线的推进感不够。建议加"十一月 · 裂痕"或"一月 · 旧楼夜"，把《锁链》的线索来源从随机互动挪一部分到固定事件里（固定事件更可控）。
3. **让线索影响结局**：最简单的版本——结局按《龙？》《锁链》的完成数给 3 档文案（都不查清 / 查清一条 / 两条都查清），不需要做完整结局系统。
4. 想扩周期也先问用户：**不要自作主张扩到三年**。

---

## 九、变更记录（小日志）

- 2026-11-26：**隐患修复**：①同月随机互动①/②去重（`MonthRuntime.usedEventIds`，实测 200 局 0 次重复）；②`docs/month_flow.md` 重写为 v2（补 worldEvent、池 A/B/C、去重、weightModifiers、opportunityCost、chance）；③删掉 `bondTargetId` 与小事件里那条"在意的人"死分支（crush 已移除，逻辑永远不成立）。
- 2026-11-26：**接住另一个对话的 v9 三池重构并修好**：`GamePhase` 补 `worldEvent`、`script1.ts` 删掉残留的 `factorPool/factorGroups`（4 个 typecheck 错误）；补 `__advance__` 兜底；新增 [docs/state_model.md](docs/state_model.md)（A/V 模型权威说明）；PROGRESS/project_state 同步 v9 结构。实测 fuzz 300 局无异常、世界事件/小事件池均可用、古龙线龙迫（seed 1 因邱死亡所以无龙迫，属正确行为）。
- 2026-11-26：**提示语/上下文更新（防止下一个 AI 以为还在旧阶段）**：SYSTEM_PROMPT 顶部加【项目现状】（阶段3、唯一在跑 script-br、code/ deprecated、当前方向古龙线、不要回阶段1/2）；去掉 `SAVE:code/` 旧示例；把 `code/`、`script-br-patch/` 和锁文件从喂入上下文里剔除；新增 260k 字符总预算。实测上下文 344k→130k 字符、60→28 个文件。
- 2026-11-26：**《锁链》改成封龙专属**：古龙分支不再给；封龙选「伸手，隔着门去摸」时两个结果节点都带 gainClue，所以**必得**（原来挂在 60% 的 byMutual 上，实机很难看见）。实测封龙 200/200 拿到、古龙 0/200。
- 2026-11-26：**好感上限改成"单人上限"**：删除全局总封顶（用户确认那不是原意）；普通身份单人 100、龙烬余孤 80（`IdentityDef.npcAffinityCap`）。`addAffinity()` 超出丢弃、`applyEffectsCapped()` 统一 clamp，固定事件也绕不过。面板改为「好感总 X · 单人上限 80」。实测 8 人各 80、总量 640 不报错。
- 2026-11-26：**死亡处理**：失控致死时 `deadNpcs` 生效（不进拉关系/龙迫候选、面板"已故"、结局附言、flag `killed:<npcId>`）。
- 2026-11-26：**古龙线内容补齐（A 任务完成）**：加负好感路径（开学 -25/-40/-10、十月 -30/-50/-20、十二月 -45）、期末考试设为 critical（唤龙可达，选后战力+5/目标+2/flag）、第二条线索《锁链》（封龙专属，旧楼事件获得、2 阶段、可调查）、结局文案改「第一学期 · 完」；修掉失控月月重复触发（改为每目标一次）。实测：古龙 M2 跌破 -50 → 失控一次 → M3 龙迫；封龙 M4 跌破 → M5 龙迫；200 局 fuzz 无异常。
- 2026-11-26：`chat_with_state.py` 增加 **PATCH 增量修改**（`<<<PATCH:path>>>` + OLD/NEW 锚点替换）：支持多组、多块、唯一性校验、.py/.json 自动校验回滚、CRLF 保留；同时把续写标记的保护范围扩到 PATCH 块，修掉 GBK 控制台 emoji 崩溃。
- 2026-11-26：**把 `RunEngineBase.ts` + `RunEngine.ts` 合并回单文件 `RunEngine.ts`（880 行）**，`RunEngineBase.ts` 已删除；原来 `protected` 全部收回 `private`。合并前后用同一个探针跑了 10 局（含强制 -55 触发失控/龙迫），输出 415 行**逐字节一致**；typecheck / 构建通过。
- 2026-11-26：第 2.1 批完成（古龙线骨架 + 线索 + 战力 + 唤龙 + 龙迫 + 失控/伤害 + 双维度事件 + 两段抽概率 + fail-safe 落盘）。typecheck 通过，dev 能跑。
- 2026-11-26：连 VPN 后补推一次（内容不变，仅本日志加此行）。
