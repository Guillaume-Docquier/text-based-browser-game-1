import { branded } from "@guillaume-docquier/tools-ts"
import type { FleetId } from "#lib/db/fleets/FleetId.ts"
import type { PlanetId } from "#lib/db/planets/PlanetId.ts"
import type { PlayerId } from "#lib/db/players/PlayerId.ts"
import { createResourcesStub } from "#lib/rules-engine/ruleset-model/mechanics/Resources.stub.ts"
import { OwnedBySubmittingPlayerConstraint } from "#lib/rules-engine/ruleset-model/target-constraints/implementations/OwnedBySubmittingPlayerConstraint.ts"
import type { ResolvedTarget } from "#lib/rules-engine/ruleset-model/target-constraints/ResolvedTarget.ts"
import type { TargetConstraintEvaluationContext } from "#lib/rules-engine/ruleset-model/target-constraints/TargetConstraintEvaluation.ts"
import { createTurnStateStub } from "#lib/rules-engine/turn-resolution/TurnState.stub.ts"

/**
 * Creates a target constraint evaluation context with valid defaults.
 */
export function createTargetConstraintEvaluationContextStub(
  overrides?: Partial<TargetConstraintEvaluationContext<ReturnType<typeof OwnedBySubmittingPlayerConstraint.create>>>,
): TargetConstraintEvaluationContext<ReturnType<typeof OwnedBySubmittingPlayerConstraint.create>> {
  const submittingPlayerId = branded<PlayerId>("player-1")
  return {
    constraint: OwnedBySubmittingPlayerConstraint.create(),
    target: createFleetTargetStub(submittingPlayerId),
    targetTag: "target",
    submittingPlayerId,
    turnState: createTurnStateStub(),
    referenceTargets: {},
    ...overrides,
  }
}

/**
 * Creates a resolved Fleet target.
 */
export function createFleetTargetStub(playerId: PlayerId): ResolvedTarget {
  return {
    type: "FLEET",
    entity: {
      id: branded<FleetId>("fleet-1"),
      playerId,
      strength: 1,
      originPlanetId: branded<PlanetId>(1),
    },
  }
}

/**
 * Creates a resolved Planet target.
 */
export function createPlanetTargetStub(ownerPlayerId: PlayerId | null): ResolvedTarget {
  return {
    type: "PLANET",
    entity: {
      id: branded<PlanetId>(1),
      ownerPlayerId,
      x: 0,
      y: 0,
    },
  }
}

/**
 * Creates a resolved Player target.
 */
export function createPlayerTargetStub(playerId: PlayerId): ResolvedTarget {
  return {
    type: "PLAYER",
    entity: {
      id: playerId,
      resources: createResourcesStub(),
    },
  }
}
