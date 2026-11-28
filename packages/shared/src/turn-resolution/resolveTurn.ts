import type { Rng } from "@guillaume-docquier/tools-ts"
import { addCredits } from "#shared/domain/games/credits.ts"
import type { PlayerId } from "#shared/domain/players/PlayerId.ts"
import { BuildingType, TRADE_CENTER_INCOME } from "#shared/domain/world/buildings/Building.ts"
import type { ConstructionOrder } from "#shared/domain/world/buildings/ConstructionOrder.ts"
import type { ShipId } from "#shared/domain/world/ships/Ship.ts"
import { traveledDistance, type BodyRef, type Trip } from "#shared/domain/world/ships/travel.ts"
import type { TurnState } from "#shared/turn-resolution/TurnState.ts"

export type TurnResolution = {
  readonly creditChanges: ReadonlyMap<PlayerId, string>
  readonly shipUpdates: ReadonlyArray<{ shipId: ShipId; station: BodyRef | null; trip: Trip | null; segmentDistance: number }>
  readonly buildingsToPlace: ReadonlyArray<Pick<ConstructionOrder, "planetId" | "site" | "type">>
}

export function resolveTurn(state: TurnState, _rng: Rng): TurnResolution {
  const owners = new Map(state.planets.map((planet) => [planet.id, planet.ownerPlayerId]))
  const creditChanges = new Map<PlayerId, string>()
  for (const building of state.buildings) {
    const owner = owners.get(building.planetId) ?? null
    if (building.type === BuildingType.TRADE_CENTER && owner !== null) {
      creditChanges.set(owner, addCredits(creditChanges.get(owner) ?? 0, TRADE_CENTER_INCOME))
    }
  }
  const buildingsToPlace = state.constructionOrders.map(({ playerId, planetId, type, site, cost }) => {
    creditChanges.set(playerId, addCredits(creditChanges.get(playerId) ?? 0, -cost))
    return { planetId, type, site }
  })
  const shipUpdates = state.shipMoves.map(({ shipId, playerId, route, completedTurns }) => {
    if (completedTurns === 0) {
      creditChanges.set(playerId, addCredits(creditChanges.get(playerId) ?? 0, -route.cost))
    }
    const next = completedTurns + 1
    const arrived = next >= route.turns
    const segmentDistance = traveledDistance(route, next) - traveledDistance(route, completedTurns)
    return {
      shipId,
      station: arrived ? { kind: route.destination.kind, id: route.destination.id } : null,
      trip: arrived ? null : { route, completedTurns: next },
      segmentDistance,
    }
  })
  return { creditChanges, buildingsToPlace, shipUpdates }
}
