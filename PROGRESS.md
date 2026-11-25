# 项目进度日志

## 基本信息
- 项目：剧本吃鸡（多人共享剧本 · 轮回养成 · 纯文本）
- 阶段：阶段3 编码实现（进行中）
- 当前批次：**第 2 批「剧情引擎 + 身份系统 + 月流程」已完成，能跑通**
- 更新日期：2026-11-24（本版）

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

**项目根不是 `C:\Users\34903\script-br`（那个不存在），而是 `C:\Users\34903\game_project`。**

---

## 二、目录结构与两套代码的关系（关键，别搞混）

`C:\Users\34903\game_project\` 下并存四个"看起来像项目"的东西：

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
  package.json
  tsconfig.json
  vite.config.ts
  src/
    main.tsx
    App.tsx              # 只用 createLocalSource + GameScreen，不要改
    game/
      GameView.ts        # UI 只读快照 + GameSource 接口（v5）
      LocalSource.ts     # 单机数据源：选身份 → RunEngine → GameView（v5）
      GameScreen.tsx     # 局内 UI（v5）
      styles.css         # 响应式样式（v5）
      engine/
        RunEngine.ts     # 月流程 8 阶段状态机 + 身份 + 随机互动树（v6）
        evaluator.ts     # 条件求值 + 效果结算（v6，支持 identityFactorIs）
        rng.ts           # 种子随机（mulberry32）
        # 以下为旧版残留，本批未引用，可不管：
        # clueTracker.ts / factorEvolve.ts（如果存在也不报错）
      script/
        types.ts         # 剧本类型 v6（含 identities / interactEvents / identityFactorIs）
        script1.ts       # 剧本 v6.1（Y1-9 ~ Y2-2，身份龙烬余孤，5 固定事件 + 4 随机互动）
```

---

## 四、第 2 批已完成的能力（跑起来可验证）

- ✅ 开局**选玄幻身份**（只有"龙烬余孤"一个）
- ✅ 选完后**身份因子随机二选一**：`seal`（封龙）/ `ancient`（古龙），**玩家不可见**
- ✅ **身份暗示句**随身份变化（"另一个心跳" vs "有什么东西在躲着你"）
- ✅ **8 阶段月流程**：intro → mainChoice → feedback → smallEvent → fixedEvent → interact1 → interact2 → summary
- ✅ **固定事件月**只在 9/10/11/12/1 月；2 月寒假走 `holidaySkip`，只有一个"跳过"
- ✅ **固定事件选项按 `identityFactorIs` 分叉**（seal / ancient 各看各的选项）
- ✅ **随机互动事件池 4 个**：`it_bench` / `it_latenight` / `it_rooftop` / `it_oldfloor`
- ✅ **交互树完整跑**：普通 next / `{byMutual, byOneSide}` 双向分支
- ✅ **机会池规则**：机会①可抽全部，机会②只抽 `kind: 'short'`；`maybeLong` 进入 `byMutual` 时吃满 2 次
- ✅ **小事件概率**：base 0.4 + 主选择 +0.25 + 关系负向权重 > 正向
- ✅ **拉近关系**：按 NPC `relation` 类型给好感 +4/+5/+8，封顶 100
- ✅ **好感总封顶**：正向和超 100 时按比例裁剪
- ✅ **假期跳过**

---

## 五、已知简化与未做的（下一批的活）

### 1. `byMutual` 判定是假的
**现状**：`mutual = rng.chance(0.6)`（抛硬币）。
**应做**：引入 `crushId`（在意的人）+ 关系状态 + 好感阈值判定。
**位置**：`RunEngine.handleInteractChoice`。

### 2. 用户原话的"她"分叉树还没做
用户描述的完整树：
```
晚自习 → 去看她班级 → 她在？
  ├ 在 → 主动找她 / 害羞看一眼
  └ 不在 → 颓丧离开 → 校门口遇到？
       ├ 遇到 → 主动找她 / 看一眼离开
       └ 没遇到 → 结束
```
**现状**：`it_latenight` 只是极简占位（看一眼对面楼的灯）。
**需补**：需要关系状态支持（她在不在、同班与否、校门口概率）。

### 3. 固定事件的选择结果日志被覆盖
**现状**：`choose()` 固定事件分支把 `logs` 存到 `flashNarrative`，但紧接着 `toInteract1()` 会把 `flashNarrative` 覆盖成互动事件文字。
**影响**：玩家看不到自己刚才选项的结果。
**修法**：把 `flashNarrative` 改成"日志数组"或"logs 追加到 monthLog"，并在 narrative 里渲染完整 `monthLog`。

### 4. `feedback.special`（特殊关系人信息流）是空壳
只有 `relation === '谜'` 时硬塞一句话，没有真正的"在意的人"信息。

### 5. 世界因子、同框、结局判定都是空的
- `factorPool: []`、`factorGroups: []`：世界因子（家族/旧楼/学业）不激活，按用户指示**本批不做**；
- 同框（`samebox`）：引擎未接，用户说"要做，但先专注个人"；**下一批引入**；
- 结局：只有占位 `o_default`，判定走"私人目标完成度"的正式逻辑还没接。

### 6. `it_latenight` 的 requires 是占位
```ts
requires: { hasCrush: false }  // 会过滤掉吗？不会——因为 hasCrush=false 是"不需要 crush"
```
实际上无害，但下一批真正引入 crush 后要改成 `hasCrush: true`。

---

## 六、下一批开工建议（给下一个 AI）

**优先级**（用户意图排序，需再确认）：
1. **先修 §5 的第 3 条**（logs 覆盖 bug，因为每个事件都受影响）；
2. **接 crss 系统**：加 `crushId` 字段、加关系状态、让 `byMutual` 按好感判定；
3. **实现"她"的完整分叉树** `it_latenight`（用户原话最重要的那个）；
4. **然后才考虑同框**。

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

---

## 七、运行状态确认

**最近一次**：用户确认"能跑"，即：
- `npm run dev` 无报错；
- 浏览器能看到"选择你的玄幻身份 / 龙烬余孤"；
- 8 阶段流程能走通。

否则下一批从"复现问题"开始。