# 项目进度日志

## 基本信息
- 项目：剧本吃鸡（多人共享剧本 · 轮回养成 · 纯文本）
- 阶段：阶段3 编码实现（进行中）
- 当前批次：**第 2.1 批「crush 系统 + "她"的完整分叉树 + 两处地基修复」已完成，能跑通**
- 更新日期：2026-11-26（本版）

---

## 一、真实可运行目录（极其重要，必读）

**真正在跑的入口**：
```
C:\Users\34903\game_project\script-br\
```

**启动命令**（本机 npm 不在 PATH，必须用完整路径）：
```powershell
cd "C:\Users\34903\game_project\script-br"
& "C:\Program Files\nodejs\npm.cmd" run dev
```
- Vite dev 端口：**5173**
- 浏览器：`http://localhost:5173`

**类型检查 / 构建**（v7 起有了门禁）：
```powershell
& "C:\Program Files\nodejs\npm.cmd" run typecheck   # tsc --noEmit
& "C:\Program Files\nodejs\npm.cmd" run build       # tsc --noEmit && vite build
```

**项目根不是 `C:\Users\34903\script-br`（那个不存在），而是 `C:\Users\34903\game_project`。**

---

## 二、目录结构与两套代码的关系（关键，别搞混）

`C:\Users\34903\game_project\` 下并存几个"看起来像项目"的东西：

| 路径 | 状态 | 说明 |
|---|---|---|
| **`script-br\`** | ✅ **唯一真在跑的主线** | 入口 `main.tsx` / `App.tsx` / `index.html` 齐全，依赖已装 |
| `code\script-br\` | ⚠️ 旧版备份 | 早期写在这里，缺 `main.tsx` 入口，单独跑不起来；内容 ≈ `script-br\` 的 v6 |
| `code\src\` | ⚠️ 早期试验版 | v1 试验数据模型，**没有因子/互斥组**，跟正式版结构不同，当"图纸"看 |
| `code\client\` | ⚠️ 早期试验版 | 同 `code\src\`，更小的一套 |
| 顶层 `package.json` / `vite.config.ts` / `index.html` / `tsconfig.json` | ⚠️ 空壳 | **没有 `src\` 目录**，`npm run dev` 白屏；别从这里启动 |

**用户已明确要求**：`code\client\` 与 `code\src\` **保留不删**，只标注 deprecated。早期试验版**永远不要修改、不要 import 到主线**。

**新代码只写 `script-br\src\`，绝不要再写 `code\script-br\src\`**（那是上一轮的错误，已迁移完毕）。

---

## 三、当前主线代码结构（`script-br\src\`）

```
script-br/
  index.html
  package.json           # dev / typecheck / build
  tsconfig.json          # 已开 allowImportingTsExtensions
  vite.config.ts
  src/
    main.tsx
    App.tsx              # 只用 createLocalSource + GameScreen
    game/
      GameView.ts        # UI 只读快照 + GameSource 接口（v6，新增 crushName）
      LocalSource.ts     # 单机数据源（v6）：选身份 → 选"在意的人" → RunEngine → GameView
      GameScreen.tsx     # 局内 UI（v6，关系面板显示"在意 · XX"）
      styles.css         # 响应式样式（v6）
      engine/
        RunEngine.ts     # 月流程 8 阶段状态机 + 身份 + crush + 随机互动树（v7）
        evaluator.ts     # 条件求值 + 效果结算（v6，支持 identityFactorIs）
        rng.ts           # 种子随机（mulberry32）
      script/
        types.ts         # 剧本类型 v7（InteractRequires.crushAffinityAtLeast / InteractChoice.effects / InteractEvent.mutual）
        script1.ts       # 剧本 v7（Y1-9 ~ Y2-2，5 固定事件 + 4 随机互动，含"她"的完整分叉树）
```

---

## 四、第 2.1 批已完成的能力（跑起来可验证）

### 1. crush（在意的人）系统
- ✅ 开局**两步选择**：先选玄幻身份（龙烬余孤）→ 再选"在意的人"（8 个常驻 NPC 任选，含关系标签）
- ✅ 选定后写入 `player.crushId`，关系面板显示"在意 · XX"
- ✅ **`byMutual` 不再是抛硬币**：剧本用 `mutual: { from: 'crush', threshold: 30 }` 声明判定来源，达到阈值才走"双方主动"分支（实测 29 → false，30 → true）
- ✅ 没有 `mutual` 规则的事件（如旧楼那扇门）才退回 0.6 随机

### 2. "她"的完整分叉树（`it_latenight`）
用户口述的结构已完整实现：
```
晚自习 → 去看看 → 她在？ ┬ 在 → 主动找 TA（双方主动/单方） / 看一眼就走 / 敲门（好感≥40）
                         └ 不在 → 站一会儿/直接走 → 校门口 → 遇到？ ┬ 遇到 → 主动找 TA（双方主动/单方）/ 看一眼离开
                                                                  └ 没遇到 → 一个人回宿舍
