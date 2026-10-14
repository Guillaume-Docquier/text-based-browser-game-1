import { Assert, branded, indexBy, Result } from "@guillaume-docquier/tools-ts"
import { typedParse } from "@guillaume-docquier/tools-ts/schemas"
import { describe, expect, it } from "vitest"
import { computeAvailableActions } from "#shared/action-submission/computeAvailableActions.ts"
import { evaluateActionSelection, type EligibilityState } from "#shared/action-submission/evaluateActionSelection.ts"
import type { EligibilityIssueCode } from "#shared/action-submission/selectionEvaluation.ts"
import { compareOrdinalStrings } from "#shared/domain/compareOrdinalStrings.ts"
import { GameIdSchema } from "#shared/domain/games/GameId.ts"
import { PlayerIdSchema, type PlayerId } from "#shared/domain/players/PlayerId.ts"
import { createResourcesStub } from "#shared/domain/resources/Resources.stub.ts"
import { ResourceType } from "#shared/domain/resources/ResourceType.ts"
import { createActionDefinitionStub } from "#shared/domain/ruleset/action-definitions/ActionDefinition.stub.ts"
import type { ActionDefinition } from "#shared/domain/ruleset/action-definitions/ActionDefinition.ts"
import type { ActionDefinitionId } from "#shared/domain/ruleset/action-definitions/ActionDefinitionId.ts"
import { ActionTier } from "#shared/domain/ruleset/action-definitions/ActionTier.ts"
import { ActionType } from "#shared/domain/ruleset/action-definitions/ActionType.ts"
import type { InputTag } from "#shared/domain/ruleset/action-definitions/InputTag.ts"
import type { TargetTag } from "#shared/domain/ruleset/action-definitions/TargetTag.ts"
import { FleetMoveEffectDefinition } from "#shared/domain/ruleset/effect-definitions/FleetMoveEffectDefinition.ts"
import { ResourceGainEffectDefinition } from "#shared/domain/ruleset/effect-definitions/ResourceGainEffectDefinition.ts"
import { ResourceLossEffectDefinition } from "#shared/domain/ruleset/effect-definitions/ResourceLossEffectDefinition.ts"
import { createRulesetStub } from "#shared/domain/ruleset/Ruleset.stub.ts"
import { DifferentFromFleetOriginConstraint } from "#shared/domain/ruleset/target-definitions/DifferentFromFleetOriginTargetConstraint.ts"
import { OwnedBySubmittingPlayerConstraint } from "#shared/domain/ruleset/target-definitions/OwnedBySubmittingPlayerTargetConstraint.ts"
import { StationaryFleetConstraint } from "#shared/domain/ruleset/target-definitions/StationaryFleetTargetConstraint.ts"
import { TargetType } from "#shared/domain/ruleset/target-definitions/TargetType.ts"
import { WithinFleetRangeConstraint } from "#shared/domain/ruleset/target-definitions/WithinFleetRangeTargetConstraint.ts"
import { createSubmittedActionStub } from "#shared/domain/turns/actions/Action.stub.ts"
import type { SubmittedAction } from "#shared/domain/turns/actions/Action.ts"
import type { ActionId } from "#shared/domain/turns/actions/ActionId.ts"
import { EffectOutcome } from "#shared/domain/turns/actions/EffectOutcome.ts"
import { createFleetStub } from "#shared/domain/world/fleets/Fleet.stub.ts"
import { FleetMovementSchema, FleetSchema } from "#shared/domain/world/fleets/Fleet.ts"
import type { FleetId } from "#shared/domain/world/fleets/FleetId.ts"
import { createPlanetStub } from "#shared/domain/world/planets/Planet.stub.ts"
import type { PlanetId } from "#shared/domain/world/planets/PlanetId.ts"
import { createSeededRng } from "#shared/testing/createSeededRng.ts"
import type { ResolvedTurnState } from "#shared/turn-resolution/ResolvedTurnState.ts"
import { resolveTurn } from "#shared/turn-resolution/resolveTurn.ts"
import { ResolveTurnError } from "#shared/turn-resolution/ResolveTurnError.ts"
import type { ResolutionFleet } from "#shared/turn-resolution/state/ResolutionFleet.ts"
import { createTurnStateStub } from "#shared/turn-resolution/TurnState.stub.ts"

