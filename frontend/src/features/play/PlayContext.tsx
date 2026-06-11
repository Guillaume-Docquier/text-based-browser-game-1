import type * as ApiTypes from "@api-types"
import { createContext, type FC, type PropsWithChildren, useContext } from "react"

export type PlayGameState = {
  tick: number
  nextTickAt: string | Date
  resources: {
    money: number
  }
}

export type PlayGameContextValue = {
  game: ApiTypes.Lobby
  gameState: PlayGameState
}

const PlayContext = createContext<PlayGameContextValue | undefined>(undefined)

export const usePlayGameContext = (): PlayGameContextValue => {
  const context = useContext(PlayContext)

  if (context === undefined) {
    throw new Error("usePlayGameContext must be used under the play game route")
  }

  return context
}

export const PlayGameContextProvider: FC<PropsWithChildren<{ value: PlayGameContextValue }>> = ({ value, children }) => {
  return <PlayContext.Provider value={value}>{children}</PlayContext.Provider>
}