```
- ✅ 文本用 `{crush}` 占位，运行时替换成玩家选定的人名（300 局随机实测 0 次残留占位符）
- ✅ 选项效果用 `target: '$crush'`，同一棵树套在任何 NPC 上都成立
- ✅ 支持 `chance` 概率节点（"她在不在" 0.55、"校门口遇不遇到" 0.45）——这个 schema 之前一直没实现
- ✅ 随机互动**选项终于能生效**：`InteractChoice.effects` 可加好感 / flag / 目标进度 / 日志
- ✅ 进池门槛：`requires.crushAffinityAtLeast`；没选 crush 时 `it_latenight` 永不出现（实测 0 次）

### 3. 两处地基修复（顺手做掉，避免新内容被污染）
- ✅ **好感总封顶改为"只限新增"**：旧实现按比例回缩已有好感，实测"每月都拉邱同学"会出现 total 100→96、邱 33→32→29；现在只把剩余额度给新增，历史值不动（实测全程拉同一个人：0 次下降、峰值 100）
- ✅ **同月随机互动 ①/② 去重**：旧实现 300 局里 266 局（89%）同月抽到同一个事件；现在 200 局 0 次
- ✅ `__advance__` 兜底：任意阶段选项被条件过滤空时，"推进"按钮会真正推进阶段，不再软锁
- ✅ 小事件"负向权重 > 正向"真正生效：学习时若在意的人好感 < 10，`p` 额外 -0.4（旧代码该分支引用了永远为 undefined 的 `bondTargetId`，是死代码）

### 4. 工程门禁
- ✅ `tsconfig.json` 补 `allowImportingTsExtensions`（`main.tsx` 引 `./App.tsx` 以前直接 TS5097）
- ✅ `package.json` 增加 `typecheck` / `build` 脚本
- ✅ 本批验证：`tsc --noEmit` 通过；`vite build` 通过；800+ 局引擎模拟（含 500 局随机 fuzz）0 异常

---

## 五、已知简化与未做的（下一批的活）

### 1. 同框（samebox）还是空的
`EventDef.kind` 有 `samebox`，引擎未接；`MonthDef` 里也没有同框配置。用户说过"要做，但先专注个人"，**这是第 3 批**。

### 2. 世界因子（家族/旧楼/学业）未激活
`factorPool: []`、`factorGroups: []`，`EvalContext.activeFactors` 恒为空集。按用户指示本批不做。

### 3. 只有 6 个月，没有三年
时间线是 Y1-9 ~ Y2-2（[script1.ts](script-br/src/game/script/script1.ts)），到寒假就 `finish()`。
结局固定 `outcomes[0]`（"【暂时】学期未完"），`minGoalRatio` / 私人目标完成度 / 关系结局都没接。

### 4. 8 个 NPC 只有 4 个有戏
林老师 / 邱同学 / 月亮学姐 / 何老师 在固定事件里有互动；姚主任 / 沈星河 / 江晴 / 顾伯 目前只能靠主选项"拉近关系"碰。
主选项一次列出 9 个按钮（学习 + 8 个 NPC），手机端要滚。

### 5. `it_bench` / `it_rooftop` / `it_oldfloor` 仍然没有状态后果
它们没有配 `effects`（本批只给"她"的树配了）。三个事件里 `it_bench` 权重 3，独占约 43% 抽取。

### 6. 其它 schema 空壳
`MonthDef.stepCount` / `silentStudy`、`Role` / `identityTags` / `hasIdentity`、`evaluator` 的 `setTerminate` / custom 条件、`OutcomeDef.minGoalRatio`、`GameView` 的 `year` / `monthOfYear` / `phase` / `outcomeNarrative` —— 都还没用上。

### 7. 对局不可复现、不能重开
seed 来自 `Date.now()`（[RunEngine.ts](script-br/src/game/engine/RunEngine.ts) 构造函数），`rng.randomSeed()` 没用到；结局后没有"重新开始"，要刷新页面。

### 8. 关系状态还很薄
`RelationRuntime`（stranger/acquaintance/close/crush）没做，`sameClass` 也没数据；"她与别人走得很近"这类关系变动事件还没有，所以小事件的 -0.4 目前用"好感 < 10"代理。

---

## 六、下一批开工建议（给下一个 AI）

**优先级**（按用户意图）：
1. **同框（samebox）引擎**：按月/地点配置同框事件，同框即触发，别人可介入抢约（第 3 批）；
2. **私人目标 + 双层目标**：目标进度现在只在固定事件里 +1/+2，UI 完全不显示；补目标面板与完成度；
3. **结局判定**：三年时间线 + `outcomes` 表驱动 + 关系结局；
4. 给 `it_bench` / `it_rooftop` / `it_oldfloor` 补效果与内容；
5. 再往后：局外轮回存档（唯一身份 + 好感封顶分配 + 解锁带出）、联网。

**验证方式**：每批做完，用户会 `cd script-br` → `npm run dev` 实际跑。

**用户偏好记录**：
- 不喜欢"因子状态机（unaware/suspected/confirmed）"被明面做出来 → **不要做显式状态机**，靠事件选项 + 文本差异暗示；
- "线"这个说法已被用户否决，**统一说"因子"**；
- 内容优先，机制验证优先，不做商业化卖点；
- 每次最多问 3 个问题。

**环境坑（老生常谈）**：
- npm 不在 PATH，必须用 `& "C:\Program Files\nodejs\npm.cmd"`
- 不要往 `code\script-br\src\` 或 `code\src\` 写代码
- 保存代码必须写绝对真实路径 `script-br/src/game/...`（相对项目根 `game_project`）
- 仓库把 `node_modules` 也提交了（4897 个文件），`git status` 会很慢；`.gitignore` 目前没忽略它

---

## 七、运行状态确认

**最近一次（v7）**：`tsc --noEmit` 通过、`vite build` 通过、引擎模拟 800+ 局无异常。
浏览器侧待用户确认：
- 开局先选身份，再选"在意的人"（8 个 NPC）；
- 局内关系面板显示"好感 x/100 · 在意 · XX"；
- 随机互动里会出现"晚自习 → 去看看"的完整树。
