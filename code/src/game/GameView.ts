/**
 * 局内"视图快照"与"数据源"接口。
 *
 * 设计目的（为未来整体留口子）：
 * - 局内 UI 只依赖 GameView（一份纯数据快照），不关心数据从哪来。
 * - 数据来源通过 GameSource 接口隔离：
 *     · 现在：LocalSource（本地单机引擎）
 *     · 未来：WebSocketSource（联网服务端）—— 只需换实现，UI 不用改。
 */

/** 一个选项。MVP 阶段只有 id + 文案 */
export interface GameChoice {
  id: string
  text: string
}

/** 局内视图快照：UI 渲染所需的一切 */
export interface GameView {
  /** 回合数（徽标显示）。MVP 先显示纯数字 */
  month: number
  /** 背景图 URL */
  background: string
  /** 下方文本框内容 */
  narrative: string
  /** 当前可选项 */
  choices: GameChoice[]
}

/**
 * 数据源接口。
 * UI 只跟它打交道：拿当前快照、提交一次选择。
 * 本地实现与未来联网实现都遵循这个接口。
 */
export interface GameSource {
  /** 获取当前快照 */
  getView(): GameView
  /** 提交一个选项，返回推进后的新快照 */
  choose(choiceId: string): GameView
  /** 订阅状态变化（联网时服务端推送会用到；本地实现直接同步返回，可不订阅） */
  subscribe(listener: (view: GameView) => void): () => void
}