describe("fleet movement turn resolution", () => {
  it("should allocate partial departures before advancing and produce permutation-stable children", () => {
    // Arrange
    const fixture = createFixture()
    const firstSubmission = createSubmission(fixture, "MOVE_1", 20)
    const secondSubmission = createSubmission(fixture, "MOVE_2", 15)
    const submissions = [firstSubmission, secondSubmission]

    // Act
    const first = resolve(fixture, submissions)
    const replayed = resolve(fixture, submissions)
    const reversed = resolve(fixture, [secondSubmission, firstSubmission])
    const firstFleets = Object.values(first.fleets).toSorted((a, b) => compareOrdinalStrings(a.id, b.id))
    const reversedFleets = Object.values(reversed.fleets).toSorted((a, b) => compareOrdinalStrings(a.id, b.id))

    // Assert
    expect(firstFleets).toHaveLength(3)
    expect(firstFleets.find(({ id }) => id === fixture.sourceFleetId)?.strength).toBe(15)
    expect(
      firstFleets
        .filter(({ movement }) => movement !== undefined)
        .map(({ strength, distanceToEnd }) => ({ strength, distanceToEnd }))
        .toSorted((first, second) => first.strength - second.strength),
    ).toStrictEqual([
      { strength: 15, distanceToEnd: 3 },
      { strength: 20, distanceToEnd: 3 },
    ])
    expect(
      firstFleets
        .filter(({ movement }) => movement !== undefined)
        .map(({ strength, movement }) => ({ strength, departureTurn: movement?.departureTurn, submission: movement?.submission }))
        .toSorted((first, second) => first.strength - second.strength),
    ).toStrictEqual([
      { strength: 15, departureTurn: 1, submission: secondSubmission },
      { strength: 20, departureTurn: 1, submission: firstSubmission },
    ])
    expect(firstFleets.map(toFleetProjection)).toStrictEqual(reversedFleets.map(toFleetProjection))
    expect(replayed).toStrictEqual(first)
    expect(first.removedFleetIds).toStrictEqual([])
  })

  it("should delete a fully allocated source and return its id for durable worker deletion", () => {
    // Arrange
    const fixture = createFixture()
    const submission = createSubmission(fixture, "MOVE_1", 50)

    // Act
    const resolved = resolve(fixture, [submission])

    // Assert
    expect(resolved.fleets[fixture.sourceFleetId]).toBeUndefined()
    expect(resolved.removedFleetIds).toStrictEqual([fixture.sourceFleetId])
    expect(Object.values(resolved.fleets)).toHaveLength(1)
    expect(Object.values(resolved.fleets)[0]).toMatchObject({ strength: 50, distanceToEnd: 3 })
  })

  it("should advance persisted journeys once without repaying departure costs and expose transient continuation outcomes", () => {
    // Arrange
    const fixture = createFixture()
    const departureSubmission = createSubmission(fixture, "MOVE_1", 20)

    // Act
    const departure = resolve(fixture, [departureSubmission])
    const child = Object.values(departure.fleets).find(({ movement }) => movement !== undefined)
    const paidResources = departure.players[fixture.playerId]?.resources
    const secondTurn = createTurnStateStub({
      gameId: departure.gameId,
      turn: 2,
      players: departure.players,
      planets: departure.planets,
      fleets: departure.fleets,
    })
    const advanced = resolveState(secondTurn, fixture.ruleset)
    const advancedChild = Object.values(advanced.fleets).find(({ movement }) => movement !== undefined)
    const advancedDistanceToEnd = advancedChild?.distanceToEnd
    const thirdTurn = createTurnStateStub({
      gameId: advanced.gameId,
      turn: 3,
      players: advanced.players,
      planets: advanced.planets,
      fleets: advanced.fleets,
    })
    const arrived = resolveState(thirdTurn, fixture.ruleset)
    const landedFleet = Object.values(arrived.fleets).find(({ id }) => id !== fixture.sourceFleetId)

    // Assert
    expect(child).toBeDefined()
    expect(departure.resolvedActions[0]?.actionOutcomes).toHaveLength(4)
    expect(advancedDistanceToEnd).toBe(1)
    expect(advanced.players[fixture.playerId]?.resources).toStrictEqual(paidResources)
    expect(advanced.resolvedActions).toStrictEqual([])
    expect(advanced.resolvedContinuations).toStrictEqual([
      expect.objectContaining({
        originatingSubmission: departureSubmission,
        departureTurn: 1,
        actionOutcomes: [expect.objectContaining({ result: expect.stringContaining("moved 2 light years") })],
      }),
    ])
    expect(landedFleet).toMatchObject({ originPlanetId: fixture.destinationId, strength: 20 })
    expect(landedFleet?.movement).toBeUndefined()
    expect(landedFleet?.destinationPlanetId).toBeUndefined()
    expect(landedFleet?.distanceToEnd).toBeUndefined()
    expect(arrived.resolvedActions).toStrictEqual([])
    expect(arrived.resolvedContinuations[0]?.originatingSubmission).toStrictEqual(departureSubmission)
    expect(arrived.resolvedContinuations[0]?.departureTurn).toBe(1)
    expect(arrived.resolvedContinuations[0]?.actionOutcomes).toHaveLength(2)
    expect(arrived.resolvedContinuations[0]?.actionOutcomes[1]).toMatchObject({ result: expect.stringContaining("arrived on Planet") })
  })

  it("should arrive on the exact decimal-speed boundary after reloading each turn and release its Action", () => {
    // Arrange
    const fixture = createFixture({ distance: 1, speed: 0.1 })
    const departureSubmission = createSubmission(fixture, "MOVE_1", 20)

    // Act
    let resolved = resolve(fixture, [departureSubmission])
    const departureResources = resolved.players[fixture.playerId]?.resources
    const occupiedJourney = Object.values(resolved.fleets).find(({ movement }) => movement !== undefined)
    Assert.isDefined(occupiedJourney)
    const occupiedEvaluation = evaluateActionSelection({
      state: createEligibilityState(fixture, resolved, 2),
      ruleset: fixture.ruleset,
      draft: {
        actionId: branded<ActionId>("MOVE_1"),
        selectedTargets: { [branded<TargetTag>("fleet")]: fixture.sourceFleetId, [branded<TargetTag>("planet")]: fixture.destinationId },
        selectedInputs: { [branded<InputTag>("strength")]: 1 },
      },
    })
    const continuationResources = []
    const stillTravelingDistances = []
    for (let turn = 2; turn <= 9; turn++) {
      resolved = resolveContinuation(fixture, resolved, turn)
      continuationResources.push(resolved.players[fixture.playerId]?.resources)
      const journey = Object.values(resolved.fleets).find(({ movement }) => movement !== undefined)
      Assert.isDefined(journey)
      const distanceToEnd = journey.distanceToEnd
      Assert.isDefined(distanceToEnd)
      stillTravelingDistances.push(distanceToEnd)
    }
    resolved = resolveContinuation(fixture, resolved, 10)
    continuationResources.push(resolved.players[fixture.playerId]?.resources)
    const arrivedFleet = resolved.fleets[occupiedJourney.id]
    Assert.isDefined(arrivedFleet)
    const releasedEvaluation = evaluateActionSelection({
      state: createEligibilityState(fixture, resolved, 11),
      ruleset: fixture.ruleset,
      draft: {
        actionId: branded<ActionId>("MOVE_1"),
        selectedTargets: { [branded<TargetTag>("fleet")]: fixture.sourceFleetId, [branded<TargetTag>("planet")]: fixture.destinationId },
        selectedInputs: { [branded<InputTag>("strength")]: 1 },
      },
    })

    // Assert

    verifyDepartureResources({
      departureResources,
      occupiedJourney,
      occupiedEvaluation,
      stillTravelingDistances,
      continuationResources,
      resolved,
      arrivedFleet,
      fixture,
      departureSubmission,
    })

    verify({ resolved, releasedEvaluation, fixture })
  })

  it.each([
    { distance: 6, speed: 0.3, advances: 20 },
    { distance: 10, speed: 0.1, advances: 100 },
  ])("should normalize exact decimal multiples after the expected number of advances", ({ distance, speed, advances }) => {
    // Arrange
    const fixture = createFixture({ distance, speed })
    const departure = resolve(fixture, [createSubmission(fixture, "MOVE_1", 50)])

    // Act
    let resolved = departure
    for (let turn = 2; turn <= advances; turn++) {
      resolved = resolveContinuation(fixture, resolved, turn)
    }
    const landedFleet = Object.values(resolved.fleets).find(({ originPlanetId }) => originPlanetId === fixture.destinationId)

    // Assert
    Assert.isDefined(landedFleet)
    expect(resolved.turn).toBe(advances)
    expect(landedFleet).toMatchObject({ originPlanetId: fixture.destinationId, strength: 50, arrivedAtTick: 20 })
    expect(landedFleet.movement).toBeUndefined()
    expect(resolved.players[fixture.playerId]?.resources).toStrictEqual(
      createResourcesStub({
        [ResourceType.INFLUENCE]: 17,
        [ResourceType.FUEL]: 19,
      }),
    )
  })

  it("should preserve a positive extra distance beyond the accumulated round-off envelope", () => {
    // Arrange
    const fixture = createFixture({ distance: 6.0000000001, speed: 0.3 })
    const departure = resolve(fixture, [createSubmission(fixture, "MOVE_1", 50)])

    // Act
    let resolved = departure
    for (let turn = 2; turn <= 20; turn++) {
      resolved = resolveContinuation(fixture, resolved, turn)
    }
    const movingFleet = Object.values(resolved.fleets).find(({ movement }) => movement !== undefined)
    Assert.isDefined(movingFleet)
    const arrived = resolveContinuation(fixture, resolved, 21)
    const landedFleet = Object.values(arrived.fleets).find(({ originPlanetId }) => originPlanetId === fixture.destinationId)

    // Assert
    expect(movingFleet.distanceToEnd).toBeGreaterThan(0)
    expect(resolved.turn).toBe(20)
    expect(landedFleet).toMatchObject({ originPlanetId: fixture.destinationId, strength: 50, arrivedAtTick: 1 })
    expect(landedFleet?.movement).toBeUndefined()
    expect(arrived.players[fixture.playerId]?.resources).toStrictEqual(
      createResourcesStub({
        [ResourceType.INFLUENCE]: 17,
        [ResourceType.FUEL]: 19,
      }),
    )
  })

  it("should continue a reloaded full-departure journey after its historical source Fleet was deleted", () => {
    // Arrange
    const fixture = createFixture()
    const departureSubmission = createSubmission(fixture, "MOVE_1", 50)

    const departure = resolve(fixture, [departureSubmission])
    const journey = Object.values(departure.fleets).find(({ movement }) => movement !== undefined)
    Assert.isDefined(journey)
    const reloadedJourney = FleetSchema.parse(JSON.parse(JSON.stringify(journey)))
    const continuedTurn = createTurnStateStub({
      gameId: departure.gameId,
      turn: 2,
      players: departure.players,
      planets: departure.planets,
      fleets: indexBy("id", [reloadedJourney]),
    })
    const departureResources = departure.players[fixture.playerId]?.resources
    const updatedDefinition = {
      ...fixture.actionDefinition,
      effects: [FleetMoveEffectDefinition.create({ fleetTag: "fleet", planetTag: "planet", strengthTag: "strength", speed: 0.1 })],
    }
    const changedRuleset = createRulesetStub({
      actionDefinitions: indexBy("id", [updatedDefinition]),
      actionPool: fixture.ruleset.actionPool,
    })

    // Act
    const continued = resolveState(continuedTurn, changedRuleset)
    const continuedJourney = Object.values(continued.fleets).find(({ movement }) => movement !== undefined)

    // Assert
    expect(departure.fleets[fixture.sourceFleetId]).toBeUndefined()
    expect(continuedJourney).toMatchObject({
      strength: 50,
      destinationPlanetId: fixture.destinationId,
      distanceToEnd: 1,
      movement: { speed: 2, departureTurn: 1 },
    })
    expect(continuedJourney?.movement?.submission).toStrictEqual(departureSubmission)
    expect(continuedJourney?.movement?.submission.selectedTargets[branded<TargetTag>("fleet")]).toBe(fixture.sourceFleetId)
    expect(continued.players[fixture.playerId]?.resources).toStrictEqual(departureResources)
    expect(continued.resolvedActions).toStrictEqual([])
    expect(continued.resolvedContinuations).toHaveLength(1)
  })

  const corruptJourneyCases = [
    {
      label: "missing mapped destination",
      expectedIssues: [
        {
          issue: "Fleet moving-child has an invalid in-progress Action binding",
          submittedActionId: "MOVE_1",
          actionDefinitionId: branded<ActionDefinitionId>("MOVE_FLEET"),
          actionDefinitionName: "Move Fleet",
        },
      ],
      createJourney: (fixture: ReturnType<typeof createFixture>): ReturnType<typeof createFleetStub> =>
        createMovementJourney(
          fixture,
          createSubmittedActionStub({
            ...createSubmission(fixture, "MOVE_1", 20),
            selectedTargets: { fleet: fixture.sourceFleetId },
          }),
          1,
        ),
    },
    {
      label: "missing mapped force",
      expectedIssues: [
        {
          issue: "Fleet moving-child has an invalid in-progress Action binding",
          submittedActionId: "MOVE_1",
          actionDefinitionId: branded<ActionDefinitionId>("MOVE_FLEET"),
          actionDefinitionName: "Move Fleet",
        },
      ],
      createJourney: (fixture: ReturnType<typeof createFixture>): ReturnType<typeof createFleetStub> =>
        createMovementJourney(
          fixture,
          createSubmittedActionStub({
            ...createSubmission(fixture, "MOVE_1", 20),
            selectedInputs: {},
          }),
          1,
        ),
    },
    {
      label: "extra mapped destination",
      expectedIssues: [
        {
          issue: "Fleet moving-child has an invalid in-progress Action binding",
          submittedActionId: "MOVE_1",
          actionDefinitionId: branded<ActionDefinitionId>("MOVE_FLEET"),
          actionDefinitionName: "Move Fleet",
        },
      ],
      createJourney: (fixture: ReturnType<typeof createFixture>): ReturnType<typeof createFleetStub> => {
        const validSubmission = createSubmission(fixture, "MOVE_1", 20)
        return createMovementJourney(
          fixture,
          createSubmittedActionStub({
            ...validSubmission,
            selectedTargets: { ...validSubmission.selectedTargets, [branded<TargetTag>("unexpected")]: fixture.destinationId },
          }),
          1,
        )
      },
    },
    {
      label: "extra mapped force",
      expectedIssues: [
        {
          issue: "Fleet moving-child has an invalid in-progress Action binding",
          submittedActionId: "MOVE_1",
          actionDefinitionId: branded<ActionDefinitionId>("MOVE_FLEET"),
          actionDefinitionName: "Move Fleet",
        },
      ],
      createJourney: (fixture: ReturnType<typeof createFixture>): ReturnType<typeof createFleetStub> => {
        const validSubmission = createSubmission(fixture, "MOVE_1", 20)
        return createMovementJourney(
          fixture,
          createSubmittedActionStub({
            ...validSubmission,
            selectedInputs: { ...validSubmission.selectedInputs, [branded<InputTag>("unexpected")]: 1 },
          }),
          1,
        )
      },
    },
    {
      label: "fractional mapped force",
      expectedIssues: [
        {
          issue: "Fleet moving-child has an invalid in-progress Action binding",
          submittedActionId: "MOVE_1",
          actionDefinitionId: branded<ActionDefinitionId>("MOVE_FLEET"),
          actionDefinitionName: "Move Fleet",
        },
      ],
      createJourney: (fixture: ReturnType<typeof createFixture>): ReturnType<typeof createFleetStub> => {
        const validJourney = createMovementJourney(fixture, createSubmission(fixture, "MOVE_1", 20), 1)
        const corruptedJourney = structuredClone(validJourney)
        Assert.isDefined(corruptedJourney.movement)
        Assert.isTrue(Reflect.set(corruptedJourney.movement.submission.selectedInputs, "strength", 1.5))
        return corruptedJourney
      },
    },
    {
      label: "destination differs from the live journey",
      expectedIssues: [
        {
          issue: "Fleet moving-child has an invalid in-progress Action binding",
          submittedActionId: "MOVE_1",
          actionDefinitionId: branded<ActionDefinitionId>("MOVE_FLEET"),
          actionDefinitionName: "Move Fleet",
        },
      ],
      createJourney: (fixture: ReturnType<typeof createFixture>): ReturnType<typeof createFleetStub> =>
        createMovementJourney(
          fixture,
          createSubmittedActionStub({
            ...createSubmission(fixture, "MOVE_1", 20),
            selectedTargets: { fleet: fixture.sourceFleetId, planet: fixture.originId },
          }),
          1,
        ),
    },
    {
      label: "departure is in the future",
      expectedIssues: [
        {
          issue: "Fleet moving-child has an invalid in-progress Action binding",
          submittedActionId: "MOVE_1",
          actionDefinitionId: branded<ActionDefinitionId>("MOVE_FLEET"),
          actionDefinitionName: "Move Fleet",
        },
      ],
      createJourney: (fixture: ReturnType<typeof createFixture>): ReturnType<typeof createFleetStub> =>
        createMovementJourney(fixture, createSubmission(fixture, "MOVE_1", 20), 3),
    },
    {
      label: "historical source Action instance is missing from the pool",
      expectedIssues: [
        {
          issue: "Fleet moving-child has an invalid in-progress Action binding",
          submittedActionId: "UNKNOWN_MOVE_INSTANCE",
          actionDefinitionId: branded<ActionDefinitionId>("MOVE_FLEET"),
          actionDefinitionName: "Move Fleet",
        },
      ],
      createJourney: (fixture: ReturnType<typeof createFixture>): ReturnType<typeof createFleetStub> =>
        createMovementJourney(
          fixture,
          createSubmittedActionStub({ ...createSubmission(fixture, "MOVE_1", 20), id: "UNKNOWN_MOVE_INSTANCE" }),
          1,
        ),
    },
    {
      label: "historical Action Definition differs from its pool entry",
      expectedIssues: [
        {
          issue: "Fleet moving-child has an invalid in-progress Action binding",
          submittedActionId: "MOVE_1",
          actionDefinitionId: branded<ActionDefinitionId>("UNRELATED_ACTION_DEFINITION"),
          actionDefinitionName: undefined,
        },
      ],
      createJourney: (fixture: ReturnType<typeof createFixture>): ReturnType<typeof createFleetStub> =>
        createMovementJourney(
          fixture,
          createSubmittedActionStub({
            ...createSubmission(fixture, "MOVE_1", 20),
            actionDefinitionId: branded<ActionDefinitionId>("UNRELATED_ACTION_DEFINITION"),
          }),
          1,
        ),
    },
    {
      label: "historical submission player differs from the moving Fleet owner",
      expectedIssues: [
        {
          issue: 'Submitting player "00000000-0000-4000-8000-000000000013" does not exist in this turn',
          submittedActionId: "MOVE_1",
          actionDefinitionId: branded<ActionDefinitionId>("MOVE_FLEET"),
          actionDefinitionName: "Move Fleet",
        },
        {
          issue: "Fleet moving-child has an invalid in-progress Action binding",
          submittedActionId: "MOVE_1",
          actionDefinitionId: branded<ActionDefinitionId>("MOVE_FLEET"),
          actionDefinitionName: "Move Fleet",
        },
      ],
      createJourney: (fixture: ReturnType<typeof createFixture>): ReturnType<typeof createFleetStub> => {
        const corruptedJourney = structuredClone(createMovementJourney(fixture, createSubmission(fixture, "MOVE_1", 20), 1))
        Assert.isDefined(corruptedJourney.movement)
        Assert.isTrue(
          Reflect.set(corruptedJourney.movement.submission, "playerId", typedParse(PlayerIdSchema, "00000000-0000-4000-8000-000000000013")),
        )
        return corruptedJourney
      },
    },
  ] satisfies ReadonlyArray<{
    label: string
    expectedIssues: Array<{
      issue: string
      submittedActionId: string
      actionDefinitionId: ActionDefinitionId
      actionDefinitionName: string | undefined
    }>
    createJourney: (fixture: ReturnType<typeof createFixture>) => ReturnType<typeof createFleetStub>
  }>

  it.each(corruptJourneyCases)("should reject corrupt journey bindings before mutation: $label", ({ createJourney, expectedIssues }) => {
    // Arrange
    const fixture = createFixture()
    const movingJourney = createJourney(fixture)
    const turnState = createTurnStateStub({
      gameId: fixture.state.gameId,
      turn: 2,
      players: fixture.state.players,
      planets: fixture.state.planets,
      fleets: indexBy("id", [movingJourney]),
    })
    const originalState = structuredClone(turnState)

    // Act
    const result = resolveTurn(turnState, fixture.ruleset, createSeededRng())

    // Assert
    expect(result).toStrictEqual(Result.Failure(ResolveTurnError.InvalidSubmissions({ issues: expectedIssues })))
    expect(turnState).toStrictEqual(originalState)
  })

  it("should resolve arbitrary Fleet source, destination, and force role tags in a composed action", () => {
    // Arrange
    const fixture = createFixture()
    const actionDefinition = createActionDefinitionStub({
      id: "RENAMED_MOVEMENT_WITH_GAIN",
      name: "Renamed movement with gain",
      type: ActionType.DIRECTIVE,
      tier: ActionTier.STANDARD,
      inputs: { units: { type: "POSITIVE_INTEGER", label: "Units" } },
      targets: {
        originForce: {
          targetType: TargetType.FLEET,
          constraints: [OwnedBySubmittingPlayerConstraint.create(), StationaryFleetConstraint.create()],
        },
        landingSite: {
          targetType: TargetType.PLANET,
          constraints: [
            WithinFleetRangeConstraint.create({ sourceFleetTag: "originForce", maxDistance: 10 }),
            DifferentFromFleetOriginConstraint.create({ sourceFleetTag: "originForce" }),
          ],
        },
      },
      costs: [
        ResourceLossEffectDefinition.create({ quantity: 3, resourceType: ResourceType.INFLUENCE }),
        ResourceLossEffectDefinition.create({ quantity: 1, resourceType: ResourceType.FUEL }),
      ],
      effects: [
        FleetMoveEffectDefinition.create({ fleetTag: "originForce", planetTag: "landingSite", strengthTag: "units", speed: 2 }),
        ResourceGainEffectDefinition.create({ quantity: 2, resourceType: ResourceType.INFLUENCE }),
      ],
    })
    const ruleset = createRulesetStub({
      actionDefinitions: indexBy("id", [actionDefinition]),
      actionPool: [{ id: "RENAMED_MOVE_1", actionDefinitionId: actionDefinition.id }],
    })
    const submission = createSubmittedActionStub({
      id: "RENAMED_MOVE_1",
      playerId: fixture.playerId,
      actionDefinitionId: actionDefinition.id,
      selectedTargets: { originForce: fixture.sourceFleetId, landingSite: fixture.destinationId },
      selectedInputs: { units: 20 },
    })

    // Act
    const resolved = resolveState({ ...fixture.state, submittedActions: [submission] }, ruleset)
    const fleets = Object.values(resolved.fleets)
    const journey = fleets.find(({ movement }) => movement !== undefined)

    // Assert
    expect(fleets.find(({ id }) => id === fixture.sourceFleetId)?.strength).toBe(30)
    expect(journey).toMatchObject({ strength: 20, distanceToEnd: 3, movement: { submission } })
    expect(resolved.players[fixture.playerId]?.resources).toMatchObject({
      [ResourceType.INFLUENCE]: 19,
      [ResourceType.FUEL]: 19,
    })
    expect(resolved.resolvedActions[0]?.actionOutcomes).toHaveLength(5)
  })

  it("should merge an arriving Fleet into the existing friendly station and release its occupancy", () => {
    // Arrange
    const fixture = createFixture({ distance: 5, speed: 5 })
    const stationedFleet = createFleetStub({
      id: branded<FleetId>("friendly-stationed"),
      ownerPlayerId: fixture.playerId,
      originPlanetId: fixture.destinationId,
      name: "Home Guard",
      strength: 7,
    })
    const state = structuredClone({
      ...fixture.state,
      fleets: indexBy("id", [...Object.values(fixture.state.fleets), stationedFleet]),
      submittedActions: [createSubmission(fixture, "MOVE_1", 20)],
    })

    // Act
    const resolved = resolveState(state, fixture.ruleset)

    // Assert
    expect(Object.keys(resolved.fleets).toSorted()).toStrictEqual([fixture.sourceFleetId, stationedFleet.id].toSorted())
    const mergedFleet = resolved.fleets[stationedFleet.id]
    expect(mergedFleet).toMatchObject({
      id: stationedFleet.id,
      ownerPlayerId: fixture.playerId,
      name: "Home Guard",
      originPlanetId: fixture.destinationId,
      strength: 27,
    })
    expect(mergedFleet).not.toHaveProperty("movement")
    expect(mergedFleet).not.toHaveProperty("destinationPlanetId")
    expect(mergedFleet).not.toHaveProperty("distanceToEnd")
    expect(resolved.removedFleetIds).toHaveLength(1)
    expect(resolved.removedFleetIds).not.toContain(fixture.sourceFleetId)
  })

  it("should leave an ordinary arriving Fleet separate from an enemy stationed Fleet", () => {
    // Arrange
    const fixture = createFixture({ distance: 5, speed: 5 })
    const enemyPlayerId = typedParse(PlayerIdSchema, "00000000-0000-4000-8000-000000000022")
    const enemyFleet = createFleetStub({
      id: branded<FleetId>("enemy-stationed"),
      ownerPlayerId: enemyPlayerId,
      originPlanetId: fixture.destinationId,
      name: "Enemy Guard",
      strength: 7,
    })
    const state = structuredClone({
      ...fixture.state,
      fleets: indexBy("id", [...Object.values(fixture.state.fleets), enemyFleet]),
      submittedActions: [createSubmission(fixture, "MOVE_1", 20)],
    })

    // Act
    const resolved = resolveState(state, fixture.ruleset)
    const resolvedFleets = Object.values(resolved.fleets)
    expect(resolvedFleets).toHaveLength(3)
    const arrivingFleet = resolvedFleets.at(-1)
    Assert.isDefined(arrivingFleet)

    // Assert
    expect(resolved.fleets[fixture.sourceFleetId]).toMatchObject({
      originPlanetId: fixture.originId,
      strength: 30,
    })
    const persistedEnemyFleet = resolved.fleets[enemyFleet.id]
    expect(persistedEnemyFleet).toMatchObject({
      id: enemyFleet.id,
      ownerPlayerId: enemyPlayerId,
      name: "Enemy Guard",
      originPlanetId: fixture.destinationId,
      strength: 7,
    })
    expect(persistedEnemyFleet).not.toHaveProperty("movement")
    expect(arrivingFleet).toMatchObject({
      ownerPlayerId: fixture.playerId,
      originPlanetId: fixture.destinationId,
      strength: 20,
    })
    expect(arrivingFleet?.movement).toBeUndefined()
    expect(arrivingFleet?.destinationPlanetId).toBeUndefined()
    expect(arrivingFleet?.distanceToEnd).toBeUndefined()
    expect(arrivingFleet?.id).not.toBe(enemyFleet.id)
    expect(Object.values(resolved.fleets).filter(({ originPlanetId }) => originPlanetId === fixture.destinationId)).toHaveLength(2)
  })

  it.each([
    { label: "zero-distance distinct planets", distance: 0, speed: 2, expectedTick: 0 },
    { label: "half-speed distance", distance: 0.5, speed: 2, expectedTick: 5 },
    { label: "full-speed distance", distance: 2, speed: 2, expectedTick: 20 },
    { label: "arrival exactly at speed", distance: 5, speed: 5, expectedTick: 20 },
  ])("should preserve the $label arrival tick", ({ distance, speed, expectedTick }) => {
    // Arrange
    const fixture = createFixture({ distance, speed })

    // Act
    const resolved = resolve(fixture, [createSubmission(fixture, "MOVE_1", 10)])
    const arrivedFleet = Object.values(resolved.fleets).find(({ id }) => id !== fixture.sourceFleetId)

    // Assert
    expect(arrivedFleet?.originPlanetId).toBe(fixture.destinationId)
    expect(arrivedFleet?.arrivedAtTick).toBe(expectedTick)
    expect(arrivedFleet?.movement).toBeUndefined()
  })
})

