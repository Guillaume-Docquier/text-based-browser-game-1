import { branded, indexBy } from "@guillaume-docquier/tools-ts"
import { NonNegativeNumberSchema, PositiveNumberSchema, typedParse } from "@guillaume-docquier/tools-ts/schemas"
import { describe, expect, it } from "vitest"
import { computeAvailableActions } from "#shared/action-submission/computeAvailableActions.ts"
import {
  evaluateActionSelection,
  evaluateTargetCandidate,
  type ActionSelectionDraft,
} from "#shared/action-submission/evaluateActionSelection.ts"
import { createResourcesStub } from "#shared/domain/resources/Resources.stub.ts"
import { ResourceType } from "#shared/domain/resources/ResourceType.ts"
import { ActionDefinitionSchema } from "#shared/domain/ruleset/action-definitions/ActionDefinition.ts"
import type { InputTag } from "#shared/domain/ruleset/action-definitions/InputTag.ts"
import { PositiveIntegerSchema } from "#shared/domain/ruleset/action-definitions/PositiveInteger.ts"
import type { TargetTag } from "#shared/domain/ruleset/action-definitions/TargetTag.ts"
import { FleetMoveEffectDefinition } from "#shared/domain/ruleset/effect-definitions/FleetMoveEffectDefinition.ts"
import { createRulesetStub } from "#shared/domain/ruleset/Ruleset.stub.ts"
import { Ruleset } from "#shared/domain/ruleset/Ruleset.ts"
import { DifferentFromFleetOriginConstraint } from "#shared/domain/ruleset/target-definitions/DifferentFromFleetOriginTargetConstraint.ts"
import { OwnedBySubmittingPlayerConstraint } from "#shared/domain/ruleset/target-definitions/OwnedBySubmittingPlayerTargetConstraint.ts"
import { StationaryFleetConstraint } from "#shared/domain/ruleset/target-definitions/StationaryFleetTargetConstraint.ts"
import { TargetType } from "#shared/domain/ruleset/target-definitions/TargetType.ts"
import { WithinFleetRangeConstraint } from "#shared/domain/ruleset/target-definitions/WithinFleetRangeTargetConstraint.ts"
import { createSubmittedActionStub } from "#shared/domain/turns/actions/Action.stub.ts"
import type { ActionId } from "#shared/domain/turns/actions/ActionId.ts"
import { createFleetStub } from "#shared/domain/world/fleets/Fleet.stub.ts"
import { createPlanetStub } from "#shared/domain/world/planets/Planet.stub.ts"
import type { PlanetId } from "#shared/domain/world/planets/PlanetId.ts"
import { FleetActionSelectionParity, FleetActionSelectionParityActionPool } from "#shared/testing/FleetActionSelectionParity.ts"
import { MoveFleetImproved, MoveFleetStandard } from "#shared/testing/test-ruleset/action-definitions/move-fleet.ts"
import { TestRuleset } from "#shared/testing/test-ruleset/TestRuleset.ts"
import { assertStandardSubmission } from "./evaluateActionSelection.assertions.test-support.ts"
import { replaceActionById, createFixture, createSubmission, createDraft, withSubmissions } from "./evaluateActionSelection.test-support.ts"

