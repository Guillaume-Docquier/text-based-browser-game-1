import { branded, indexBy } from "@guillaume-docquier/tools-ts"
import { typedParse } from "@guillaume-docquier/tools-ts/schemas"
import { describe, expect, it } from "vitest"
import { computeAvailableActions } from "#shared/action-submission/computeAvailableActions.ts"
import {
  evaluateActionSelection,
  evaluateSubmittedActions,
  evaluateTargetCandidate,
  type ActionSelectionDraft,
  type EligibilityState,
} from "#shared/action-submission/evaluateActionSelection.ts"
import type { EligibilityIssueCode } from "#shared/action-submission/selectionEvaluation.ts"
import { GameIdSchema } from "#shared/domain/games/GameId.ts"
import { type PlayerId, PlayerIdSchema } from "#shared/domain/players/PlayerId.ts"
import { createResourcesStub } from "#shared/domain/resources/Resources.stub.ts"
import { ResourceType } from "#shared/domain/resources/ResourceType.ts"
import { ActionDefinitionSchema } from "#shared/domain/ruleset/action-definitions/ActionDefinition.ts"
import type { InputTag } from "#shared/domain/ruleset/action-definitions/InputTag.ts"
import type { TargetTag } from "#shared/domain/ruleset/action-definitions/TargetTag.ts"
import { FleetMoveEffectDefinition } from "#shared/domain/ruleset/effect-definitions/FleetMoveEffectDefinition.ts"
import { createRulesetStub } from "#shared/domain/ruleset/Ruleset.stub.ts"
import type { Ruleset } from "#shared/domain/ruleset/Ruleset.ts"
import { DifferentFromFleetOriginConstraint } from "#shared/domain/ruleset/target-definitions/DifferentFromFleetOriginTargetConstraint.ts"
import { OwnedBySubmittingPlayerConstraint } from "#shared/domain/ruleset/target-definitions/OwnedBySubmittingPlayerTargetConstraint.ts"
import { StationaryFleetConstraint } from "#shared/domain/ruleset/target-definitions/StationaryFleetTargetConstraint.ts"
import { TargetType } from "#shared/domain/ruleset/target-definitions/TargetType.ts"
import { WithinFleetRangeConstraint } from "#shared/domain/ruleset/target-definitions/WithinFleetRangeTargetConstraint.ts"
import { createSubmittedActionStub } from "#shared/domain/turns/actions/Action.stub.ts"
import type { ActionId } from "#shared/domain/turns/actions/ActionId.ts"
import { createFleetStub } from "#shared/domain/world/fleets/Fleet.stub.ts"
import { FleetMovementSchema } from "#shared/domain/world/fleets/Fleet.ts"
import type { FleetId } from "#shared/domain/world/fleets/FleetId.ts"
import { createPlanetStub } from "#shared/domain/world/planets/Planet.stub.ts"
import type { PlanetId } from "#shared/domain/world/planets/PlanetId.ts"
import { ColonizeHereTest, ColonizePlanetTest, SeedOutpostTest } from "#shared/testing/test-ruleset/action-definitions/colonize.ts"
import { MoveFleetExceptional, MoveFleetStandard } from "#shared/testing/test-ruleset/action-definitions/move-fleet.ts"
import { assertEvaluate, assertEitherUpdateOrder } from "./evaluateActionSelection.reservations.assertions.test-support.ts"
import {
  createFixture,
  createSubmission,
  createDraft,
  createColonizationBudgetFixture,
  withSubmissions,
} from "./evaluateActionSelection.test-support.ts"

