import { branded } from "@guillaume-docquier/tools-ts"
import type { PlayerId } from "#shared/domain/players/PlayerId.ts"
import type { TargetTag } from "#shared/domain/ruleset/action-definitions/TargetTag.ts"
import { AtFleetPlanetConstraint } from "#shared/domain/ruleset/target-definitions/AtFleetPlanetTargetConstraint.ts"
import { OwnedBySubmittingPlayerConstraint } from "#shared/domain/ruleset/target-definitions/OwnedBySubmittingPlayerTargetConstraint.ts"
import { StationaryFleetConstraint } from "#shared/domain/ruleset/target-definitions/StationaryFleetTargetConstraint.ts"
import type { TargetDefinition } from "#shared/domain/ruleset/target-definitions/TargetDefinition.ts"
import type { TargetId } from "#shared/domain/ruleset/target-definitions/TargetId.ts"
import { TargetType } from "#shared/domain/ruleset/target-definitions/TargetType.ts"
import { UnclaimedPlanetConstraint } from "#shared/domain/ruleset/target-definitions/UnclaimedPlanetTargetConstraint.ts"
import type { ActionId } from "#shared/domain/turns/actions/ActionId.ts"
import type { Fleet } from "#shared/domain/world/fleets/Fleet.ts"
import type { FleetId } from "#shared/domain/world/fleets/FleetId.ts"
import { isFleetPresentAtPlanet } from "#shared/domain/world/fleets/isFleetPresentAtPlanet.ts"
import { isPlanetUnclaimed } from "#shared/domain/world/planets/isPlanetUnclaimed.ts"
import type { PlanetId } from "#shared/domain/world/planets/PlanetId.ts"
import {
  type EligibilityState,
  type EligibilityPlanet,
  type EligibilityPlayer,
  type MutableEvaluation,
  getOwnRecordValue,
  addIssue,
} from "./selectionEvaluation.ts"

export function evaluateTarget({
  state,
  actionId,
  targetTag,
  targetId,
  targetDefinition,
  selectedTargets,
  evaluation,
}: {
  state: EligibilityState
  actionId: ActionId
  targetTag: TargetTag
  targetId: TargetId
  targetDefinition: TargetDefinition
  selectedTargets: Readonly<Record<string, TargetId | undefined>>
  evaluation: MutableEvaluation
}): void {
  const target = getTargetEntity(state, targetDefinition.targetType, targetId)
  if (target === undefined) {
    const anotherType = getTargetType(state, targetId)
    addIssue(evaluation, {
      code: anotherType === undefined ? "UNKNOWN_TARGET" : "TARGET_TYPE_MISMATCH",
      actionId,
      targetTag,
      message:
        anotherType === undefined
          ? `Target "${targetId}" does not exist in this game`
          : `Target "${targetId}" is ${anotherType}, but the "${targetTag}" slot requires ${targetDefinition.targetType}`,
    })
    return
  }

  evaluateTargetConstraints({ state, actionId, targetTag, targetId, targetDefinition, selectedTargets, evaluation, target })
}
function evaluateTargetConstraints({
  state,
  actionId,
  targetTag,
  targetId,
  targetDefinition,
  selectedTargets,
  evaluation,
  target,
}: TargetEvaluationInput & { target: NonNullable<ReturnType<typeof getTargetEntity>> }): void {
  for (const constraint of targetDefinition.constraints) {
    switch (constraint.type) {
      case OwnedBySubmittingPlayerConstraint.type:
        evaluateOwnership({ state, actionId, targetTag, targetId, targetDefinition, selectedTargets, evaluation, target, constraint })
        break
      case UnclaimedPlanetConstraint.type:
        evaluateUnclaimedPlanet({ state, actionId, targetTag, targetId, targetDefinition, selectedTargets, evaluation, target, constraint })
        break
      case StationaryFleetConstraint.type:
        evaluateStationaryFleet({ state, actionId, targetTag, targetId, targetDefinition, selectedTargets, evaluation, target, constraint })
        break
      case "WITHIN_FLEET_RANGE":
        evaluateFleetRange({ state, actionId, targetTag, targetId, targetDefinition, selectedTargets, evaluation, target, constraint })
        break
      case AtFleetPlanetConstraint.type:
        evaluateFleetLocation({ state, actionId, targetTag, targetId, targetDefinition, selectedTargets, evaluation, target, constraint })
        break
      case "DIFFERENT_FROM_FLEET_ORIGIN":
        evaluateDifferentOrigin({ state, actionId, targetTag, targetId, targetDefinition, selectedTargets, evaluation, target, constraint })
        break
    }
  }
}

