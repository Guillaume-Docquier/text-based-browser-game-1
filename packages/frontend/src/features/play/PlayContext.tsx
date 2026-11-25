import type { GameDetails, PlayerView, TurnState } from "@api-types"
import { createContext, type FC, type PropsWithChildren, useContext } from "react"

export type PlayGameContextValue = {
  gameDetails: GameDetails
  playerView: PlayerView
  turnState: TurnState | undefined
  readinessTurn: number | undefined
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
