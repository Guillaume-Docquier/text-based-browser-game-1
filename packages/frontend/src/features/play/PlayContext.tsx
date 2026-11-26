import type { GameDetails, PlayerView, TurnState } from "@api-types"
import { Assert } from "@guillaume-docquier/tools-ts"
import { createContext, type PropsWithChildren, type ReactElement, useContext, useEffect, useState } from "react"
import { GameStatus } from "shared/domain/games/GameStatus.ts"
import { TurnStatus } from "shared/domain/turns/TurnStatus.ts"

export type PlayGameData = {
  gameDetails: GameDetails
  turnState: TurnState
  playerView: PlayerView
}

type PlayGameContextValue = PlayGameData & {
  canTakeAction: boolean
  isCurrentPlayerReady: boolean
}

const PlayContext = createContext<PlayGameContextValue | undefined>(undefined)

export const usePlayGameContext = (): PlayGameContextValue => {
  const context = useContext(PlayContext)

  if (context === undefined) {
    throw new Error("usePlayGameContext must be used under the play game route")
  }

  return context
}

export function PlayGameContextProvider({
  gameDetails,
  turnState,
  playerView,
  hasLiveSnapshot,
  children,
}: PropsWithChildren<PlayGameData & { hasLiveSnapshot: boolean }>): ReactElement {
  const beforeDeadline = useBeforeDeadline(turnState.turnEndsAt)
  const canTakeAction =
    hasLiveSnapshot &&
    gameDetails.status === GameStatus.IN_PROGRESS &&
    turnState.turnStatus === TurnStatus.COLLECTING_ACTIONS &&
    playerView.turn === turnState.turn &&
    beforeDeadline
  const isCurrentPlayerReady = turnState.readinessByPlayerId[playerView.player.id]
  Assert.isDefined(isCurrentPlayerReady)

  const value = { gameDetails, turnState, playerView, canTakeAction, isCurrentPlayerReady }
  return <PlayContext.Provider value={value}>{children}</PlayContext.Provider>
}

function useBeforeDeadline(deadline: string): boolean {
  const readDeadline = (): { deadline: string; isOpen: boolean } => ({ deadline, isOpen: Date.now() < Date.parse(deadline) })
  const [state, setState] = useState(readDeadline)
  if (state.deadline !== deadline) {
    setState(readDeadline)
  }
  useEffect(() => {
    if (!state.isOpen) {
      return
    }
    const remainingMs = Date.parse(deadline) - Date.now()
    const timer = setTimeout(() => {
      setState({ deadline, isOpen: false })
    }, remainingMs)
    return (): void => {
      clearTimeout(timer)
    }
  }, [deadline, state.isOpen])
  return state.isOpen
}
