# 项目状态

当前阶段：**阶段3 编码实现（古龙线内容迭代中）**
创建时间：2026-11-24
最近更新：2026-11-26（A/V 三池结构收口 + 因子调概率 + effects 通道；typecheck 通过）

## 进度
- [x] GDD 确认
- [x] 技术方案确认
- [x] 第 1 批：骨架 + 响应式 UI
- [x] 第 2 批：剧情引擎 + 身份系统 + 月流程 8 阶段
- [x] 第 2.1 批：古龙线骨架（湖面事件 / 线索《龙？》/ 战力 / 唤龙 / 龙迫 / 失控伤害 / 双维度事件 + 两段抽概率）
- [x] 工程整理：`RunEngineBase.ts` + `RunEngine.ts` 合并回单文件 `RunEngine.ts`（行为逐字节一致）
- [x] **A 任务：负好感路径（古龙 -40 → -50 / 封龙 -10 → -20 → -45）→ 失控（每目标一次）→ 龙迫可达；期末考试设为 critical → 唤龙可达；《锁链》封龙专属**
- [x] 死亡处理（失控致死 → `deadNpcs`：不进候选、面板"已故"、结局附言）
- [x] 好感上限改成单人（普通 100 / 龙 80），删除全局总封顶
- [x] **v9 三池模型（A/V）**：随机互动池 A / 小事件池 B / 世界事件池 C + `worldEvent` 阶段 + `weightModifiers` + 互动选项/节点 `effects`（另一个对话改的，已修好 typecheck 并补文档）
- [x] 隐患修复：同月①/②去重、`__advance__` 兜底、`docs/month_flow.md` 更新到 v2、删掉 `bondTargetId` 死逻辑
- [x] **A/V 三池结构收口（v11）**：`script/types.ts` 删世界因子占位（`FactorDef/FactorGroup/FactorRuntime/factorPool/factorGroups`、`Condition.factorActive`、`Effect.setTerminate`）；新增 `SmallEventDef`（池 B）/`WorldEventDef`（池 C）/`WeightModifier`；`Script` 加 `smallEvents`/`worldEvents`；`InteractNode/InteractChoice` 加 `effects`；`InteractEvent` 加 `weightModifiers`/`opportunityCost`
- [x] **引擎 v11**：新 phase `worldEvent`（月初抽池 C，可能抽空）；`runSmallEvent` 改从池 B 抽；`pickInteract` 走 `effectiveWeight`（档内自权重）+ `applyTierWeightMods`（档位分布）；`handleInteractChoice` 应用选项/节点 `effects`；`startInteract` 支持 `opportunityCost`；`Snapshot` 暴露 `worldEventId`；`script1.ts` 三条硬编码小事件搬进 `smallEvents`，`worldEvents: []`
- [ ] **下一步（用户已定）：继续补古龙/封龙随机事件**——情节与机制由用户给，我负责按 `weightModifiers` + `effects` 写法把文本落进 `interactEvents`；之后再做假期月（2 年 2 月）与结局线索联动
- [ ] 第 3 批：同框（samebox）机制
- [ ] 第 4 批：私人目标 + 双层目标 + 好感系统精细化
- [ ] 第 5 批：结局判定 + 局外轮回存档
- [ ] 世界因子（家族/旧楼/学业）——优先级待定
- [ ] 联网（WebSocket）——单机跑通后再做

## 可运行目录（唯一）
```
C:\Users\34903\game_project\script-br
```
启动命令：
```
cd "C:\Users\34903\game_project\script-br"
& "C:\Program Files\nodejs\npm.cmd" run dev
```
端口 5173。另有 `npm.cmd run typecheck` / `npm.cmd run build`。

## 为什么要"接引人"（2026-11-26 用户判断，供下次对话）
- 龙烬余孤（古龙 / 封龙两条线）现在的问题是：**他与任何玩家、任何 NPC 都没有关系**。玩家的"身份"再强，也悬在半空——因为它不接世界。
- 所以必须有一个**知晓他身份的人**，起"接引人"作用：他知道你是谁 / 你体内有什么，并且**他自己和别人关系很深**；通过他，龙烬余孤才被拉进这张人际网。
- 这一个人不是功能 NPC，是**拉近身份与世界的距离**的结构件。后面的线索、龙迫、唤龙、结局，最好都能顺着这条引子走。
- 判断标准：有他 / 没有他，龙烬余孤这局的"关系密度"要明显不同。

