import { GameStatus } from "#api/shared/GameStatus.ts"
import type { PlayerId } from "#api/shared/PlayerId.ts"
import type { LobbyModel } from "./lobbies.repository.ts"

/**
 * Actions the current player can perform from a lobby view.
 */
export type LobbyCapabilities = {
  readonly canJoin: boolean
  readonly canLeave: boolean
  readonly canStart: boolean
  readonly canOpen: boolean
}

/**
 * Computes player-specific lobby capabilities from the persisted game status.
 */
export function getLobbyCapabilities({
  lobbyModel,
  playerId,
}: {
  readonly lobbyModel: LobbyModel
  readonly playerId: PlayerId | undefined
}): LobbyCapabilities {
  const isKnownPlayer = playerId !== undefined
  const isJoinedPlayer = isKnownPlayer && lobbyModel.players.some((player) => player.id === playerId)
  const isCreator = isKnownPlayer && lobbyModel.creator.id === playerId

  return {
    canJoin: isKnownPlayer && lobbyModel.status === GameStatus.WAITING_FOR_PLAYERS && !isJoinedPlayer,
    canLeave:
      isJoinedPlayer &&
      !isCreator &&
      (lobbyModel.status === GameStatus.WAITING_FOR_PLAYERS || lobbyModel.status === GameStatus.READY_TO_START),
    canStart: isCreator && (lobbyModel.status === GameStatus.WAITING_FOR_PLAYERS || lobbyModel.status === GameStatus.READY_TO_START),
    canOpen: isJoinedPlayer && (lobbyModel.status === GameStatus.COLLECTING_ORDERS || lobbyModel.status === GameStatus.PROCESSING_TICK),
  }
}