describe("evaluateActionSelection", () => {
  it("should keep an absent constructor source dependency incomplete and accept its declared value", () => {
    // Arrange

    const ownerIdSetup1 = createOwnerIdSetup()
    const { sourceFleetId } = ownerIdSetup1

    const completeSetup2 = createCompleteSetup({ ...ownerIdSetup1 })
    const { complete } = completeSetup2
    expect(complete.strengthCommitments[sourceFleetId]).toBe(1)
    expect(complete.remainingStrength[sourceFleetId]).toBe(49)
  })

  it("should accept the Exceptional range endpoint and reject a destination just beyond it", () => {
    // Arrange
    const fixture = createFixture()
    const actionId = fixture.firstActionId
    const ruleset = createRulesetStub({
      actionDefinitions: indexBy("id", [MoveFleetExceptional]),
      actionPool: [{ id: actionId, actionDefinitionId: MoveFleetExceptional.id }],
    })
    const state: EligibilityState = {
      ...fixture.state,
      resources: createResourcesStub({ [ResourceType.INFLUENCE]: 3, [ResourceType.FUEL]: 5 }),
      actions: computeAvailableActions({ playerIds: [fixture.playerId], ruleset }),
    }
    const boundary = createPlanetStub({ id: branded<PlanetId>("exceptional-range-25"), ownerPlayerId: null, x: 25, y: 0 })
    const outside = createPlanetStub({ id: branded<PlanetId>("exceptional-range-25.001"), ownerPlayerId: null, x: 25.001, y: 0 })
    const candidateState = {
      ...state,
      planets: { ...state.planets, [boundary.id]: boundary, [outside.id]: outside },
    }
    const draft = createDraft(fixture, actionId, 1)

    // Act
    const exactEndpoint = evaluateTargetCandidate({
      state: candidateState,
      ruleset,
      draft,
      targetTag: branded<TargetTag>("planet"),
      targetId: boundary.id,
    })
    const justOutside = evaluateTargetCandidate({
      state: candidateState,
      ruleset,
      draft,
      targetTag: branded<TargetTag>("planet"),
      targetId: outside.id,
    })

    // Assert
    expect(exactEndpoint.candidateStatus).toBe("ELIGIBLE")
    expect(justOutside.candidateStatus).toBe("INELIGIBLE")
    expect(justOutside.candidateIssues).toContainEqual(expect.objectContaining({ code: "OUT_OF_RANGE" }))
  })

  it("should allow a journey whose departure turn equals a completed player view turn", () => {
    // Arrange
    const fixture = createFixture()
    const submission = createSubmission(fixture, fixture.firstActionId, 20)
    const journey = createFleetStub({
      id: branded<FleetId>("completed-view-journey"),
      ownerPlayerId: fixture.playerId,
      originPlanetId: fixture.originId,
      strength: 20,
      destinationPlanetId: fixture.destinationId,
      distanceToEnd: 3,
      movement: typedParse(FleetMovementSchema, { speed: 2, departureTurn: fixture.state.turn, submission, pendingArrivalEffects: [] }),
    })
    const completedViewState: EligibilityState = {
      ...fixture.state,
      fleets: indexBy("id", [journey]),
    }

    // Act
    const evaluation = evaluateSubmittedActions({ state: completedViewState, ruleset: fixture.ruleset, submissions: [] })

    // Assert
    expect(evaluation.status).toBe("ELIGIBLE")
    expect(evaluation.issues).not.toContainEqual(expect.objectContaining({ code: "INVALID_MOVEMENT_BINDING" }))
  })

  it("should reject IDs outside this player's available Action Pool", () => {
    // Arrange
    const fixture = createFixture()

    // Act
    const evaluation = evaluateActionSelection({
      state: fixture.state,
      ruleset: fixture.ruleset,
      draft: { actionId: branded<ActionId>("unknown-action"), selectedTargets: {}, selectedInputs: {} },
    })

    // Assert
    expect(evaluation.status).toBe("INELIGIBLE")
    expect(evaluation.issues.map(({ code }) => code)).toContain("ACTION_NOT_AUTHORIZED")
  })

  it("should reserve standalone Colonize Strength in the shared movement budget without double-counting Move+Colonize", () => {
    const fixture = createColonizationBudgetFixture(35)
    const moveSubmission = createSubmittedActionStub({
      id: fixture.moveActionId,
      playerId: fixture.playerId,
      actionDefinitionId: MoveFleetStandard.id,
      selectedTargets: { [branded<TargetTag>("fleet")]: fixture.fleetId, [branded<TargetTag>("planet")]: fixture.destinationId },
      selectedInputs: { [branded<InputTag>("strength")]: 15 },
    })
    const stateWithMove: EligibilityState = {
      ...fixture.state,
      actions: [...fixture.state.actions.filter(({ id }) => id !== fixture.moveActionId), moveSubmission],
    }
    const stationaryEvaluation = evaluateActionSelection({
      state: stateWithMove,
      ruleset: fixture.ruleset,
      draft: {
        actionId: fixture.colonizeActionId,
        selectedTargets: { [branded<TargetTag>("fleet")]: fixture.fleetId, [branded<TargetTag>("planet")]: fixture.originId },
        selectedInputs: {},
      },
    })

    expect(stationaryEvaluation.status).toBe("ELIGIBLE")
    expect(stationaryEvaluation.strengthCommitments[fixture.fleetId]).toBe(35)
    expect(stationaryEvaluation.remainingStrength[fixture.fleetId]).toBe(0)
    expect(stationaryEvaluation.resourceCommitments).toStrictEqual({
      [ResourceType.INFLUENCE]: 28,
      [ResourceType.METAL]: 0,
      [ResourceType.FUEL]: 1,
      [ResourceType.ENERGY]: 0,
      [ResourceType.COLONY]: 0,
    })

    const pairedRuleset = createRulesetStub({
      actionDefinitions: indexBy("id", [ColonizePlanetTest]),
      actionPool: [{ id: fixture.moveActionId, actionDefinitionId: ColonizePlanetTest.id }],
    })
    const pairedState: EligibilityState = {
      ...fixture.state,
      resources: createResourcesStub({ [ResourceType.INFLUENCE]: 25 }),
      actions: computeAvailableActions({ playerIds: [fixture.playerId], ruleset: pairedRuleset }),
    }
    const paired = evaluateActionSelection({
      state: pairedState,
      ruleset: pairedRuleset,
      draft: {
        actionId: fixture.moveActionId,
        selectedTargets: { [branded<TargetTag>("fleet")]: fixture.fleetId, [branded<TargetTag>("planet")]: fixture.destinationId },
        selectedInputs: { [branded<InputTag>("strength")]: 35 },
      },
    })
    expect(paired.status).toBe("ELIGIBLE")
    expect(paired.strengthCommitments[fixture.fleetId]).toBe(35)
  })

  it("should reject Move+Colonize below the configured requirement and accept the exact threshold", () => {
    const fixture = createColonizationBudgetFixture(100)
    const ruleset = createRulesetStub({
      actionDefinitions: indexBy("id", [ColonizePlanetTest]),
      actionPool: [{ id: fixture.moveActionId, actionDefinitionId: ColonizePlanetTest.id }],
    })
    const state: EligibilityState = {
      ...fixture.state,
      resources: createResourcesStub({ [ResourceType.INFLUENCE]: 25 }),
      actions: computeAvailableActions({ playerIds: [fixture.playerId], ruleset }),
    }
    const evaluate = (strength: number): ReturnType<typeof evaluateActionSelection> =>
      evaluateActionSelection({
        state,
        ruleset,
        draft: {
          actionId: fixture.moveActionId,
          selectedTargets: { [branded<TargetTag>("fleet")]: fixture.fleetId, [branded<TargetTag>("planet")]: fixture.destinationId },
          selectedInputs: { [branded<InputTag>("strength")]: strength },
        },
      })

    expect(evaluate(19).issues).toContainEqual(expect.objectContaining({ code: "INSUFFICIENT_STRENGTH" }))
    expect(evaluate(20).status).toBe("ELIGIBLE")
    expect(evaluate(35).status).toBe("ELIGIBLE")
    expect(evaluate(35).strengthCommitments[fixture.fleetId]).toBe(35)
  })

  it("should evaluate renamed Seed Outpost threshold and range from its configured tags and costs", () => {
    expect.hasAssertions()
    const playerId = typedParse(PlayerIdSchema, "00000000-0000-4000-8000-000000000051")
    const actionId = branded<ActionId>("TEST_SEED_OUTPOST_1")
    const origin = createPlanetStub({
      id: branded<PlanetId>("seed-outpost-origin"),
      ownerPlayerId: playerId,
      name: "Outpost Home",
      x: 0,
      y: 0,
    })
    const site = createPlanetStub({ id: branded<PlanetId>("seed-outpost-site"), ownerPlayerId: null, name: "Seed Site", x: 3, y: 0 })
    const beyondRange = createPlanetStub({
      id: branded<PlanetId>("seed-outpost-beyond-range"),
      ownerPlayerId: null,
      name: "Beyond Seed Range",
      x: 3.001,
      y: 0,
    })
    const force = createFleetStub({
      id: branded<FleetId>("seed-outpost-force"),
      ownerPlayerId: playerId,
      originPlanetId: origin.id,
      name: "Outpost Guard",
      strength: 45,
    })
    const ruleset = createRulesetStub({
      actionDefinitions: indexBy("id", [SeedOutpostTest]),
      actionPool: [{ id: actionId, actionDefinitionId: SeedOutpostTest.id }],
    })
    const state: EligibilityState = {
      gameId: typedParse(GameIdSchema, 51),
      turn: 1,
      submittingPlayerId: playerId,
      resources: createResourcesStub({ [ResourceType.INFLUENCE]: 7, [ResourceType.FUEL]: 2 }),
      players: indexBy("id", [{ id: playerId, ownerPlayerId: playerId }]),
      planets: indexBy("id", [origin, site, beyondRange]),
      fleets: indexBy("id", [force]),
      actions: computeAvailableActions({ playerIds: [playerId], ruleset }),
    }

    assertEvaluate({ state, ruleset, actionId, force, playerId, site, beyondRange })
  })

  it("should preserve exact aggregate Move and stationary Colonize budgets through replace, cancel, and source changes", () => {
    expect.hasAssertions()
    const fixture = createColonizationBudgetFixture(35)
    const moveSubmission = (strength: number): ReturnType<typeof createSubmittedActionStub> =>
      createSubmittedActionStub({
        id: fixture.moveActionId,
        playerId: fixture.playerId,
        actionDefinitionId: MoveFleetStandard.id,
        selectedTargets: { fleet: fixture.fleetId, planet: fixture.destinationId },
        selectedInputs: { strength },
      })
    const move15 = moveSubmission(15)
    const colonize20 = createSubmittedActionStub({
      id: fixture.colonizeActionId,
      playerId: fixture.playerId,
      actionDefinitionId: ColonizeHereTest.id,
      selectedTargets: {
        [branded<TargetTag>("fleet")]: fixture.fleetId,
        [branded<TargetTag>("planet")]: fixture.originId,
      },
    })
    const occupied = withSubmissions(fixture.state, [move15, colonize20])
    const moveDraft = (strength: number): ActionSelectionDraft => ({
      actionId: fixture.moveActionId,
      selectedTargets: {
        [branded<TargetTag>("fleet")]: fixture.fleetId,
        [branded<TargetTag>("planet")]: fixture.destinationId,
      },
      selectedInputs: { [branded<InputTag>("strength")]: strength },
    })

    assertEitherUpdateOrder({ fixture, move15, colonize20, moveSubmission, occupied, moveDraft })
  })

  it("should reserve Move+Colonize only once and reject a competing Move against its reserved remainder", () => {
    const fixture = createColonizationBudgetFixture(35)
    const pairedRuleset = createRulesetStub({
      actionDefinitions: indexBy("id", [ColonizePlanetTest, MoveFleetStandard]),
      actionPool: [
        { id: fixture.moveActionId, actionDefinitionId: ColonizePlanetTest.id },
        { id: fixture.colonizeActionId, actionDefinitionId: MoveFleetStandard.id },
      ],
    })
    const pairedState = {
      ...fixture.state,
      actions: computeAvailableActions({ playerIds: [fixture.playerId], ruleset: pairedRuleset }),
    }
    const paired = evaluateActionSelection({
      state: pairedState,
      ruleset: pairedRuleset,
      draft: {
        actionId: fixture.moveActionId,
        selectedTargets: {
          [branded<TargetTag>("fleet")]: fixture.fleetId,
          [branded<TargetTag>("planet")]: fixture.destinationId,
        },
        selectedInputs: { [branded<InputTag>("strength")]: 35 },
      },
    })
    const pairedSubmission = createSubmittedActionStub({
      id: fixture.moveActionId,
      playerId: fixture.playerId,
      actionDefinitionId: ColonizePlanetTest.id,
      selectedTargets: {
        [branded<TargetTag>("fleet")]: fixture.fleetId,
        [branded<TargetTag>("planet")]: fixture.destinationId,
      },
      selectedInputs: { [branded<InputTag>("strength")]: 35 },
    })
    const pairedStateWithSelection = withSubmissions(pairedState, [pairedSubmission])
    const competingMove = evaluateActionSelection({
      state: pairedStateWithSelection,
      ruleset: pairedRuleset,
      draft: {
        actionId: fixture.colonizeActionId,
        selectedTargets: {
          [branded<TargetTag>("fleet")]: fixture.fleetId,
          [branded<TargetTag>("planet")]: fixture.destinationId,
        },
        selectedInputs: { [branded<InputTag>("strength")]: 1 },
      },
    })

    expect(paired.status).toBe("ELIGIBLE")
    expect(paired.strengthCommitments[fixture.fleetId]).toBe(35)
    expect(paired.remainingStrength[fixture.fleetId]).toBe(0)
    expect(paired.resourceCommitments[ResourceType.INFLUENCE]).toBe(25)
    expect(paired.resourceCommitments[ResourceType.FUEL]).toBe(0)
    expect(competingMove.status).toBe("INELIGIBLE")
    expect(competingMove.strengthCommitments[fixture.fleetId]).toBe(36)
    expect(competingMove.issues.map(({ code }) => code)).toContain("INSUFFICIENT_STRENGTH")
  })

  it("should enforce aggregate reservations for two stationary Colonize instances at the exact40 boundary", () => {
    const fixture = createColonizationBudgetFixture(35)
    const state = fixture.state
    const draft = (actionId: ActionId): ActionSelectionDraft => ({
      actionId,
      selectedTargets: {
        [branded<TargetTag>("fleet")]: fixture.fleetId,
        [branded<TargetTag>("planet")]: fixture.originId,
      },
      selectedInputs: {},
    })
    const first = createSubmittedActionStub({
      id: fixture.colonizeActionId,
      playerId: fixture.playerId,
      actionDefinitionId: ColonizeHereTest.id,
      selectedTargets: { fleet: fixture.fleetId, planet: fixture.originId },
    })
    const second = createSubmittedActionStub({
      id: fixture.secondColonizeActionId,
      playerId: fixture.playerId,
      actionDefinitionId: ColonizeHereTest.id,
      selectedTargets: { fleet: fixture.fleetId, planet: fixture.originId },
    })
    const individualFirst = evaluateActionSelection({ state, ruleset: fixture.ruleset, draft: draft(fixture.colonizeActionId) })
    const individualSecond = evaluateActionSelection({
      state: withSubmissions(state, [first]),
      ruleset: fixture.ruleset,
      draft: draft(fixture.secondColonizeActionId),
    })
    const bothAt35 = evaluateSubmittedActions({ state, ruleset: fixture.ruleset, submissions: [first, second] })
    const stateAt40: EligibilityState = {
      ...state,
      fleets: {
        ...state.fleets,
        [fixture.fleetId]: createFleetStub({
          id: fixture.fleetId,
          ownerPlayerId: fixture.playerId,
          originPlanetId: fixture.originId,
          strength: 40,
        }),
      },
    }
    const bothAt40 = evaluateSubmittedActions({ state: stateAt40, ruleset: fixture.ruleset, submissions: [first, second] })

    expect(individualFirst.status).toBe("ELIGIBLE")
    expect(individualSecond.status).toBe("INELIGIBLE")
    expect(individualSecond.strengthCommitments[fixture.fleetId]).toBe(40)
    expect(bothAt35.status).toBe("INELIGIBLE")
    expect(bothAt35.strengthCommitments[fixture.fleetId]).toBe(40)
    expect(bothAt35.issues.map(({ code }) => code)).toContain("INSUFFICIENT_STRENGTH")
    expect(bothAt40.status).toBe("ELIGIBLE")
    expect(bothAt40.strengthCommitments[fixture.fleetId]).toBe(40)
    expect(bothAt40.remainingStrength[fixture.fleetId]).toBe(0)
    expect(bothAt40.resourceCommitments[ResourceType.INFLUENCE]).toBe(50)
    expect(bothAt40.resourceCommitments[ResourceType.FUEL]).toBe(0)
  })
})

