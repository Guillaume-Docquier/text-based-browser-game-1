import type { Galaxy } from "@api-types"
import { GameIdSchema } from "shared/domain/games/GameId.ts"
import { GameStatus } from "shared/domain/games/GameStatus.ts"
import { createPlayerStub } from "shared/domain/players/Player.stub.ts"
import { TurnStatus } from "shared/domain/turns/TurnStatus.ts"
import type { PlayGameData } from "./PlayContext.tsx"

export function createPlayGameContextStub({ galaxy = { systems: [] } }: { galaxy?: Galaxy } = {}): PlayGameData {
  const gameId = GameIdSchema.parse(1)
  const player = createPlayerStub()
  return {
    gameDetails: {
      id: gameId,
      configuration: { name: "Story game", nbSeats: 1, turnIntervalSeconds: 3600 },
      createdAt: "2026-01-01T00:00:00Z",
      startedAt: "2026-01-01T00:00:00Z",
      endedAt: null,
      creator: player,
      players: [player],
      status: GameStatus.IN_PROGRESS,
      canJoin: false,
      canLeave: false,
      canStart: false,
      canOpen: true,
    },
    playerView: {
      gameId,
      player: { id: player.id, color: player.color },
      opponents: {},
      galaxy,
      turn: 1,
    },
    turnState: {
      turn: 1,
      readinessByPlayerId: { [player.id]: false },
      turnStatus: TurnStatus.COLLECTING_ACTIONS,
      turnEndsAt: "2026-01-01T01:00:00Z",
    },
  }
}
