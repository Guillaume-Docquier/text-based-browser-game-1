import type { GameId } from "#shared/domain/games/GameId.ts"
import type { PlayerId } from "#shared/domain/players/PlayerId.ts"
import type { Planet } from "#shared/domain/world/planets/Planet.ts"

export type TurnState = Readonly<{
  gameId: GameId
  turn: number
  players: ReadonlyArray<{ readonly id: PlayerId }>
  planets: ReadonlyArray<Pick<Planet, "id" | "name" | "ownerPlayerId" | "x" | "y">>
}>
