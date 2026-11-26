# 项目进度日志

## 基本信息
- 项目：剧本吃鸡（多人共享剧本 · 轮回养成 · 纯文本）
- 阶段：阶段3 编码实现（进行中）
- 当前批次：**第 2.1 批「古龙线骨架」已完成、能跑通、typecheck 通过**
- 更新日期：2026-11-26（连 VPN 后补推一次）

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
5. 第二条线索《锁链》可从旧楼事件获得（需要在"门认出你"的分支），可调查 2 阶段。

### 下一步建议（按用户"继续补古龙线"的方向）
1. **给古龙线加新月份/新事件**：目前只有 6 个月、5 个固定事件，古龙线的"推进感"主要靠文本。可加 1~2 个事件（十一月裂痕 / 一月旧楼夜）。
2. **让《龙？》《锁链》真正影响结局**：现在结局固定 `outcomes[0]`，线索查清与否不影响任何东西。可先做最简单的：按线索完成数给不同结局文案。
3. **修两个已知回归**（见 §六 第 1、2 条）：好感封顶会倒扣历史值、同月①/②会重复抽同一事件。不修的话古龙线的数值体感会被污染。

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

### 4. 线索系统（已落地）
- `ClueDef` 多阶段；《龙？》3 阶段（湖面事件必得），《锁链》2 阶段（旧楼事件"门认出你"的分支获得）。
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
- **改大文件请用 PATCH**：`RunEngine.ts` 现在 880 行，用 PATCH 只写变动片段即可，不需要整份重发。

### 4. 两个已修的坑（别踩回去）
- **续写标记自毁**：以前 `replace("<<<MORE>>>", "")` 对整条回复生效，模型写本脚本源码时会把源码里的标记一起删掉 → `has_more` 恒真 → 无限请求、永远不回话。现在检测/剥离只作用于 SAVE/PATCH 块之外，并且续写最多 8 段。
- **UTF-8 控制台**：Windows 控制台默认 GBK，`print` 遇到 ❌ / 🐉 会 `UnicodeEncodeError` 崩掉；启动时已把 stdout/stderr 切成 UTF-8。
- 如果某轮有文件被拒写，终端会打印 `❌ 拒绝写入 …`，去 `.pending/` 找到那份内容即可。

---

## 六、已知简化 / 未做（下次避雷）

1. **好感封顶会倒扣历史值（回归，待修）**：`enforceAffinityCap()` 仍然按比例回缩全部正向好感；而且只在一处调用，固定事件的 `applyEffects` 完全绕过封顶（实测总量能到 102 > 100）。修法：改成"只限制新增"，并在所有加好感的地方统一走同一个函数。
2. **同月①/②会抽到同一个随机事件（回归，待修）**：`pickInteract` 没有"本月已抽过"的去重（实测 200 局里 175 局出现）。修法：`MonthRuntime` 加 `usedEventIds`，②的池子排除①抽过的。
3. **时间线只有 6 个月**（Y1-9 ~ Y2-2）。第 6 个月（2 月寒假）走完就 `finish()`，结局固定 `outcomes[0]`「【第一学期 · 完】」。用户已确认这是 MVP 边界，**不是 bug**。
4. **结局与线索/目标无关**：查清《龙？》《锁链》目前不改变结局，也没有"私人目标完成度"判定。
5. **湖面事件还是渐变占位背景**，没接真的龙的图。
6. `it_bench` / `it_rooftop` / `it_oldfloor` 仍没有 `effects`（旧楼只是多给一条《锁链》），交互本身不改变好感/目标。
7. `it_latenight` 依赖 `hasCrush`，但还没 crush 系统 → 永远不出现在随机池。**crush 是更后面的事，先别碰。**
8. `NpcDef.power` 写死；玩家 `power` 从 `identity.basePower` 起始，湖面 +10、唤龙 +5、古龙两个选项再各 +5。暂无其它成长途径。
9. 单机对局不可复现（seed 来自 `Date.now()`），也没有"重新开始"，要刷新页面。
10. 世界因子（家族/旧楼/学业）未激活（`factorPool: []`、`factorGroups: []`）。
11. 伤害可能出"死亡"档，但引擎没有死亡状态：死掉的 NPC 之后仍会出现在面板/龙迫候选里。
12. `valence` 字段仍然没有任何地方读取；`Choice.outcomes` 也还没被剧本使用。


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

1. **修两个回归**（做内容之前先修，否则数值体感是坏的）：好感封顶只限新增、同月①/②去重（详见 §六 1、2）。
2. **给古龙线加事件**：现在 6 个月只有 5 个固定事件，古龙线的推进感不够。建议加"十一月 · 裂痕"或"一月 · 旧楼夜"，把《锁链》的线索来源从随机互动挪一部分到固定事件里（固定事件更可控）。
3. **让线索影响结局**：最简单的版本——结局按《龙？》《锁链》的完成数给 3 档文案（都不查清 / 查清一条 / 两条都查清），不需要做完整结局系统。
4. 想扩周期也先问用户：**不要自作主张扩到三年**。

---

## 九、变更记录（小日志）

- 2026-11-26：**古龙线内容补齐（A 任务完成）**：加负好感路径（开学 -25/-40/-10、十月 -30/-50/-20、十二月 -45）、期末考试设为 critical（唤龙可达，选后战力+5/目标+2/flag）、第二条线索《锁链》（旧楼事件获得、2 阶段、可调查）、结局文案改「第一学期 · 完」；修掉失控月月重复触发（改为每目标一次）。实测：古龙 M2 跌破 -50 → 失控一次 → M3 龙迫；封龙 M4 跌破 → M5 龙迫；200 局 fuzz 无异常。
- 2026-11-26：`chat_with_state.py` 增加 **PATCH 增量修改**（`<<<PATCH:path>>>` + OLD/NEW 锚点替换）：支持多组、多块、唯一性校验、.py/.json 自动校验回滚、CRLF 保留；同时把续写标记的保护范围扩到 PATCH 块，修掉 GBK 控制台 emoji 崩溃。
- 2026-11-26：**把 `RunEngineBase.ts` + `RunEngine.ts` 合并回单文件 `RunEngine.ts`（880 行）**，`RunEngineBase.ts` 已删除；原来 `protected` 全部收回 `private`。合并前后用同一个探针跑了 10 局（含强制 -55 触发失控/龙迫），输出 415 行**逐字节一致**；typecheck / 构建通过。
- 2026-11-26：第 2.1 批完成（古龙线骨架 + 线索 + 战力 + 唤龙 + 龙迫 + 失控/伤害 + 双维度事件 + 两段抽概率 + fail-safe 落盘）。typecheck 通过，dev 能跑。
- 2026-11-26：连 VPN 后补推一次（内容不变，仅本日志加此行）。