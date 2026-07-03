import { GameStatus } from "#lib/db/games/GameStatus.ts"

/**
 * Checks whether a player can start a game from its persisted lifecycle state.
 */
export function canStartGame({
  status,
  createdByAccountId,
  playerId,
}: {
  readonly status: GameStatus
  readonly createdByAccountId: string
  readonly playerId: string | undefined
}): boolean {
  return playerId === createdByAccountId && (status === GameStatus.WAITING_FOR_PLAYERS || status === GameStatus.READY_TO_START)
}
