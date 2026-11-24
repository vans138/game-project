import { useMemo } from 'react'
import { createLocalSource } from './game/LocalSource'
import GameScreen from './game/GameScreen'

/**
 * 顶层组件。
 *
 * MVP 阶段：创建本地单机数据源，交给 GameScreen 渲染。
 * 未来接入联网时，只需把 createLocalSource() 换成联网数据源实现，
 * GameScreen 与 UI 完全不用动。
 */
export default function App() {
  const source = useMemo(() => createLocalSource(), [])
  return <GameScreen source={source} />
}