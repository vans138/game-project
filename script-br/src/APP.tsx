import { useMemo } from 'react'
import { createLocalSource } from './game/LocalSource'
import GameScreen from './game/GameScreen'

export default function App() {
  const source = useMemo(() => createLocalSource(), [])
  return <GameScreen source={source} />
}