import { branded } from "@guillaume-docquier/tools-ts"
import { compareOrdinalStrings } from "#shared/domain/compareOrdinalStrings.ts"
import type { PlayerId } from "#shared/domain/players/PlayerId.ts"
import { FleetAssaultEffectDefinition } from "#shared/domain/ruleset/effect-definitions/FleetAssaultEffectDefinition.ts"
import type { Ruleset } from "#shared/domain/ruleset/Ruleset.ts"
import { isFleetPresentAtPlanet } from "#shared/domain/world/fleets/isFleetPresentAtPlanet.ts"
import type { PlanetId } from "#shared/domain/world/planets/PlanetId.ts"
import type { ResolutionFleet } from "#shared/turn-resolution/state/ResolutionFleet.ts"
import type { TurnState } from "#shared/turn-resolution/TurnState.ts"

export function validateLoadedFleetCombatState(turnState: TurnState, ruleset: Ruleset): string | undefined {
  const fleets = Object.values(turnState.fleets)
  for (const fleet of fleets.toSorted((first, second) => compareOrdinalStrings(first.id, second.id))) {
    if (!Number.isSafeInteger(fleet.strength) || fleet.strength < 0) {
      return 'Fleet "' + fleet.id + '" has an unsafe Strength value'
    }
  }

  const assaultOwnersByPlanet = new Map<PlanetId, Set<PlayerId>>()
  const addAssaultTarget = (playerId: PlayerId, targetPlanetId: unknown): void => {
    if (typeof targetPlanetId !== "string") {
      return
    }
    const planetId = branded<PlanetId>(targetPlanetId)
    let playerIds = assaultOwnersByPlanet.get(planetId)
    if (playerIds === undefined) {
      playerIds = new Set()
      assaultOwnersByPlanet.set(planetId, playerIds)
    }
    playerIds.add(playerId)
  }

  collectAssaultOwners(turnState, ruleset, addAssaultTarget)
  return validateEnemyStrengths(fleets, assaultOwnersByPlanet)
}
function validateEnemyStrengths(
  fleets: readonly ResolutionFleet[],
  assaultOwnersByPlanet: ReadonlyMap<PlanetId, Set<PlayerId>>,
): string | undefined {
  for (const planetId of [...assaultOwnersByPlanet.keys()].toSorted(compareOrdinalStrings)) {
    const stationaryFleets = fleets.filter((fleet) => isFleetPresentAtPlanet(fleet, planetId))
    const attackingOwners = assaultOwnersByPlanet.get(planetId)
    if (attackingOwners === undefined) {
      continue
    }
    const error = enemyStrengthError(stationaryFleets, planetId, attackingOwners)
    if (error !== undefined) {
      return error
    }
  }
  return undefined
}
function enemyStrengthError(
  stationaryFleets: readonly ResolutionFleet[],
  planetId: PlanetId,
  attackingOwners: ReadonlySet<PlayerId>,
): string | undefined {
  for (const attackingOwnerId of [...attackingOwners].toSorted(compareOrdinalStrings)) {
    const enemyStrength = stationaryFleets
      .filter((fleet) => fleet.ownerPlayerId !== attackingOwnerId)
      .reduce((total, fleet) => total + BigInt(fleet.strength), 0n)
    if (enemyStrength > BigInt(Number.MAX_SAFE_INTEGER)) {
      return 'Enemy Strength at Planet "' + planetId + '" exceeds the safe integer range for Assaults by Player "' + attackingOwnerId + '"'
    }
  }
  return undefined
}
function collectAssaultOwners(
  turnState: TurnState,
  ruleset: Ruleset,
  addAssaultTarget: (playerId: PlayerId, planetId: unknown) => void,
): void {
  collectSubmittedAssaultOwners(turnState, ruleset, addAssaultTarget)
  collectJourneyAssaultOwners(turnState, addAssaultTarget)
}
function collectSubmittedAssaultOwners(
  turnState: TurnState,
  ruleset: Ruleset,
  addAssaultTarget: (playerId: PlayerId, planetId: unknown) => void,
): void {
  for (const submittedAction of turnState.submittedActions) {
    const actionDefinition = Object.hasOwn(ruleset.actionDefinitions, submittedAction.actionDefinitionId)
      ? ruleset.actionDefinitions[submittedAction.actionDefinitionId]
      : undefined
    const assaultEffects = actionDefinition?.effects.filter((effect) => effect.type === FleetAssaultEffectDefinition.type) ?? []
    for (const effectDefinition of assaultEffects) {
      addAssaultTarget(submittedAction.playerId, submittedAction.selectedTargets[effectDefinition.targets.planet.actionTargetTag])
    }
  }
}
function collectJourneyAssaultOwners(turnState: TurnState, addAssaultTarget: (playerId: PlayerId, planetId: unknown) => void): void {
  const journeys = Object.values(turnState.fleets).flatMap(({ movement }) => (movement === undefined ? [] : [movement]))
  for (const movement of journeys) {
    for (const pendingArrival of movement.pendingArrivalEffects.filter(
      (pending) => pending.effectDefinition.type === FleetAssaultEffectDefinition.type,
    )) {
      addAssaultTarget(
        movement.submission.playerId,
        movement.submission.selectedTargets[pendingArrival.effectDefinition.targets.planet.actionTargetTag],
      )
    }
  }
}