type FleetMovementFixture = {
  playerId: PlayerId
  originId: PlanetId
  destinationId: PlanetId
  sourceFleetId: FleetId
  actionDefinition: ActionDefinition
  ruleset: ReturnType<typeof createRulesetStub>
  state: ReturnType<typeof createTurnStateStub>
}

function createFixture({ distance = 5, speed = 2 }: CreateFixtureInput = {}): FleetMovementFixture {
  const playerId = typedParse(PlayerIdSchema, "00000000-0000-4000-8000-000000000021")
  const originId = branded<PlanetId>("planet-origin")
  const destinationId = branded<PlanetId>("planet-destination")
  const sourceFleetId = branded<FleetId>("source-fleet")
  const actionDefinition = createActionDefinitionStub({
    id: "MOVE_FLEET",
    name: "Move Fleet",
    type: ActionType.DIRECTIVE,
    tier: ActionTier.STANDARD,
    inputs: { strength: { type: "POSITIVE_INTEGER", label: "Fleet Strength" } },
    targets: {
      fleet: {
        targetType: TargetType.FLEET,
        constraints: [OwnedBySubmittingPlayerConstraint.create(), StationaryFleetConstraint.create()],
      },
      planet: {
        targetType: TargetType.PLANET,
        constraints: [
          WithinFleetRangeConstraint.create({ sourceFleetTag: "fleet", maxDistance: 10 }),
          DifferentFromFleetOriginConstraint.create({ sourceFleetTag: "fleet" }),
        ],
      },
    },
    costs: [
      ResourceLossEffectDefinition.create({ quantity: 3, resourceType: ResourceType.INFLUENCE }),
      ResourceLossEffectDefinition.create({ quantity: 1, resourceType: ResourceType.FUEL }),
    ],
    effects: [FleetMoveEffectDefinition.create({ fleetTag: "fleet", planetTag: "planet", strengthTag: "strength", speed })],
  })
  const ruleset = createRulesetStub({
    actionDefinitions: indexBy("id", [actionDefinition]),
    actionPool: [
      { id: "MOVE_1", actionDefinitionId: actionDefinition.id },
      { id: "MOVE_2", actionDefinitionId: actionDefinition.id },
    ],
  })
  const origin = createPlanetStub({ id: originId, ownerPlayerId: playerId, name: "Origin", x: 0, y: 0 })
  const destination = createPlanetStub({ id: destinationId, ownerPlayerId: null, name: "Destination", x: distance, y: 0 })
  const sourceFleet = createFleetStub({
    id: sourceFleetId,
    ownerPlayerId: playerId,
    originPlanetId: originId,
    name: "Source Fleet",
    strength: 50,
  })
  const state = createTurnStateStub({
    gameId: typedParse(GameIdSchema, 71),
    turn: 1,
    players: indexBy("id", [
      {
        id: playerId,
        resources: createResourcesStub({ [ResourceType.INFLUENCE]: 20, [ResourceType.FUEL]: 20 }),
      },
    ]),
    planets: indexBy("id", [origin, destination]),
    fleets: indexBy("id", [sourceFleet]),
  })

  return { playerId, originId, destinationId, sourceFleetId, actionDefinition, ruleset, state }
}

