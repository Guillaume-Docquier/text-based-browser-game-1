import type { GameId } from "#shared/domain/games/GameId.ts"
import type { PlayerId } from "#shared/domain/players/PlayerId.ts"
import type { Building } from "#shared/domain/world/buildings/Building.ts"
import type { ConstructionOrder } from "#shared/domain/world/buildings/ConstructionOrder.ts"
import type { Planet } from "#shared/domain/world/planets/Planet.ts"
import type { ShipId } from "#shared/domain/world/ships/Ship.ts"
import type { TravelRoute } from "#shared/domain/world/ships/travel.ts"

export type TurnState = Readonly<{
  gameId: GameId
  turn: number
  players: ReadonlyArray<{ readonly id: PlayerId }>
  shipMoves: ReadonlyArray<{ shipId: ShipId; playerId: PlayerId; route: TravelRoute; completedTurns: number }>
  constructionOrders: ReadonlyArray<Pick<ConstructionOrder, "planetId" | "site" | "type" | "cost"> & { playerId: PlayerId }>
  buildings: ReadonlyArray<Pick<Building, "type" | "planetId">>
  planets: ReadonlyArray<Pick<Planet, "id" | "name" | "ownerPlayerId" | "x" | "y">>
}>
