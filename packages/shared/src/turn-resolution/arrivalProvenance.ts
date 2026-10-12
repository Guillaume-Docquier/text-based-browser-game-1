import { compareOrdinalStrings } from "#shared/domain/compareOrdinalStrings.ts"
import type { FleetId } from "#shared/domain/world/fleets/FleetId.ts"

export type ArrivalProvenance = Readonly<{
  playerId: string
  actionId: string
  departureTurn: number
  initiatingJourneyId: string
  definitionOrdinal: number
}>

/** Orders effects by their stable submitted-action and journey provenance. */
export function compareArrivalProvenance(first: ArrivalProvenance, second: ArrivalProvenance): number {
  const playerOrder = compareOrdinalStrings(first.playerId, second.playerId)
  if (playerOrder !== 0) {
    return playerOrder
  }
  const actionOrder = compareOrdinalStrings(first.actionId, second.actionId)
  if (actionOrder !== 0) {
    return actionOrder
  }
  const departureOrder = first.departureTurn - second.departureTurn
  if (departureOrder !== 0) {
    return departureOrder
  }
  const journeyOrder = compareOrdinalStrings(first.initiatingJourneyId, second.initiatingJourneyId)
  return journeyOrder !== 0 ? journeyOrder : first.definitionOrdinal - second.definitionOrdinal
}

/** Follows fleet-merge identities until the current surviving Fleet is reached. */
export function resolveFleetRebinding(rebindings: ReadonlyMap<FleetId, FleetId>, fleetId: FleetId): FleetId {
  let resolvedFleetId = fleetId
  let nextFleetId = rebindings.get(resolvedFleetId)
  while (nextFleetId !== undefined) {
    resolvedFleetId = nextFleetId
    nextFleetId = rebindings.get(resolvedFleetId)
  }
  return resolvedFleetId
}