describe("evaluateActionSelection", () => {
  it.each([
    ["MOVE_FLEET_1", "MOVE_FLEET_2", 30, 21],
    ["MOVE_FLEET_2", "MOVE_FLEET_1", 30, 21],
    ["MOVE_FLEET_2", "MOVE_FLEET_1", 50, 1],
  ])(
    "should attribute overcommitted source candidates to every allocation regardless of Action ID order: draft %s, retained %s",
    (draftId, retainedId, retainedStrength, draftStrength) => {
      // Arrange
      const fixture = createFixture()
      const draftActionId = branded<ActionId>(draftId)
      const retainedActionId = branded<ActionId>(retainedId)
      const state = withSubmissions(fixture.state, [createSubmission(fixture, retainedActionId, retainedStrength)])
      const draft = createDraft(fixture, draftActionId, draftStrength)

      // Act
      const candidate = evaluateTargetCandidate({
        state,
        ruleset: fixture.ruleset,
        draft,
        targetTag: branded<TargetTag>("fleet"),
        targetId: fixture.fleetId,
      })

      // Assert
      expect(candidate.candidateStatus).toBe("INELIGIBLE")
      expect(candidate.candidateIssues).toContainEqual(
        expect.objectContaining({
          code: "INSUFFICIENT_STRENGTH",
          actionId: draftActionId,
          targetTag: branded<TargetTag>("fleet"),
        }),
      )
      expect(candidate.strengthCommitments[fixture.fleetId]).toBe(retainedStrength + draftStrength)
    },
  )

  it("should reject a fully committed source candidate when the draft force is blank", () => {
    // Arrange
    const fixture = createFixture()
    const state = withSubmissions(fixture.state, [createSubmission(fixture, fixture.secondActionId, 50)])
    const draft: ActionSelectionDraft = { actionId: fixture.firstActionId, selectedTargets: {}, selectedInputs: {} }

    // Act
    const candidate = evaluateTargetCandidate({
      state,
      ruleset: fixture.ruleset,
      draft,
      targetTag: branded<TargetTag>("fleet"),
      targetId: fixture.fleetId,
    })

    // Assert
    expect(candidate.remainingStrength[fixture.fleetId]).toBe(0)
    expect(candidate.candidateStatus).toBe("INELIGIBLE")
    expect(candidate.candidateIssues).toContainEqual(
      expect.objectContaining({
        code: "INSUFFICIENT_STRENGTH",
        actionId: fixture.firstActionId,
        targetTag: branded<TargetTag>("fleet"),
      }),
    )
  })

  it("should keep affordable and incomplete source candidates selectable after replacing one submission", () => {
    // Arrange
    const fixture = createFixture()
    const firstSubmission = createSubmission(fixture, fixture.firstActionId, 20)
    const secondSubmission = createSubmission(fixture, fixture.secondActionId, 30)
    const state = withSubmissions(fixture.state, [firstSubmission, secondSubmission])
    const replacementDraft: ActionSelectionDraft = {
      actionId: fixture.firstActionId,
      selectedTargets: { [branded<TargetTag>("fleet")]: fixture.fleetId },
      selectedInputs: { [branded<InputTag>("strength")]: 19 },
    }
    const incompleteDraft: ActionSelectionDraft = { actionId: fixture.firstActionId, selectedTargets: {}, selectedInputs: {} }

    // Act
    const replacementCandidate = evaluateTargetCandidate({
      state,
      ruleset: fixture.ruleset,
      draft: replacementDraft,
      targetTag: branded<TargetTag>("fleet"),
      targetId: fixture.fleetId,
    })
    const incompleteCandidate = evaluateTargetCandidate({
      state: fixture.state,
      ruleset: fixture.ruleset,
      draft: incompleteDraft,
      targetTag: branded<TargetTag>("fleet"),
      targetId: fixture.fleetId,
    })

    // Assert
    expect(replacementCandidate.candidateStatus).toBe("ELIGIBLE")
    expect(replacementCandidate.strengthCommitments[fixture.fleetId]).toBe(49)
    expect(replacementCandidate.remainingStrength[fixture.fleetId]).toBe(1)
    expect(incompleteCandidate.candidateStatus).toBe("ELIGIBLE")
    expect(incompleteCandidate.candidateIssues).toStrictEqual([])
  })

  it("should keep blank source-candidate feedback invariant across Action ID and submission-order permutations", () => {
    // Arrange
    const fixture = createFixture()
    const permutations = [
      {
        actionOrder: [fixture.firstActionId, fixture.secondActionId],
        draftActionId: fixture.firstActionId,
        submissionOrder: [
          { actionId: fixture.firstActionId, strength: 20 },
          { actionId: fixture.secondActionId, strength: 30 },
        ],
      },
      {
        actionOrder: [fixture.secondActionId, fixture.firstActionId],
        draftActionId: fixture.secondActionId,
        submissionOrder: [
          { actionId: fixture.firstActionId, strength: 30 },
          { actionId: fixture.secondActionId, strength: 20 },
        ],
      },
    ] as const

    // Act
    const feedback = permutations.map(({ actionOrder, draftActionId, submissionOrder }) => {
      const ruleset = createRulesetStub({
        actionDefinitions: indexBy("id", [MoveFleetStandard]),
        actionPool: actionOrder.map((id) => ({ id, actionDefinitionId: MoveFleetStandard.id })),
      })
      const availableActions = computeAvailableActions({ playerIds: [fixture.playerId], ruleset })
      const submissions = submissionOrder.map(({ actionId, strength }) => createSubmission(fixture, actionId, strength))
      const state = withSubmissions({ ...fixture.state, actions: availableActions }, submissions)
      const candidate = evaluateTargetCandidate({
        state,
        ruleset,
        draft: { actionId: draftActionId, selectedTargets: {}, selectedInputs: {} },
        targetTag: branded<TargetTag>("fleet"),
        targetId: fixture.fleetId,
      })

      return {
        status: candidate.status,
        candidateStatus: candidate.candidateStatus,
        candidateIssues: candidate.candidateIssues.map(({ code }) => code),
        missingTargets: candidate.missingTargets,
        missingInputs: candidate.missingInputs,
        strengthCommitment: candidate.strengthCommitments[fixture.fleetId],
        remainingStrength: candidate.remainingStrength[fixture.fleetId],
        resourceCommitments: candidate.resourceCommitments,
      }
    })

    // Assert
    expect(feedback[0]).toStrictEqual(feedback[1])
    expect(feedback[0]).toStrictEqual({
      status: "INCOMPLETE",
      candidateStatus: "ELIGIBLE",
      candidateIssues: [],
      missingTargets: [branded<TargetTag>("planet")],
      missingInputs: [branded<InputTag>("strength")],
      strengthCommitment: 30,
      remainingStrength: 20,
      resourceCommitments: {
        [ResourceType.INFLUENCE]: 6,
        [ResourceType.METAL]: 0,
        [ResourceType.FUEL]: 2,
        [ResourceType.ENERGY]: 0,
        [ResourceType.COLONY]: 0,
      },
    })
  })

  it("should aggregate allocations across different movement definitions", () => {
    expect.hasAssertions()
    // Arrange
    const fixture = createFixture()
    const firstActionId = branded<ActionId>("MOVE_FLEET_STANDARD_1")
    const secondActionId = branded<ActionId>("MOVE_FLEET_IMPROVED_1")
    const improvedOnlyPlanetId = branded<PlanetId>("improved-only-range-planet")
    const ruleset = Ruleset.create({ ...TestRuleset, actionPool: FleetActionSelectionParityActionPool })
    const improvedSubmission = createSubmittedActionStub({
      id: secondActionId,
      playerId: fixture.playerId,
      actionDefinitionId: MoveFleetImproved.id,
      selectedTargets: { fleet: fixture.fleetId, planet: fixture.destinationId },
      selectedInputs: { strength: FleetActionSelectionParity.improvedStrength },
    })
    const state = {
      ...fixture.state,
      resources: createResourcesStub({
        [ResourceType.INFLUENCE]: FleetActionSelectionParity.totalResources.INFLUENCE,
        [ResourceType.FUEL]: FleetActionSelectionParity.totalResources.FUEL,
      }),
      planets: indexBy("id", [
        createPlanetStub({
          id: fixture.originId,
          ownerPlayerId: fixture.playerId,
          x: FleetActionSelectionParity.origin.x,
          y: FleetActionSelectionParity.origin.y,
        }),
        createPlanetStub({
          id: fixture.destinationId,
          ownerPlayerId: null,
          x: FleetActionSelectionParity.destination.x,
          y: FleetActionSelectionParity.destination.y,
        }),
        createPlanetStub({
          id: improvedOnlyPlanetId,
          ownerPlayerId: null,
          x: FleetActionSelectionParity.origin.x + 7,
          y: FleetActionSelectionParity.origin.y,
        }),
      ]),
      fleets: indexBy("id", [
        createFleetStub({
          id: fixture.fleetId,
          ownerPlayerId: fixture.playerId,
          originPlanetId: fixture.originId,
          strength: FleetActionSelectionParity.sourceStrength,
        }),
      ]),
      actions: replaceActionById(computeAvailableActions({ playerIds: [fixture.playerId], ruleset }), improvedSubmission),
    }

    assertStandardSubmission({ firstActionId, fixture, state, ruleset, improvedOnlyPlanetId, secondActionId, improvedSubmission })
  })

  it("should reject changing or cancelling an Action instance while a Fleet occupies it", () => {
    // Arrange
    const fixture = createFixture()
    const continuation = createSubmission(fixture, fixture.firstActionId, 20)
    const movingFleet = createFleetStub({
      id: fixture.fleetId,
      ownerPlayerId: fixture.playerId,
      originPlanetId: fixture.originId,
      strength: 20,
      destinationPlanetId: fixture.destinationId,
      distanceToEnd: typedParse(NonNegativeNumberSchema, 4),
      movement: {
        speed: typedParse(PositiveNumberSchema, 1),
        departureTurn: typedParse(PositiveIntegerSchema, 1),
        submission: continuation,
        pendingArrivalEffects: [],
      },
    })
    const state = { ...fixture.state, fleets: indexBy("id", [movingFleet]) }

    // Act
    const evaluation = evaluateActionSelection({
      state,
      ruleset: fixture.ruleset,
      draft: { actionId: fixture.firstActionId, selectedTargets: {}, selectedInputs: {} },
    })

    // Assert
    expect(evaluation.status).toBe("INELIGIBLE")
    expect(evaluation.issues.map(({ code }) => code)).toContain("ACTION_ALREADY_IN_PROGRESS")
  })

  it("should evaluate movement through arbitrary role tags instead of conventional field names", () => {
    // Arrange
    const fixture = createFixture()
    const customMovement = typedParse(ActionDefinitionSchema, {
      ...MoveFleetStandard,
      id: "RENAMED_MOVEMENT",
      name: "Renamed movement",
      inputs: { units: { type: "POSITIVE_INTEGER", label: "Units" } },
      targets: {
        originForce: {
          targetType: TargetType.FLEET,
          constraints: [OwnedBySubmittingPlayerConstraint.create(), StationaryFleetConstraint.create()],
        },
        landingSite: {
          targetType: TargetType.PLANET,
          constraints: [
            WithinFleetRangeConstraint.create({ sourceFleetTag: "originForce", maxDistance: 5 }),
            DifferentFromFleetOriginConstraint.create({ sourceFleetTag: "originForce" }),
          ],
        },
      },
      effects: [FleetMoveEffectDefinition.create({ fleetTag: "originForce", planetTag: "landingSite", strengthTag: "units", speed: 0.1 })],
    })
    const ruleset = createRulesetStub({ actionDefinitions: indexBy("id", [customMovement]) })
    const state = { ...fixture.state, actions: computeAvailableActions({ playerIds: [fixture.playerId], ruleset }) }

    // Act
    const evaluation = evaluateActionSelection({
      state,
      ruleset,
      draft: {
        actionId: branded<ActionId>("RENAMED_MOVEMENT_1"),
        selectedTargets: {
          [branded<TargetTag>("originForce")]: fixture.fleetId,
          [branded<TargetTag>("landingSite")]: fixture.destinationId,
        },
        selectedInputs: { [branded<InputTag>("units")]: 10 },
      },
    })

    // Assert
    expect(evaluation.status).toBe("ELIGIBLE")
    expect(evaluation.strengthCommitments[fixture.fleetId]).toBe(10)
    expect(evaluation.resourceCommitments).toStrictEqual({
      [ResourceType.INFLUENCE]: 3,
      [ResourceType.METAL]: 0,
      [ResourceType.FUEL]: 1,
      [ResourceType.ENERGY]: 0,
      [ResourceType.COLONY]: 0,
    })
  })
})
