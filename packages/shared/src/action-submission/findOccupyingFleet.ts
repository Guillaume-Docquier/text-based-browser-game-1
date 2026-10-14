import { compareOrdinalStrings } from "#shared/domain/compareOrdinalStrings.ts"
import type { PlayerId } from "#shared/domain/players/PlayerId.ts"
import type { ActionId } from "#shared/domain/turns/actions/ActionId.ts"
import type { Fleet } from "#shared/domain/world/fleets/Fleet.ts"
import type { EligibilityState } from "./selectionEvaluation.ts"

export function findOccupyingFleet(state: EligibilityState, playerId: PlayerId, actionId: ActionId): Fleet | undefined {
  return Object.values(state.fleets)
    .filter((fleet) => fleet.ownerPlayerId === playerId && fleet.movement?.submission.id === actionId)
    .toSorted((first, second) => compareOrdinalStrings(first.id, second.id))[0]
}
