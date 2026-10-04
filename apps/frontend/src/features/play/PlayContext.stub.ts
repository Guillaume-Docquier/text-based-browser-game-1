import type { Galaxy, LobbyPlayer } from "@api-types"
import { GameIdSchema } from "shared/domain/game/GameId.ts"
import { AliasSchema } from "shared/domain/identity/Alias.ts"
import { PlayerIdSchema } from "shared/domain/players/PlayerId.ts"
import { createRulesetStub } from "shared/domain/ruleset/Ruleset.stub.ts"
import type { PlayGameContextValue } from "./PlayContext.tsx"

/**
 * Provides deterministic game context for isolated gameplay page stories.
 */
export function createPlayGameContextStub({ galaxy = { systems: [] } }: { galaxy?: Galaxy } = {}): PlayGameContextValue {
  const gameId = GameIdSchema.parse(1)
  const player: LobbyPlayer = {
    id: PlayerIdSchema.parse("00000000-0000-4000-8000-000000000001"),
    alias: AliasSchema.parse("Alice"),
    color: "BLUE",
  }
  const ruleset = createRulesetStub({ id: "00000000-0000-4000-8000-000000000002", name: "Story ruleset" })
  return {
    game: {
      id: gameId,
      winnerAccountId: null,
      configuration: { name: "Story game", nbSeats: 1, turnIntervalSeconds: 3600, ruleset },
      createdAt: "2026-01-01T00:00:00Z",
      startedAt: "2026-01-01T00:00:00Z",
      endedAt: null,
      creator: player,
      players: [player],
      status: "IN_PROGRESS",
      canJoin: false,
      canLeave: false,
      canStart: false,
      canOpen: true,
    },
    playerView: {
      gameId,
      player: { id: player.id, color: player.color, isReady: false },
      opponents: {},
      galaxy,
      fleets: [],
      turn: 1,
      turnStatus: "COLLECTING_ACTIONS",
      turnEndsAt: "2026-01-01T01:00:00Z",
      resources: {
        INFLUENCE: { total: 0, uncommitted: 0 },
        METAL: { total: 0, uncommitted: 0 },
        FUEL: { total: 0, uncommitted: 0 },
        ENERGY: { total: 0, uncommitted: 0 },
        COLONY: { total: 0, uncommitted: 0 },
      },
      ruleset,
      actions: [],
    },
  }
}