function getTargetEntity(
  state: EligibilityState,
  targetType: TargetType,
  targetId: TargetId,
): ({ type: "PLANET" } & EligibilityPlanet) | ({ type: "FLEET" } & Fleet) | ({ type: "PLAYER" } & EligibilityPlayer) | undefined {
  switch (targetType) {
    case TargetType.PLANET: {
      const planet = getOwnRecordValue(state.planets, branded<PlanetId>(targetId))
      return planet === undefined ? undefined : { ...planet, type: TargetType.PLANET }
    }
    case TargetType.FLEET: {
      const fleet = getOwnRecordValue(state.fleets, branded<FleetId>(targetId))
      return fleet === undefined ? undefined : { ...fleet, type: TargetType.FLEET }
    }
    case TargetType.PLAYER: {
      const playerId = branded<PlayerId>(targetId)
      const player = getOwnRecordValue(state.players, playerId)
      return player === undefined ? undefined : { ...player, type: TargetType.PLAYER }
    }
  }
}

function getTargetType(state: EligibilityState, targetId: TargetId): TargetType | undefined {
  if (getOwnRecordValue(state.planets, branded<PlanetId>(targetId)) !== undefined) {
    return TargetType.PLANET
  }
  if (getOwnRecordValue(state.fleets, branded<FleetId>(targetId)) !== undefined) {
    return TargetType.FLEET
  }
  if (getOwnRecordValue(state.players, branded<PlayerId>(targetId)) !== undefined) {
    return TargetType.PLAYER
  }
  return undefined
}

