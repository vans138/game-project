export interface GameChoice {
  id: string
  text: string
}

export interface GameView {
  month: number
  background: string
  narrative: string
  choices: GameChoice[]
}

export interface GameSource {
  getView(): GameView
  choose(choiceId: string): GameView
  subscribe(listener: (view: GameView) => void): () => void
}