function createMovementJourney(
  fixture: FleetMovementFixture,
  submission: SubmittedAction,
  departureTurn: number,
): ReturnType<typeof createFleetStub> {
  return createFleetStub({
    id: "moving-child",
    ownerPlayerId: fixture.playerId,
    originPlanetId: fixture.originId,
    strength: 20,
    destinationPlanetId: fixture.destinationId,
    distanceToEnd: 3,
    movement: typedParse(FleetMovementSchema, { speed: 2, departureTurn, submission, pendingArrivalEffects: [] }),
  })
}

function createSubmission(fixture: FleetMovementFixture, actionId: "MOVE_1" | "MOVE_2", strength: number): SubmittedAction {
  return createSubmittedActionStub({
    id: actionId,
    playerId: fixture.playerId,
    actionDefinitionId: fixture.actionDefinition.id,
    selectedTargets: { fleet: fixture.sourceFleetId, planet: fixture.destinationId },
    selectedInputs: { strength },
  })
}

function resolve(fixture: FleetMovementFixture, submissions: readonly SubmittedAction[]): ResolvedTurnState {
  return resolveState(structuredClone({ ...fixture.state, submittedActions: submissions }), fixture.ruleset)
}

function resolveState(state: ReturnType<typeof createTurnStateStub>, ruleset: ReturnType<typeof createRulesetStub>): ResolvedTurnState {
  const result = resolveTurn(state, ruleset, createSeededRng())
  if (Result.isFailure(result)) {
    throw new Error(JSON.stringify(result.error))
  }
  return result.value
}