type TargetEvaluationInput = {
  state: EligibilityState
  actionId: ActionId
  targetTag: TargetTag
  targetId: TargetId
  targetDefinition: TargetDefinition
  selectedTargets: Readonly<Record<string, TargetId | undefined>>
  evaluation: MutableEvaluation
}
function evaluateOwnership({
  state,
  actionId,
  targetTag,
  targetId,
  evaluation,
  target,
}: TargetEvaluationInput & {
  target: NonNullable<ReturnType<typeof getTargetEntity>>
  constraint: Extract<TargetDefinition["constraints"][number], { type: typeof OwnedBySubmittingPlayerConstraint.type }>
}): void {
  if (target.ownerPlayerId !== state.submittingPlayerId) {
    addIssue(evaluation, {
      code: "TARGET_NOT_OWNED",
      actionId,
      targetTag,
      message: `Target "${targetId}" must be owned by the submitting player`,
    })
  }
  return
}
function evaluateUnclaimedPlanet({
  actionId,
  targetTag,
  targetId,
  evaluation,
  target,
}: TargetEvaluationInput & {
  target: NonNullable<ReturnType<typeof getTargetEntity>>
  constraint: Extract<TargetDefinition["constraints"][number], { type: typeof UnclaimedPlanetConstraint.type }>
}): void {
  if (!isPlanetUnclaimed(target.ownerPlayerId)) {
    addIssue(evaluation, {
      code: "PLANET_ALREADY_CLAIMED",
      actionId,
      targetTag,
      message: `Planet "${targetId}" is already claimed`,
    })
  }
  return
}
function evaluateStationaryFleet({
  state,
  actionId,
  targetTag,
  targetId,
  evaluation,
}: TargetEvaluationInput & {
  target: NonNullable<ReturnType<typeof getTargetEntity>>
  constraint: Extract<TargetDefinition["constraints"][number], { type: typeof StationaryFleetConstraint.type }>
}): void {
  {
    const fleet = getOwnRecordValue(state.fleets, branded<FleetId>(targetId))
    if (
      fleet !== undefined &&
      (fleet.movement !== undefined || fleet.destinationPlanetId !== undefined || fleet.distanceToEnd !== undefined)
    ) {
      addIssue(evaluation, {
        code: "FLEET_NOT_STATIONARY",
        actionId,
        targetTag,
        message: `Fleet "${targetId}" is already in transit`,
      })
    } else if (fleet !== undefined && fleet.strength <= 0) {
      addIssue(evaluation, {
        code: "FLEET_HAS_NO_STRENGTH",
        actionId,
        targetTag,
        message: `Fleet "${targetId}" has no available Strength`,
      })
    }
  }
  return
}
function evaluateFleetRange({
  state,
  actionId,
  targetTag,
  targetId,
  selectedTargets,
  evaluation,
  constraint,
}: TargetEvaluationInput & {
  target: NonNullable<ReturnType<typeof getTargetEntity>>
  constraint: Extract<TargetDefinition["constraints"][number], { type: "WITHIN_FLEET_RANGE" }>
}): void {
  const sourceFleetTag = constraint.references.sourceFleetTag
  const sourceFleetId = getOwnRecordValue(selectedTargets, sourceFleetTag)
  if (sourceFleetId === undefined) {
    addIssue(evaluation, {
      code: "DEPENDENCY_INCOMPLETE",
      actionId,
      targetTag,
      message: `Choose source Fleet "${sourceFleetTag}" before choosing this destination`,
    })
    return
  }
  const sourceFleet = getOwnRecordValue(state.fleets, branded<FleetId>(sourceFleetId))
  if (sourceFleet === undefined) {
    addIssue(evaluation, {
      code: "DEPENDENCY_INVALID",
      actionId,
      targetTag,
      message: `Source Fleet "${sourceFleetId}" is unavailable for this destination`,
    })
    return
  }
  const origin = getOwnRecordValue(state.planets, sourceFleet.originPlanetId)
  if (origin === undefined) {
    addIssue(evaluation, {
      code: "MISSING_ORIGIN",
      actionId,
      targetTag,
      message: `Source Fleet "${sourceFleetId}" has no known origin Planet`,
    })
    return
  }
  const destination = getOwnRecordValue(state.planets, branded<PlanetId>(targetId))
  if (destination === undefined) {
    addIssue(evaluation, {
      code: "TARGET_TYPE_MISMATCH",
      actionId,
      targetTag,
      message: `Target "${targetId}" is not a Planet`,
    })
    return
  }
  const distance = Math.hypot(destination.x - origin.x, destination.y - origin.y)
  if (!Number.isFinite(distance) || distance > constraint.parameters.maxDistance) {
    addIssue(evaluation, {
      code: "OUT_OF_RANGE",
      actionId,
      targetTag,
      message: `Planet "${targetId}" is outside this Fleet's maximum range of ${constraint.parameters.maxDistance} light-years`,
    })
  }
  return
}
function evaluateFleetLocation({
  state,
  actionId,
  targetTag,
  targetId,
  selectedTargets,
  evaluation,
  constraint,
}: TargetEvaluationInput & {
  target: NonNullable<ReturnType<typeof getTargetEntity>>
  constraint: Extract<TargetDefinition["constraints"][number], { type: typeof AtFleetPlanetConstraint.type }>
}): void {
  const sourceFleetTag = constraint.references.sourceFleetTag
  const sourceFleetId = getOwnRecordValue(selectedTargets, sourceFleetTag)
  if (sourceFleetId === undefined) {
    addIssue(evaluation, {
      code: "DEPENDENCY_INCOMPLETE",
      actionId,
      targetTag,
      message: `Choose source Fleet "${sourceFleetTag}" before choosing this Planet`,
    })
    return
  }
  const sourceFleet = getOwnRecordValue(state.fleets, branded<FleetId>(sourceFleetId))
  if (sourceFleet === undefined) {
    addIssue(evaluation, {
      code: "DEPENDENCY_INVALID",
      actionId,
      targetTag,
      message: `Source Fleet "${sourceFleetId}" is unavailable for this Planet`,
    })
  } else if (!isFleetPresentAtPlanet(sourceFleet, branded<PlanetId>(targetId))) {
    addIssue(evaluation, {
      code: "DEPENDENCY_INVALID",
      actionId,
      targetTag,
      message: `Planet "${targetId}" must be the selected Fleet's current stationary location`,
    })
  }
  return
}
function evaluateDifferentOrigin({
  state,
  actionId,
  targetTag,
  targetId,
  selectedTargets,
  evaluation,
  constraint,
}: TargetEvaluationInput & {
  target: NonNullable<ReturnType<typeof getTargetEntity>>
  constraint: Extract<TargetDefinition["constraints"][number], { type: "DIFFERENT_FROM_FLEET_ORIGIN" }>
}): void {
  const sourceFleetTag = constraint.references.sourceFleetTag
  const sourceFleetId = getOwnRecordValue(selectedTargets, sourceFleetTag)
  if (sourceFleetId === undefined) {
    addIssue(evaluation, {
      code: "DEPENDENCY_INCOMPLETE",
      actionId,
      targetTag,
      message: `Choose source Fleet "${sourceFleetTag}" before choosing this destination`,
    })
    return
  }
  const sourceFleet = getOwnRecordValue(state.fleets, branded<FleetId>(sourceFleetId))
  if (sourceFleet === undefined) {
    addIssue(evaluation, {
      code: "DEPENDENCY_INVALID",
      actionId,
      targetTag,
      message: `Source Fleet "${sourceFleetId}" is unavailable for this destination`,
    })
  } else if (sourceFleet.originPlanetId === targetId) {
    addIssue(evaluation, {
      code: "SAME_AS_ORIGIN",
      actionId,
      targetTag,
      message: "Choose a destination Planet other than the Fleet's current Planet",
    })
  }
  return
}
