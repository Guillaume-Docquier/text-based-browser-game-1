import { createContext, type FC, type PropsWithChildren, useContext } from "react"
import type * as ApiTypes from "@api-types"

export type PlayGameState = {
  tick: number
  nextTickAt: string | Date
  resources: {
    money: number
  }
}

export type PlayGameContextValue = {
  game: ApiTypes.GameSummary
  gameState: PlayGameState
}

const PlayGameContext = createContext<PlayGameContextValue | undefined>(undefined)

export const usePlayGameContext = (): PlayGameContextValue => {
  const context = useContext(PlayGameContext)

  if (context === undefined) {
    throw new Error("usePlayGameContext must be used under the play game route")
  }

  return context
}

export const PlayGameContextProvider: FC<PropsWithChildren<{ value: PlayGameContextValue }>> = ({ value, children }) => {
  return <PlayGameContext.Provider value={value}>{children}</PlayGameContext.Provider>
}