function resolveContinuation(fixture: FleetMovementFixture, previousTurn: ResolvedTurnState, turn: number): ResolvedTurnState {
  const reloadedFleets = Object.values(previousTurn.fleets).map((fleet) =>
    fleet.movement === undefined ? fleet : FleetSchema.parse(JSON.parse(JSON.stringify(fleet))),
  )
  const turnState = createTurnStateStub({
    gameId: previousTurn.gameId,
    turn,
    players: previousTurn.players,
    planets: previousTurn.planets,
    fleets: indexBy("id", reloadedFleets),
  })
  return resolveState(turnState, fixture.ruleset)
}

function createEligibilityState(fixture: FleetMovementFixture, resolved: ResolvedTurnState, turn: number): EligibilityState {
  const player = resolved.players[fixture.playerId]
  Assert.isDefined(player)
  return {
    gameId: resolved.gameId,
    turn,
    submittingPlayerId: fixture.playerId,
    resources: player.resources,
    players: indexBy(
      "id",
      Object.values(resolved.players).map(({ id }) => ({ id, ownerPlayerId: id })),
    ),
    planets: indexBy(
      "id",
      Object.values(resolved.planets).map(({ id, ownerPlayerId, x, y }) => ({ id, ownerPlayerId, x, y })),
    ),
    fleets: resolved.fleets,
    actions: computeAvailableActions({ playerIds: [fixture.playerId], ruleset: fixture.ruleset }),
  }
}

