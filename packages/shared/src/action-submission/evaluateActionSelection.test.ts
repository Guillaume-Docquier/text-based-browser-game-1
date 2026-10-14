import { branded, indexBy } from "@guillaume-docquier/tools-ts"
import { NonNegativeNumberSchema, PositiveNumberSchema, typedParse } from "@guillaume-docquier/tools-ts/schemas"
import { describe, expect, it } from "vitest"
import { computeAvailableActions } from "#shared/action-submission/computeAvailableActions.ts"
import {
  evaluateActionSelection,
  evaluateSubmittedActions,
  evaluateTargetCandidate,
  type ActionSelectionDraft,
  type EligibilityState,
} from "#shared/action-submission/evaluateActionSelection.ts"
import { PlayerIdSchema } from "#shared/domain/players/PlayerId.ts"
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
import type { FleetId } from "#shared/domain/world/fleets/FleetId.ts"
import { createPlanetStub } from "#shared/domain/world/planets/Planet.stub.ts"
import type { PlanetId } from "#shared/domain/world/planets/PlanetId.ts"
import { FleetActionSelectionParity, FleetActionSelectionParityActionPool } from "#shared/testing/FleetActionSelectionParity.ts"
import { StationaryAssaultTest } from "#shared/testing/test-ruleset/action-definitions/attack-move.ts"
import { GainInfluence } from "#shared/testing/test-ruleset/action-definitions/gain-influence.ts"
import { MoveFleetImproved, MoveFleetStandard } from "#shared/testing/test-ruleset/action-definitions/move-fleet.ts"
import { TestRuleset } from "#shared/testing/test-ruleset/TestRuleset.ts"
import {
  replaceActionById,
  normalizeFleetSelectionInput,
  createFixture,
  createSubmission,
  createDraft,
  withSubmissions,
} from "./evaluateActionSelection.test-support.ts"