function createOwnerIdSetup(): CreateOwnerIdSetupResult {
  const ownerId = typedParse(PlayerIdSchema, "00000000-0000-4000-8000-000000000077")
  const actionId = branded<ActionId>("ARBITRARY_MOVE_1")
  const sourceFleetId = branded<FleetId>("00000000-0000-4000-8000-000000000078")
  const originId = branded<PlanetId>("00000000-0000-4000-8000-000000000079")
  const destinationId = branded<PlanetId>("00000000-0000-4000-8000-000000000080")
  const actionDefinition = typedParse(ActionDefinitionSchema, {
    ...MoveFleetStandard,
    id: "ARBITRARY_TAG_MOVE",
    name: "Arbitrary tag movement",
    inputs: { units: { type: "POSITIVE_INTEGER", label: "Units" } },
    targets: {
      constructor: {
        targetType: TargetType.FLEET,
        constraints: [OwnedBySubmittingPlayerConstraint.create(), StationaryFleetConstraint.create()],
      },
      landingSite: {
        targetType: TargetType.PLANET,
        constraints: [
          WithinFleetRangeConstraint.create({ sourceFleetTag: "constructor", maxDistance: 5 }),
          DifferentFromFleetOriginConstraint.create({ sourceFleetTag: "constructor" }),
        ],
      },
    },
    effects: [
      FleetMoveEffectDefinition.create({
        fleetTag: "constructor",
        planetTag: "landingSite",
        strengthTag: "units",
        speed: 0.1,
      }),
    ],
  })
  const ruleset = createRulesetStub({
    actionDefinitions: indexBy("id", [actionDefinition]),
    actionPool: [{ id: actionId, actionDefinitionId: actionDefinition.id }],
  })
  const origin = createPlanetStub({ id: originId, ownerPlayerId: ownerId, x: 0, y: 0 })
  const destination = createPlanetStub({ id: destinationId, ownerPlayerId: null, x: 3, y: 4 })
  const sourceFleet = createFleetStub({ id: sourceFleetId, ownerPlayerId: ownerId, originPlanetId: originId, strength: 50 })
  return { ownerId, actionId, sourceFleetId, destinationId, ruleset, origin, destination, sourceFleet }
}