function toFleetProjection(fleet: ResolutionFleet): ToFleetProjectionResult {
  return {
    id: fleet.id,
    ownerPlayerId: fleet.ownerPlayerId,
    strength: fleet.strength,
    originPlanetId: fleet.originPlanetId,
    destinationPlanetId: fleet.destinationPlanetId,
    distanceToEnd: fleet.distanceToEnd,
    movement:
      fleet.movement === undefined
        ? undefined
        : { submissionId: fleet.movement.submission.id, departureTurn: fleet.movement.departureTurn },
  }
}

function verifyDepartureResources({
  departureResources,
  occupiedJourney,
  occupiedEvaluation,
  stillTravelingDistances,
  continuationResources,
  resolved,
  arrivedFleet,
  fixture,
  departureSubmission,
}: VerifyDepartureResourcesInput): void {
  expect(departureResources).toStrictEqual(
    createResourcesStub({
      [ResourceType.INFLUENCE]: 17,
      [ResourceType.FUEL]: 19,
    }),
  )
  expect(occupiedJourney.distanceToEnd).toBe(0.9)
  expect(occupiedEvaluation.status).toBe("INELIGIBLE")
  expect(occupiedEvaluation.issues).toContainEqual({
    code: "ACTION_ALREADY_IN_PROGRESS",
    actionId: branded<ActionId>("MOVE_1"),
    message: 'Action instance "MOVE_1" is still in progress with Fleet "' + occupiedJourney.id + '"',
  })
  expect(stillTravelingDistances).toHaveLength(8)
  expect(Math.min(...stillTravelingDistances)).toBeGreaterThan(0)
  expect(continuationResources).toStrictEqual(Array.from({ length: 9 }, () => departureResources))
  expect(resolved.turn).toBe(10)
  expect(arrivedFleet).toMatchObject({
    originPlanetId: fixture.destinationId,
    strength: 20,
    arrivedAtTick: 20,
  })
  expect(arrivedFleet.movement).toBeUndefined()
  expect(arrivedFleet.destinationPlanetId).toBeUndefined()
  expect(arrivedFleet.distanceToEnd).toBeUndefined()
  expect(resolved.resolvedContinuations).toHaveLength(1)
  expect(resolved.resolvedContinuations[0]?.originatingSubmission).toStrictEqual(departureSubmission)
}

