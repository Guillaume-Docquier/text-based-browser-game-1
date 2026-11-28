import type { Rng } from "@guillaume-docquier/tools-ts"
import type { PlayerId } from "#shared/domain/players/PlayerId.ts"
import { BuildingType, TRADE_CENTER_INCOME } from "#shared/domain/world/buildings/Building.ts"
import type { TurnState } from "#shared/turn-resolution/TurnState.ts"

export type TurnResolution = { readonly creditIncome: ReadonlyMap<PlayerId, number> }

export function resolveTurn(state: TurnState, _rng: Rng): TurnResolution {
  const owners = new Map(state.planets.map((planet) => [planet.id, planet.ownerPlayerId]))
  const creditIncome = new Map<PlayerId, number>()
  for (const building of state.buildings) {
    const owner = owners.get(building.planetId) ?? null
    if (building.type === BuildingType.TRADE_CENTER && owner !== null) {
      creditIncome.set(owner, (creditIncome.get(owner) ?? 0) + TRADE_CENTER_INCOME)
    }
  }
  return { creditIncome }
}