function createCompleteSetup(input: CreateCompleteSetupInput): CreateCompleteSetupResult {
  const state: EligibilityState = {
    gameId: typedParse(GameIdSchema, 1),
    turn: 1,
    submittingPlayerId: input.ownerId,
    resources: createResourcesStub({ [ResourceType.INFLUENCE]: 10, [ResourceType.FUEL]: 10 }),
    players: indexBy("id", [{ id: input.ownerId, ownerPlayerId: input.ownerId }]),
    planets: indexBy("id", [input.origin, input.destination]),
    fleets: indexBy("id", [input.sourceFleet]),
    actions: computeAvailableActions({ playerIds: [input.ownerId], ruleset: input.ruleset }),
  }
  const partialDraft: ActionSelectionDraft = {
    actionId: input.actionId,
    selectedTargets: { [branded<TargetTag>("landingSite")]: input.destinationId },
    selectedInputs: { [branded<InputTag>("units")]: 1 },
  }

  // Act
  const partial = evaluateActionSelection({ state, ruleset: input.ruleset, draft: partialDraft })
  const candidate = evaluateTargetCandidate({
    state,
    ruleset: input.ruleset,
    draft: { actionId: input.actionId, selectedTargets: {}, selectedInputs: { [branded<InputTag>("units")]: 1 } },
    targetTag: branded<TargetTag>("landingSite"),
    targetId: input.destinationId,
  })
  const complete = evaluateActionSelection({
    state,
    ruleset: input.ruleset,
    draft: {
      actionId: input.actionId,
      selectedTargets: {
        [branded<TargetTag>("constructor")]: input.sourceFleetId,
        [branded<TargetTag>("landingSite")]: input.destinationId,
      },
      selectedInputs: { [branded<InputTag>("units")]: 1 },
    },
  })

  // Assert
  expect(partial.status).toBe("INCOMPLETE")
  expect(partial.issues).toStrictEqual(
    expect.arrayContaining([
      expect.objectContaining({ code: "MISSING_TARGET", targetTag: branded<TargetTag>("constructor") }),
      expect.objectContaining({ code: "DEPENDENCY_INCOMPLETE", targetTag: branded<TargetTag>("landingSite") }),
    ]),
  )
  expect(partial.issues.map(({ code }) => code)).not.toContain("DEPENDENCY_INVALID")
  expect(candidate.candidateStatus).toBe("INCOMPLETE")
  expect(candidate.candidateIssues).toContainEqual(
    expect.objectContaining({ code: "DEPENDENCY_INCOMPLETE", targetTag: branded<TargetTag>("landingSite") }),
  )
  expect(complete.status).toBe("ELIGIBLE")
  return { complete }
}