describe("evaluateActionSelection", () => {
  it("should replace the edited instance and aggregate partial Strength and resource commitments", () => {
    // Arrange
    const fixture = createFixture()
    const firstSubmission = createSubmission(fixture, fixture.firstActionId, 20)
    const secondSubmission = createSubmission(fixture, fixture.secondActionId, 15)
    const state = withSubmissions(fixture.state, [firstSubmission, secondSubmission])

    // Act
    const evaluation = evaluateActionSelection({
      state,
      ruleset: fixture.ruleset,
      draft: createDraft(fixture, fixture.firstActionId, 35),
    })

    // Assert
    expect(evaluation.status).toBe("ELIGIBLE")
    expect(evaluation.strengthCommitments[fixture.fleetId]).toBe(50)
    expect(evaluation.remainingStrength[fixture.fleetId]).toBe(0)
    expect(evaluation.resourceCommitments).toStrictEqual({
      [ResourceType.INFLUENCE]: 6,
      [ResourceType.METAL]: 0,
      [ResourceType.FUEL]: 2,
      [ResourceType.ENERGY]: 0,
      [ResourceType.COLONY]: 0,
    })
  })

  it("should report insufficient aggregate Strength while keeping the submitted partial amount", () => {
    // Arrange
    const fixture = createFixture()
    const firstSubmission = createSubmission(fixture, fixture.firstActionId, 20)
    const secondSubmission = createSubmission(fixture, fixture.secondActionId, 15)
    const state = withSubmissions(fixture.state, [firstSubmission, secondSubmission])

    // Act
    const evaluation = evaluateActionSelection({
      state,
      ruleset: fixture.ruleset,
      draft: createDraft(fixture, fixture.firstActionId, 36),
    })

    // Assert
    expect(evaluation.status).toBe("INELIGIBLE")
    expect(evaluation.strengthCommitments[fixture.fleetId]).toBe(51)
    expect(evaluation.issues.map(({ code }) => code)).toContain("INSUFFICIENT_STRENGTH")
  })

  it("should reject a 51 Strength request against an unreserved 50 Strength source", () => {
    // Arrange
    const fixture = createFixture()

    // Act
    const evaluation = evaluateActionSelection({
      state: fixture.state,
      ruleset: fixture.ruleset,
      draft: createDraft(fixture, fixture.firstActionId, 51),
    })

    // Assert
    expect(evaluation.status).toBe("INELIGIBLE")
    expect(evaluation.strengthCommitments[fixture.fleetId]).toBe(51)
    expect(evaluation.remainingStrength[fixture.fleetId]).toBe(0)
    expect(evaluation.issues.map(({ code }) => code)).toContain("INSUFFICIENT_STRENGTH")
  })

  it.each([
    ["one", 1, 49],
    ["full", 50, 0],
  ])("should accept an unreserved %s Strength allocation", (_label, strength, remainingStrength) => {
    // Arrange
    const fixture = createFixture()

    // Act
    const evaluation = evaluateActionSelection({
      state: fixture.state,
      ruleset: fixture.ruleset,
      draft: createDraft(fixture, fixture.firstActionId, strength),
    })

    // Assert
    expect(evaluation.status).toBe("ELIGIBLE")
    expect(evaluation.strengthCommitments[fixture.fleetId]).toBe(strength)
    expect(evaluation.remainingStrength[fixture.fleetId]).toBe(remainingStrength)
    expect(evaluation.resourceCommitments).toStrictEqual({
      [ResourceType.INFLUENCE]: 3,
      [ResourceType.METAL]: 0,
      [ResourceType.FUEL]: 1,
      [ResourceType.ENERGY]: 0,
      [ResourceType.COLONY]: 0,
    })
  })

  it.each([
    ["zero", 0],
    ["negative", -1],
    ["fractional", 1.5],
    ["NaN", Number.NaN],
    ["infinite", Number.POSITIVE_INFINITY],
    ["unsafe integer", Number.MAX_SAFE_INTEGER + 1],
  ])("should reject %s Strength input", (_description, strength) => {
    // Arrange
    const fixture = createFixture()

    // Act
    const evaluation = evaluateActionSelection({
      state: fixture.state,
      ruleset: fixture.ruleset,
      draft: createDraft(fixture, fixture.firstActionId, strength),
    })

    // Assert
    expect(evaluation.status).toBe("INELIGIBLE")
    expect(evaluation.issues).toContainEqual(expect.objectContaining({ code: "INVALID_INPUT", inputTag: branded<InputTag>("strength") }))
    expect(evaluation.strengthCommitments[fixture.fleetId]).toBeUndefined()
  })

  it("should keep blank input incomplete and reject undeclared input and target tags", () => {
    // Arrange
    const fixture = createFixture()

    // Act
    const blankInput = evaluateActionSelection({
      state: fixture.state,
      ruleset: fixture.ruleset,
      draft: { actionId: fixture.firstActionId, selectedTargets: {}, selectedInputs: { [branded<InputTag>("strength")]: undefined } },
    })
    const extraInput = evaluateActionSelection({
      state: fixture.state,
      ruleset: fixture.ruleset,
      draft: {
        ...createDraft(fixture, fixture.firstActionId, 10),
        selectedInputs: { [branded<InputTag>("strength")]: 10, [branded<InputTag>("unauthorized")]: 1 },
      },
    })
    const extraTarget = evaluateActionSelection({
      state: fixture.state,
      ruleset: fixture.ruleset,
      draft: {
        ...createDraft(fixture, fixture.firstActionId, 10),
        selectedTargets: {
          [branded<TargetTag>("fleet")]: fixture.fleetId,
          [branded<TargetTag>("planet")]: fixture.destinationId,
          [branded<TargetTag>("unauthorized")]: fixture.destinationId,
        },
      },
    })

    // Assert
    expect(blankInput.status).toBe("INCOMPLETE")
    expect(blankInput.issues).toContainEqual(expect.objectContaining({ code: "MISSING_INPUT", inputTag: branded<InputTag>("strength") }))
    expect(extraInput.issues).toContainEqual(
      expect.objectContaining({ code: "UNEXPECTED_INPUT", inputTag: branded<InputTag>("unauthorized") }),
    )
    expect(extraTarget.issues).toContainEqual(
      expect.objectContaining({ code: "UNEXPECTED_TARGET", targetTag: branded<TargetTag>("unauthorized") }),
    )
  })

  it.each(["constructor", "toString"])("should reject inherited input name %s", (inputTag) => {
    // Arrange
    const fixture = createFixture()
    const ruleset = createRulesetStub({ actionDefinitions: indexBy("id", [GainInfluence]) })
    const state = {
      ...fixture.state,
      actions: computeAvailableActions({ playerIds: [fixture.playerId], ruleset }),
    }

    // Act
    const evaluation = evaluateActionSelection({
      state,
      ruleset,
      draft: {
        actionId: branded<ActionId>("GAIN_INFLUENCE_1"),
        selectedTargets: {},
        selectedInputs: Object.fromEntries([[branded<InputTag>(inputTag), 1]]),
      },
    })

    // Assert
    expect(evaluation.status).toBe("INELIGIBLE")
    expect(evaluation.issues).toContainEqual(expect.objectContaining({ code: "UNEXPECTED_INPUT", inputTag: branded<InputTag>(inputTag) }))
  })

  it("should reject a target entity whose type does not match its declared slot", () => {
    // Arrange
    const fixture = createFixture()

    // Act
    const evaluation = evaluateActionSelection({
      state: fixture.state,
      ruleset: fixture.ruleset,
      draft: {
        actionId: fixture.firstActionId,
        selectedTargets: { [branded<TargetTag>("fleet")]: fixture.destinationId, [branded<TargetTag>("planet")]: fixture.destinationId },
        selectedInputs: { [branded<InputTag>("strength")]: 10 },
      },
    })

    // Assert
    expect(evaluation.status).toBe("INELIGIBLE")
    expect(evaluation.issues).toContainEqual(
      expect.objectContaining({ code: "TARGET_TYPE_MISMATCH", targetTag: branded<TargetTag>("fleet") }),
    )
  })

  it("should use dependent target constraints for candidates and reject an out-of-range destination", () => {
    // Arrange
    const fixture = createFixture()
    const draft = createDraft(fixture, fixture.firstActionId, 10)
    const boundaryPlanet = createPlanetStub({
      id: branded<PlanetId>("boundary-planet"),
      ownerPlayerId: null,
      x: 3,
      y: 4,
    })
    const justOutsidePlanet = createPlanetStub({
      id: branded<PlanetId>("just-outside-planet"),
      ownerPlayerId: null,
      x: 3,
      y: 4.001,
    })
    const withBoundaryPlanets = {
      ...fixture.state,
      planets: { ...fixture.state.planets, [boundaryPlanet.id]: boundaryPlanet, [justOutsidePlanet.id]: justOutsidePlanet },
    }

    // Act
    const inRange = evaluateTargetCandidate({
      state: withBoundaryPlanets,
      ruleset: fixture.ruleset,
      draft,
      targetTag: branded("planet"),
      targetId: boundaryPlanet.id,
    })
    const outOfRange = evaluateTargetCandidate({
      state: withBoundaryPlanets,
      ruleset: fixture.ruleset,
      draft,
      targetTag: branded("planet"),
      targetId: justOutsidePlanet.id,
    })
    const withoutSource = evaluateTargetCandidate({
      state: fixture.state,
      ruleset: fixture.ruleset,
      draft: { actionId: fixture.firstActionId, selectedTargets: {}, selectedInputs: { [branded<InputTag>("strength")]: 10 } },
      targetTag: branded("planet"),
      targetId: fixture.destinationId,
    })
    const shiftedOrigin = createPlanetStub({ ...fixture.state.planets[fixture.originId], x: 0, y: 10 })
    const afterSourceChange = evaluateTargetCandidate({
      state: { ...fixture.state, planets: { ...fixture.state.planets, [shiftedOrigin.id]: shiftedOrigin } },
      ruleset: fixture.ruleset,
      draft,
      targetTag: branded("planet"),
      targetId: fixture.destinationId,
    })
    const coLocatedPlanet = createPlanetStub({
      id: branded<PlanetId>("distinct-co-located-planet"),
      ownerPlayerId: null,
      x: 0,
      y: 0,
    })
    const coLocatedCandidate = evaluateTargetCandidate({
      state: { ...fixture.state, planets: { ...fixture.state.planets, [coLocatedPlanet.id]: coLocatedPlanet } },
      ruleset: fixture.ruleset,
      draft,
      targetTag: branded("planet"),
      targetId: coLocatedPlanet.id,
    })
    const originCandidate = evaluateTargetCandidate({
      state: fixture.state,
      ruleset: fixture.ruleset,
      draft,
      targetTag: branded("planet"),
      targetId: fixture.originId,
    })
    const missingOriginFleet = createFleetStub({
      id: fixture.fleetId,
      ownerPlayerId: fixture.playerId,
      originPlanetId: branded<PlanetId>("missing-origin-planet"),
      strength: 50,
      name: "Source Fleet",
    })
    const missingOriginCandidate = evaluateTargetCandidate({
      state: { ...fixture.state, fleets: { ...fixture.state.fleets, [missingOriginFleet.id]: missingOriginFleet } },
      ruleset: fixture.ruleset,
      draft,
      targetTag: branded("planet"),
      targetId: fixture.destinationId,
    })

    // Assert
    expect(inRange.candidateStatus).toBe("ELIGIBLE")
    expect(outOfRange.candidateStatus).toBe("INELIGIBLE")
    expect(outOfRange.candidateIssues.map(({ code }) => code)).toContain("OUT_OF_RANGE")
    expect(withoutSource.candidateStatus).toBe("INCOMPLETE")
    expect(withoutSource.candidateIssues.map(({ code }) => code)).toContain("DEPENDENCY_INCOMPLETE")
    expect(afterSourceChange.candidateStatus).toBe("INELIGIBLE")
    expect(afterSourceChange.candidateIssues.map(({ code }) => code)).toContain("OUT_OF_RANGE")
    expect(coLocatedCandidate.candidateStatus).toBe("ELIGIBLE")
    expect(coLocatedCandidate.candidateIssues).toStrictEqual([])
    expect(originCandidate.candidateStatus).toBe("INELIGIBLE")
    expect(originCandidate.candidateIssues.map(({ code }) => code)).toContain("SAME_AS_ORIGIN")
    expect(missingOriginCandidate.candidateStatus).toBe("INELIGIBLE")
    expect(missingOriginCandidate.candidateIssues.map(({ code }) => code)).toContain("MISSING_ORIGIN")
  })

  it("should order equivalent invalid stationary Assault selections independently of property insertion order", () => {
    // Arrange
    const fixture = createFixture()
    const enemyPlayerId = typedParse(PlayerIdSchema, "00000000-0000-4000-8000-000000000012")
    const enemyFleet = createFleetStub({
      id: branded<FleetId>("fleet-order-enemy"),
      ownerPlayerId: enemyPlayerId,
      originPlanetId: fixture.originId,
      strength: 30,
    })
    const ruleset = createRulesetStub({
      actionDefinitions: indexBy("id", [StationaryAssaultTest]),
      actionPool: [{ id: fixture.firstActionId, actionDefinitionId: StationaryAssaultTest.id }],
    })
    const state: EligibilityState = {
      ...fixture.state,
      players: indexBy("id", [
        { id: fixture.playerId, ownerPlayerId: fixture.playerId },
        { id: enemyPlayerId, ownerPlayerId: enemyPlayerId },
      ]),
      fleets: indexBy("id", [enemyFleet]),
      actions: computeAvailableActions({ playerIds: [fixture.playerId], ruleset }),
    }
    const stationTag = branded<TargetTag>("station")
    const battlePlanetTag = branded<TargetTag>("battlePlanet")
    const firstTargets = { [stationTag]: enemyFleet.id, [battlePlanetTag]: fixture.destinationId }
    const reversedTargets = { [battlePlanetTag]: fixture.destinationId, [stationTag]: enemyFleet.id }

    // Act
    const first = evaluateActionSelection({
      state,
      ruleset,
      draft: { actionId: fixture.firstActionId, selectedTargets: firstTargets, selectedInputs: {} },
    })
    const reversed = evaluateActionSelection({
      state,
      ruleset,
      draft: { actionId: fixture.firstActionId, selectedTargets: reversedTargets, selectedInputs: {} },
    })

    // Assert
    expect(first.status).toBe("INELIGIBLE")
    expect(first.issues.map(({ code, targetTag }) => ({ code, targetTag }))).toStrictEqual([
      { code: "DEPENDENCY_INVALID", targetTag: battlePlanetTag },
      { code: "TARGET_NOT_OWNED", targetTag: stationTag },
    ])
    expect(reversed).toStrictEqual(first)
  })

  it("should reject enemy, moving, exhausted, and unknown source Fleets", () => {
    // Arrange
    const fixture = createFixture()
    const draftFor = (fleetId: FleetId): ActionSelectionDraft => ({
      actionId: fixture.firstActionId,
      selectedTargets: {
        [branded<TargetTag>("fleet")]: fleetId,
        [branded<TargetTag>("planet")]: fixture.destinationId,
      },
      selectedInputs: { [branded<InputTag>("strength")]: 1 },
    })
    const enemyPlayerId = typedParse(PlayerIdSchema, "00000000-0000-4000-8000-000000000012")
    const enemyFleet = createFleetStub({
      id: branded<FleetId>("enemy-fleet"),
      ownerPlayerId: enemyPlayerId,
      originPlanetId: fixture.originId,
      strength: 10,
    })
    const enemyState = { ...fixture.state, fleets: { ...fixture.state.fleets, [enemyFleet.id]: enemyFleet } }
    const exhaustedFleet = createFleetStub({
      ...fixture.state.fleets[fixture.fleetId],
      strength: 0,
    })
    const exhaustedState = { ...fixture.state, fleets: { ...fixture.state.fleets, [exhaustedFleet.id]: exhaustedFleet } }
    const movingSubmission = createSubmission(fixture, fixture.secondActionId, 10)
    const movingFleet = createFleetStub({
      ...fixture.state.fleets[fixture.fleetId],
      destinationPlanetId: fixture.destinationId,
      distanceToEnd: typedParse(NonNegativeNumberSchema, 4),
      movement: {
        speed: typedParse(PositiveNumberSchema, 1),
        departureTurn: typedParse(PositiveIntegerSchema, 1),
        submission: movingSubmission,
        pendingArrivalEffects: [],
      },
    })
    const movingState = { ...fixture.state, fleets: { ...fixture.state.fleets, [movingFleet.id]: movingFleet } }
    const unknownFleetId = branded<FleetId>("unknown-fleet")

    // Act
    const enemyEvaluation = evaluateActionSelection({
      state: enemyState,
      ruleset: fixture.ruleset,
      draft: draftFor(enemyFleet.id),
    })
    const exhaustedEvaluation = evaluateActionSelection({
      state: exhaustedState,
      ruleset: fixture.ruleset,
      draft: draftFor(exhaustedFleet.id),
    })
    const movingEvaluation = evaluateActionSelection({
      state: movingState,
      ruleset: fixture.ruleset,
      draft: draftFor(movingFleet.id),
    })
    const unknownEvaluation = evaluateActionSelection({
      state: fixture.state,
      ruleset: fixture.ruleset,
      draft: draftFor(unknownFleetId),
    })

    // Assert
    expect(enemyEvaluation.issues.map(({ code }) => code)).toContain("TARGET_NOT_OWNED")
    expect(exhaustedEvaluation.issues.map(({ code }) => code)).toContain("FLEET_HAS_NO_STRENGTH")
    expect(movingEvaluation.issues.map(({ code }) => code)).toContain("FLEET_NOT_STATIONARY")
    expect(unknownEvaluation.issues.map(({ code }) => code)).toContain("UNKNOWN_TARGET")
  })

  it("should not let a same-turn resource gain finance movement costs", () => {
    // Arrange
    const fixture = createFixture()
    const gainActionId = branded<ActionId>("GAIN_INFLUENCE_1")
    const ruleset = createRulesetStub({
      actionDefinitions: indexBy("id", [MoveFleetStandard, GainInfluence]),
      actionPool: [
        { id: fixture.firstActionId, actionDefinitionId: MoveFleetStandard.id },
        { id: gainActionId, actionDefinitionId: GainInfluence.id },
      ],
    })
    const state = {
      ...fixture.state,
      resources: createResourcesStub({ [ResourceType.INFLUENCE]: 2, [ResourceType.FUEL]: 1 }),
      actions: computeAvailableActions({ playerIds: [fixture.playerId], ruleset }),
    }
    const movementSubmission = createSubmittedActionStub({
      id: fixture.firstActionId,
      playerId: fixture.playerId,
      actionDefinitionId: MoveFleetStandard.id,
      selectedTargets: { fleet: fixture.fleetId, planet: fixture.destinationId },
      selectedInputs: { strength: 1 },
    })
    const gainSubmission = createSubmittedActionStub({
      id: gainActionId,
      playerId: fixture.playerId,
      actionDefinitionId: GainInfluence.id,
      selectedTargets: {},
      selectedInputs: {},
    })

    // Act
    const evaluation = evaluateSubmittedActions({
      state,
      ruleset,
      submissions: [gainSubmission, movementSubmission],
    })

    // Assert
    expect(evaluation.status).toBe("INELIGIBLE")
    expect(evaluation.issues).toContainEqual(
      expect.objectContaining({ code: "INSUFFICIENT_RESOURCES", resourceType: ResourceType.INFLUENCE }),
    )
    expect(evaluation.resourceCommitments).toStrictEqual({
      [ResourceType.INFLUENCE]: 3,
      [ResourceType.METAL]: 0,
      [ResourceType.FUEL]: 1,
      [ResourceType.ENERGY]: 0,
      [ResourceType.COLONY]: 0,
    })
  })

  it("should replace and cancel strength and resource reservations without double-counting", () => {
    // Arrange
    const fixture = createFixture()
    const firstSubmission = createSubmission(fixture, fixture.firstActionId, 20)
    const secondSubmission = createSubmission(fixture, fixture.secondActionId, 30)
    const state = withSubmissions(fixture.state, [firstSubmission, secondSubmission])

    // Act
    const reducedReplacement = evaluateActionSelection({
      state,
      ruleset: fixture.ruleset,
      draft: createDraft(fixture, fixture.firstActionId, 19),
    })
    const overcommittedReplacement = evaluateActionSelection({
      state,
      ruleset: fixture.ruleset,
      draft: createDraft(fixture, fixture.firstActionId, 21),
    })
    const afterFirstCancel = evaluateSubmittedActions({
      state,
      ruleset: fixture.ruleset,
      submissions: [secondSubmission],
    })
    const cannotReplaceAgainstRetainedSecond = evaluateActionSelection({
      state,
      ruleset: fixture.ruleset,
      draft: createDraft(fixture, fixture.firstActionId, 21),
    })
    const exactReplacement = evaluateActionSelection({
      state,
      ruleset: fixture.ruleset,
      draft: createDraft(fixture, fixture.firstActionId, 20),
    })
    const afterBothCancel = evaluateSubmittedActions({ state, ruleset: fixture.ruleset, submissions: [] })

    // Assert
    expect(reducedReplacement.status).toBe("ELIGIBLE")
    expect(reducedReplacement.strengthCommitments[fixture.fleetId]).toBe(49)
    expect(reducedReplacement.remainingStrength[fixture.fleetId]).toBe(1)
    expect(reducedReplacement.resourceCommitments).toStrictEqual({
      [ResourceType.INFLUENCE]: 6,
      [ResourceType.METAL]: 0,
      [ResourceType.FUEL]: 2,
      [ResourceType.ENERGY]: 0,
      [ResourceType.COLONY]: 0,
    })
    expect(overcommittedReplacement.status).toBe("INELIGIBLE")
    expect(overcommittedReplacement.strengthCommitments[fixture.fleetId]).toBe(51)
    expect(overcommittedReplacement.issues.map(({ code }) => code)).toContain("INSUFFICIENT_STRENGTH")
    expect(afterFirstCancel.strengthCommitments[fixture.fleetId]).toBe(30)
    expect(afterFirstCancel.remainingStrength[fixture.fleetId]).toBe(20)
    expect(afterFirstCancel.resourceCommitments).toStrictEqual({
      [ResourceType.INFLUENCE]: 3,
      [ResourceType.METAL]: 0,
      [ResourceType.FUEL]: 1,
      [ResourceType.ENERGY]: 0,
      [ResourceType.COLONY]: 0,
    })
    expect(cannotReplaceAgainstRetainedSecond.status).toBe("INELIGIBLE")
    expect(cannotReplaceAgainstRetainedSecond.strengthCommitments[fixture.fleetId]).toBe(51)
    expect(exactReplacement.status).toBe("ELIGIBLE")
    expect(exactReplacement.strengthCommitments[fixture.fleetId]).toBe(50)
    expect(exactReplacement.remainingStrength[fixture.fleetId]).toBe(0)
    expect(afterBothCancel.resourceCommitments).toStrictEqual({
      [ResourceType.INFLUENCE]: 0,
      [ResourceType.METAL]: 0,
      [ResourceType.FUEL]: 0,
      [ResourceType.ENERGY]: 0,
      [ResourceType.COLONY]: 0,
    })
    expect(afterBothCancel.remainingStrength[fixture.fleetId]).toBe(50)
  })

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
    const verifyStandardSubmissionPhase1 = (): void => {
      const standardSubmission = createSubmittedActionStub({
        id: firstActionId,
        playerId: fixture.playerId,
        actionDefinitionId: MoveFleetStandard.id,
        selectedTargets: { fleet: fixture.fleetId, planet: fixture.destinationId },
        selectedInputs: { strength: FleetActionSelectionParity.standardStrength },
      })
      const partialDraft = {
        actionId: firstActionId,
        selectedTargets: { [branded<TargetTag>("fleet")]: fixture.fleetId },
        selectedInputs: { [branded<InputTag>("strength")]: FleetActionSelectionParity.standardStrength },
      }
      const normalizedInput = normalizeFleetSelectionInput(state, ruleset, fixture, FleetActionSelectionParity, firstActionId)
      expect(normalizedInput).toStrictEqual(FleetActionSelectionParity.normalizedInput)
      const partialStandard = evaluateActionSelection({ state, ruleset, draft: partialDraft })

      const partialDestinationCandidate = evaluateTargetCandidate({
        state,
        ruleset,
        draft: partialDraft,
        targetTag: branded("planet"),
        targetId: fixture.destinationId,
      })
      const beyondStandardCandidate = evaluateTargetCandidate({
        state,
        ruleset,
        draft: partialDraft,
        targetTag: branded("planet"),
        targetId: improvedOnlyPlanetId,
      })
      const improvedRangeCandidate = evaluateTargetCandidate({
        state,
        ruleset,
        draft: {
          actionId: secondActionId,
          selectedTargets: { [branded<TargetTag>("fleet")]: fixture.fleetId },
          selectedInputs: { [branded<InputTag>("strength")]: FleetActionSelectionParity.improvedStrength },
        },
        targetTag: branded("planet"),
        targetId: improvedOnlyPlanetId,
      })

      // Act
      const evaluation = evaluateSubmittedActions({
        state,
        ruleset,
        submissions: [standardSubmission, improvedSubmission],
      })

      // Assert
      const assertPartialStandardState1 = (): void => {
        expect(partialStandard.status).toBe(FleetActionSelectionParity.partialExpected.status)
        expect(partialStandard.missingTargets).toStrictEqual(FleetActionSelectionParity.partialExpected.missingTargets)
        expect(partialStandard.missingInputs).toStrictEqual(FleetActionSelectionParity.partialExpected.missingInputs)
        expect(partialDestinationCandidate.candidateStatus).toBe("ELIGIBLE")
        expect(partialDestinationCandidate.candidateIssues).toStrictEqual([])
        expect(beyondStandardCandidate.candidateStatus).toBe("INELIGIBLE")
        expect(beyondStandardCandidate.candidateIssues.map(({ code }) => code)).toContain("OUT_OF_RANGE")
        expect(improvedRangeCandidate.candidateStatus).toBe("ELIGIBLE")
        expect(improvedRangeCandidate.candidateIssues).toStrictEqual([])
        expect(evaluation.status).toBe(FleetActionSelectionParity.expected.status)
        expect(evaluation.issues).toStrictEqual(FleetActionSelectionParity.expected.issues)
        expect(evaluation.missingTargets).toStrictEqual(FleetActionSelectionParity.expected.missingTargets)
        expect(evaluation.missingInputs).toStrictEqual(FleetActionSelectionParity.expected.missingInputs)
        expect(evaluation.strengthCommitments[fixture.fleetId]).toBe(FleetActionSelectionParity.expected.strengthCommitment)
        expect(evaluation.remainingStrength[fixture.fleetId]).toBe(FleetActionSelectionParity.expected.remainingStrength)
        expect(evaluation.resourceCommitments).toStrictEqual({
          [ResourceType.INFLUENCE]: FleetActionSelectionParity.expected.resourceCommitments.INFLUENCE,
          [ResourceType.METAL]: FleetActionSelectionParity.expected.resourceCommitments.METAL,
          [ResourceType.FUEL]: FleetActionSelectionParity.expected.resourceCommitments.FUEL,
          [ResourceType.ENERGY]: FleetActionSelectionParity.expected.resourceCommitments.ENERGY,
          [ResourceType.COLONY]: FleetActionSelectionParity.expected.resourceCommitments.COLONY,
        })
      }
      assertPartialStandardState1()
    }
    verifyStandardSubmissionPhase1()
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