function verify({ resolved, releasedEvaluation, fixture }: VerifyInput): void {
  expect(resolved.resolvedContinuations[0]?.actionOutcomes).toStrictEqual([
    EffectOutcome.Resolved({ result: 'Fleet "Source Fleet" moved 0.1 light years towards Planet "Destination"' }),
    EffectOutcome.Resolved({ result: 'Fleet "Source Fleet" arrived on Planet "Destination"' }),
  ])
  expect(releasedEvaluation).toMatchObject({
    status: "ELIGIBLE",
    issues: [],
    strengthCommitments: { [fixture.sourceFleetId]: 1 },
    resourceCommitments: {
      [ResourceType.INFLUENCE]: 3,
      [ResourceType.METAL]: 0,
      [ResourceType.FUEL]: 1,
      [ResourceType.ENERGY]: 0,
      [ResourceType.COLONY]: 0,
    },
  })
}

type CreateFixtureInput = { distance?: number; speed?: number }

type ToFleetProjectionResult = {
  id: FleetId
  ownerPlayerId: ResolutionFleet["ownerPlayerId"]
  strength: number
  originPlanetId: PlanetId
  destinationPlanetId: PlanetId | undefined
  distanceToEnd: number | undefined
  movement: { submissionId: string; departureTurn: number } | undefined
}

type VerifyDepartureResourcesInput = {
  departureResources: undefined | ReturnType<typeof createResourcesStub>
  occupiedJourney: ResolutionFleet
  occupiedEvaluation: Readonly<{
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
  stillTravelingDistances: number[]
  continuationResources: Array<ReturnType<typeof createResourcesStub> | undefined>
  resolved: ResolvedTurnState
  arrivedFleet: ResolutionFleet
  fixture: FleetMovementFixture
  departureSubmission: ReturnType<typeof createSubmittedActionStub>
}

type VerifyInput = {
  resolved: ResolvedTurnState
  releasedEvaluation: Readonly<{
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
  fixture: FleetMovementFixture
}