type CreateOwnerIdSetupResult = {
  ownerId: PlayerId
  actionId: ActionId
  sourceFleetId: FleetId
  destinationId: PlanetId
  ruleset: Ruleset
  origin: ReturnType<typeof createPlanetStub>
  destination: ReturnType<typeof createPlanetStub>
  sourceFleet: ReturnType<typeof createFleetStub>
}

type CreateCompleteSetupInput = {
  ownerId: PlayerId
  origin: ReturnType<typeof createPlanetStub>
  destination: ReturnType<typeof createPlanetStub>
  sourceFleet: ReturnType<typeof createFleetStub>
  ruleset: Ruleset
  actionId: ActionId
  destinationId: PlanetId
  sourceFleetId: FleetId
}

type CreateCompleteSetupResult = {
  complete: Readonly<{
    status: "ELIGIBLE" | "INCOMPLETE" | "INELIGIBLE"
    issues: ReadonlyArray<
      Readonly<{
        code: EligibilityIssueCode
        actionId?: ActionId
        targetTag?: TargetTag
        inputTag?: InputTag
        resourceType?: ResourceType
        message: string
      }>
    >
    missingTargets: readonly TargetTag[]
    missingInputs: readonly InputTag[]
    resourceCommitments: Readonly<ReturnType<typeof createResourcesStub>>
    strengthCommitments: Readonly<Record<FleetId, number>>
    remainingStrength: Readonly<Record<FleetId, number>>
  }>
}
