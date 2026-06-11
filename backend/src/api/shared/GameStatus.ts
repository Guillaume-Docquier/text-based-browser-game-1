import type { Enumify } from "@guillaume-docquier/tools-ts"

export type GameStatus = Enumify<typeof GameStatus>
export const GameStatus = {
  WAITING_FOR_PLAYERS: "WAITING_FOR_PLAYERS",
  READY_TO_START: "READY_TO_START",
  STARTED: "STARTED",
  ENDED: "ENDED",
} as const

export function computeGameStatus({
  nbPlayers,
  nbSeats,
  startedAt,
  endedAt,
}: {
  nbPlayers: number
  nbSeats: number
  startedAt: Date | null
  endedAt: Date | null
}): GameStatus {
  // oxfmt-ignore
  return endedAt !== null ? GameStatus.ENDED
    : startedAt !== null ? GameStatus.STARTED
    : nbPlayers >= nbSeats ? GameStatus.READY_TO_START
    : GameStatus.WAITING_FOR_PLAYERS
}
