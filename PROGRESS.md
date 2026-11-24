# 项目进度日志

## 基本信息
- 项目：剧本吃鸡（多人共享剧本 · 轮回养成 · 纯文本）
- 阶段：阶段3 编码实现（进行中）
- 当前批次：第 1 批「骨架 + 响应式 UI」已完成并通过验证
- 更新日期：2026-11-24

## 里程碑
- [x] 阶段1 GDD 确认（v0.5）
- [x] 阶段2 技术方案确认（v1.0）
- [x] 第 1 批：项目骨架 + 响应式 UI + 回合推进（最小可运行）
- [ ] 第 2 批：剧情引擎（事件/选项条件/效果结算，剧本 JSON 化）
- [ ] 第 3 批：时间轮（月→年→三年）与学年清算
- [ ] 第 4 批：私人目标 + 双层目标 + 好感系统
- [ ] 第 5 批：结局判定 + 局外轮回存档
- [ ] 第 6 批：同框/活动事件
- [ ] 后续：联网（WebSocket）多人同步（单机跑通后再做）

## 第 1 批交付明细（已完成）
- 运行环境：Node v26.13.1；依赖已 `npm install`。
- 运行命令：`& "C:\Program Files\nodejs\npm.cmd" run dev`
  - 备注：本机 npm 不在 PATH，需用完整路径调用；Vite dev 端口 5173。
- 已建文件（项目根 `C:\Users\34903\script-br`）：
  - index.html
  - vite.config.ts
  - tsconfig.json
  - package.json
  - src/main.tsx
  - src/App.tsx
  - src/game/GameView.ts      （视图快照类型 + GameSource 数据源接口，为联网预留）
  - src/game/LocalSource.ts    （本地单机数据源，当前为占位剧情 + 回合 +1）
  - src/game/GameScreen.tsx    （局内 UI）
  - src/game/styles.css        （响应式样式）
- UI 验收：背景铺满/圆形回合徽标/居中选项/底部可滚动文本框/手机自适应，均已通过。

## 下次开工提示（给 AI 自己看）
- 从「第 2 批：剧情引擎」继续。
- 现状：LocalSource.ts 内剧情为硬编码占位（NARRATIVES + 固定两选项），需替换为：
  1) 剧本 JSON（meta/cast/npcs/timeline/events/goals/outcomes）
  2) 条件求值器（require: 身份/好感/flag）
  3) 效果结算器（affinity/unlock/flag/goalProgress/worldShift）
  4) 事件触发（固定/随机/静默学习）
- 约束：保持 GameSource 接口不变，UI 不改；直接三年（用户已确认）。
- 环境坑：PowerShell 下 npm 需完整路径 `C:\Program Files\nodejs\npm.cmd`。

## 待定
- 好感总封顶具体数值（数值阶段定）。
- 背景图资源：当前用 CSS 渐变占位，后续需接入 2D 背景图资源与地点切换。