## 关于"现在做单机 + 只有龙烬余孤一个身份"（用户解释，务必保留）
- 目标是**多人剧本游戏**：龙烬余孤只是玩家**能选的身份之一**，此外还有一定数量的 NPC。
- 但现在**一步一步来**：先做单机、先只做龙烬余孤这一个身份。
- 因此：**单机 + 唯一身份是当前阶段的设计前提，不是临时权宜**。所以"没有别的玩家和我产生关系"不是 bug；补足关系密度的方式是**用 NPC 侧（尤其是接引人）把身份拉进世界**，而不是现在就接多人。
- 下次对话不要建议"先接多人/多身份来补关系密度"——方向是先靠 NPC 把单身份做厚。

## 关键决策记录（避免走回头路）
- **玄幻身份**先做一个：**龙烬余孤**；身份因子随机二选一：`seal`（封龙，人类容器）/ `ancient`（古龙，本体）。
- **不做显式身份状态机**（unaware/suspected/confirmed），靠事件选项 + 文本暗示。
- **"线"统一叫"因子"**；后天因子（如「唤龙」）= 事件获得的，开局身份因子 = 开局定的。
- **v9 A/V 模型**：因子分三类（身份/事件/信息）；事件机会三池（A 随机互动 / B 小事件 / C 世界事件，月初 `worldEvent` 阶段）；因子用 `weightModifiers`（`tierWeights` 改档位、`weightDelta` 改事件权重）调概率。旧 `factorPool/factorGroups/factorActive/setTerminate` 已删除。权威说明：[docs/state_model.md](docs/state_model.md)。
- **好感上限 = 单人上限，没有全局总封顶**：普通身份 100；**龙烬余孤 80**（`IdentityDef.npcAffinityCap`，省略时用 `Script.affinityCap`）。`addAffinity()` 超出丢弃，`applyEffectsCapped()` 统一 clamp，固定事件也绕不过。
- **死亡**：失控伤害到 `death` 档时对象进 `deadNpcs`——不进拉关系/龙迫候选、面板显示"已故"、结局附言；flag `killed:<npcId>`。
- **失控每目标一局只触发一次**（`outOfControlTargets`），否则好感跌破 -50 会月月吞掉整月。
- **龙迫**：好感 ≤ -50 才出现；每目标一次、全局最多 2 次；死者不可作为目标。
- 负好感路径已存在：古龙 `c_show_eyes`(-40) + `c_show_eyes_again`(-50)；封龙 `c_swallow`(-10) + `c_silent_cut`(-20) + `c_vent`(-45)。
- **唤龙**：期末考试已设为 `tier: 'critical'`，拥有「唤龙」时固定事件多一条【唤龙】（战力+5、g_truth+2、flag `answered_the_call`）。
- **线索**：《龙？》3 阶段（湖面必得）、《锁链》2 阶段（**封龙专属**：旧楼事件选「伸手去摸」必得）。
- **crush（在意的人）当前未接入**：`crushId` 永远为空，`it_latenight` 不会进随机池。要做得等古龙线之后重新加（之前 v7 做过一版，被覆盖了）。
- **因子三分法（按获得途径，权威见 docs/state_model.md）**：身份因子（开局选，如「龙烬余孤」→ `seal`/`ancient`）/ 事件因子（事件获得，如「唤龙」，存 `acquiredFactors`）/ 信息因子（月/好感/战力/flag/目标进度）。**「古龙」「封龙」是普通因子，不是身份**；代码里 `identityFactor` 字段即"普通因子"，命名是历史遗留，暂不改。
- **A/V 模型**：A=因子，V=事件发生的机会（三个发生点：V1 随机互动池 A / V2 小事件池 B / V3 月初世界事件池 C）。三池都支持 `weightModifiers`（`tierWeights` 改档位分布 / `weightDelta` 改档内权重）。世界因子概念已删除。
- **引擎单文件**：`engine/RunEngine.ts`（约 950 行）。拆分是为了绕开"单次写入长度限制"，不是设计需要；用有输出上限的模型改它时注意别整份重发，改用 PATCH。
- 世界因子（家族/旧楼/学业）本批**不激活**。
- `code\src\` / `code\client\` **保留不删**（用户要求），标注 deprecated 即可，不要改它们。
- **新代码只写 `script-br\src\`**，绝不写 `code\script-br\src\`。

## 详见
完整交接看 `PROGRESS.md`（下次开工第一件事 / 已完成能力 / 已知简化 / 环境坑）。
