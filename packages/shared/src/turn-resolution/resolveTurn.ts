import type { Rng } from "@guillaume-docquier/tools-ts"
import type { PlayerId } from "#shared/domain/players/PlayerId.ts"
import { BuildingType, TRADE_CENTER_INCOME } from "#shared/domain/world/buildings/Building.ts"
import type { ConstructionOrder } from "#shared/domain/world/buildings/ConstructionOrder.ts"
import type { TurnState } from "#shared/turn-resolution/TurnState.ts"

export type TurnResolution = {
  readonly creditChanges: ReadonlyMap<PlayerId, number>
  readonly buildingsToPlace: ReadonlyArray<Pick<ConstructionOrder, "planetId" | "site" | "type">>
}

export function resolveTurn(state: TurnState, _rng: Rng): TurnResolution {
  const owners = new Map(state.planets.map((planet) => [planet.id, planet.ownerPlayerId]))
  const creditChanges = new Map<PlayerId, number>()
  for (const building of state.buildings) {
    const owner = owners.get(building.planetId) ?? null
    if (building.type === BuildingType.TRADE_CENTER && owner !== null) {
      creditChanges.set(owner, (creditChanges.get(owner) ?? 0) + TRADE_CENTER_INCOME)
    }
  }
  const buildingsToPlace = state.constructionOrders.map(({ playerId, planetId, type, site, cost }) => {
    creditChanges.set(playerId, (creditChanges.get(playerId) ?? 0) - cost)
    return { planetId, type, site }
  })
  return { creditChanges, buildingsToPlace }
}
