import type { Rng } from "@guillaume-docquier/tools-ts"
import type { GameId } from "#shared/domain/games/GameId.ts"
import type { PlayerId } from "#shared/domain/players/PlayerId.ts"
import type { Fleet } from "#shared/domain/world/fleets/Fleet.ts"
import type { FleetId } from "#shared/domain/world/fleets/FleetId.ts"
import type { Planet } from "#shared/domain/world/planets/Planet.ts"
import type { PlanetId } from "#shared/domain/world/planets/PlanetId.ts"
import type { ResolutionPlayer } from "#shared/turn-resolution/state/ResolutionPlayer.ts"

/**
 * In-memory domain state for the spike, with no persistence adapter.
 */
export type ExecutionState = {
  readonly gameId: GameId
  readonly turn: number
  readonly players: Readonly<Record<PlayerId, ResolutionPlayer>>
  readonly planets: Readonly<Record<PlanetId, Planet>>
  readonly fleets: Record<FleetId, Fleet>
  winnerPlayerId: PlayerId | undefined
}
export type ExecutionContext = Readonly<{ state: ExecutionState; actor: ResolutionPlayer; rng: Rng }>
