// App：仅负责创建 source 并挂载 GameScreen。开局的角色选择由 LocalSource 内部处理。
import { useMemo } from 'react'
import { createLocalSource } from './game/LocalSource'
import GameScreen from './game/GameScreen'

export default function App() {
  const source = useMemo(() => createLocalSource(), [])
  return <GameScreen source={source} />
}