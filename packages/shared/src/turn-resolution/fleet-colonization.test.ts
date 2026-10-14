import { Assert, indexBy, mulberry32Prng, Rng } from "@guillaume-docquier/tools-ts"
import { typedParse } from "@guillaume-docquier/tools-ts/schemas"
import { describe, expect, it } from "vitest"
import { computeAvailableActions } from "#shared/action-submission/computeAvailableActions.ts"
import type { EligibilityState } from "#shared/action-submission/evaluateActionSelection.ts"
import { GameIdSchema } from "#shared/domain/games/GameId.ts"
import type { PlayerId } from "#shared/domain/players/PlayerId.ts"
import { createResourcesStub } from "#shared/domain/resources/Resources.stub.ts"
import { ResourceType } from "#shared/domain/resources/ResourceType.ts"
import { ActionDefinitionSchema } from "#shared/domain/ruleset/action-definitions/ActionDefinition.ts"
import { FleetAssaultEffectDefinition } from "#shared/domain/ruleset/effect-definitions/FleetAssaultEffectDefinition.ts"
import { FleetColonizeEffectDefinition } from "#shared/domain/ruleset/effect-definitions/FleetColonizeEffectDefinition.ts"
import { FleetMoveEffectDefinition } from "#shared/domain/ruleset/effect-definitions/FleetMoveEffectDefinition.ts"
import { Ruleset } from "#shared/domain/ruleset/Ruleset.ts"
import { createSubmittedActionStub } from "#shared/domain/turns/actions/Action.stub.ts"
import { ActionIdSchema } from "#shared/domain/turns/actions/ActionId.ts"
import { FleetSchema, type Fleet } from "#shared/domain/world/fleets/Fleet.ts"
import { isPlanetUnclaimed } from "#shared/domain/world/planets/isPlanetUnclaimed.ts"
import type { Planet } from "#shared/domain/world/planets/Planet.ts"
import { createSeededRng } from "#shared/testing/createSeededRng.ts"
import { AttackMoveTest } from "#shared/testing/test-ruleset/action-definitions/attack-move.ts"
import { ColonizePlanetTest, SeedOutpostTest } from "#shared/testing/test-ruleset/action-definitions/colonize.ts"
import { MoveFleetStandard } from "#shared/testing/test-ruleset/action-definitions/move-fleet.ts"
import { TestRuleset } from "#shared/testing/test-ruleset/TestRuleset.ts"
import { EffectPool } from "#shared/turn-resolution/effects/EffectPool.ts"
import { resolveColonizationPhase } from "#shared/turn-resolution/phases/implementations/resolveColonizationPhase.ts"
import { resolveFleetCombatPhase } from "#shared/turn-resolution/phases/implementations/resolveFleetCombatPhase.ts"
import { resolveFleetMovementPhase } from "#shared/turn-resolution/phases/implementations/resolveFleetMovementPhase.ts"
import type { ResolvedTurnState } from "#shared/turn-resolution/ResolvedTurnState.ts"
import { resolveTurn } from "#shared/turn-resolution/resolveTurn.ts"
import type { TurnContext } from "#shared/turn-resolution/TurnContext.ts"
import { createTurnStateStub } from "#shared/turn-resolution/TurnState.stub.ts"
import { assertAAtP2, assertAAtP, assertDeparture } from "./fleet-colonization.assertions-2.test-support.ts"
import {
  assertColonizeEvaluation,
  assertIncompleteForce,
  assertScenarioState2,
  assertTurnTwoJourneys,
} from "./fleet-colonization.assertions.test-support.ts"
import {
  PLAYER_A,
  PLAYER_B,
  PLAYER_C,
  findJourneyForSubmission,
  createArrivalRace,
  createRuleset,
  resolve,
  resolveContinuation,
  planet,
  fleet,
  submit,
  outcomeFor,
  fleetAtPlanetForOwner,
  fleetStrengthForOwner,
} from "./fleet-colonization.test-support.ts"

describe("Fleet Colonization", () => {
  it("should resolve the complete three-player fleet-operations vector across reloaded Turns and reuse released Actions", () => {
    const colonize = typedParse(ActionDefinitionSchema, {
      ...ColonizePlanetTest,
      id: "TEST_I4_SPEED_TWO_COLONIZE",
      name: "I4 Speed Two Colonize",
      effects: [
        FleetMoveEffectDefinition.create({ fleetTag: "fleet", planetTag: "planet", strengthTag: "strength", speed: 2 }),
        FleetColonizeEffectDefinition.create({ fleetTag: "fleet", planetTag: "planet", strengthRequirement: 20 }),
      ],
    })
    const ordinaryMove = typedParse(ActionDefinitionSchema, {
      ...MoveFleetStandard,
      id: "TEST_I4_SPEED_TWO_MOVE",
      name: "I4 Speed Two Move",
      effects: [FleetMoveEffectDefinition.create({ fleetTag: "fleet", planetTag: "planet", strengthTag: "strength", speed: 2 })],
    })
    const attackMove = typedParse(ActionDefinitionSchema, {
      ...AttackMoveTest,
      id: "TEST_I4_SPEED_TWO_ATTACK_MOVE",
      name: "I4 Speed Two Attack Move",
      effects: [
        FleetMoveEffectDefinition.create({ fleetTag: "fleet", planetTag: "planet", strengthTag: "strength", speed: 2 }),
        FleetAssaultEffectDefinition.create({ fleetTag: "fleet", planetTag: "planet" }),
      ],
    })
    const colonizeActionId = typedParse(ActionIdSchema, "I4_COLONIZE_1")
    const moveActionId = typedParse(ActionIdSchema, "I4_MOVE_1")
    const attackActionId = typedParse(ActionIdSchema, "I4_ATTACK_MOVE_1")
    const ruleset = Ruleset.create({
      ...TestRuleset,
      actionDefinitions: {
        ...TestRuleset.actionDefinitions,
        [colonize.id]: colonize,
        [ordinaryMove.id]: ordinaryMove,
        [attackMove.id]: attackMove,
      },
      actionPool: [
        { id: colonizeActionId, actionDefinitionId: colonize.id },
        { id: moveActionId, actionDefinitionId: ordinaryMove.id },
        { id: attackActionId, actionDefinitionId: attackMove.id },
      ],
    })
    const gameId = typedParse(GameIdSchema, 74)
    const playerIds = [PLAYER_A, PLAYER_B, PLAYER_C]
    const initialPlayers = indexBy(
      "id",
      playerIds.map((id) => ({
        id,
        resources: createResourcesStub({
          [ResourceType.INFLUENCE]: 100,
          [ResourceType.METAL]: 0,
          [ResourceType.FUEL]: 10,
          [ResourceType.ENERGY]: 0,
          [ResourceType.COLONY]: 7,
        }),
      })),
    )
    const aHome = planet("i4-a-home", PLAYER_A, 0)
    const bHome = planet("i4-b-home", PLAYER_B, -0.5)
    const cHome = planet("i4-c-home", PLAYER_C, -0.25)
    const p = planet("i4-destination-p", null, 4.5)
    const q = planet("i4-destination-q", null, 5)
    const outsideRange = planet("i4-outside-range", null, 5.001)
    const planets = [aHome, bHome, cHome, p, q, outsideRange]
    const aSource = fleet("i4-a-source", PLAYER_A, aHome, 70)
    const bSource = fleet("i4-b-source", PLAYER_B, bHome, 35)
    const cSource = fleet("i4-c-source", PLAYER_C, cHome, 16)
    const fleets = [aSource, bSource, cSource]
    const aColonize = submit({
      id: colonizeActionId,
      playerId: PLAYER_A,
      actionDefinitionId: colonize.id,
      source: aSource,
      target: p,
      strength: 35,
    })
    const aMove = submit({
      id: moveActionId,
      playerId: PLAYER_A,
      actionDefinitionId: ordinaryMove.id,
      source: aSource,
      target: q,
      strength: 15,
    })
    const bColonize = submit({
      id: colonizeActionId,
      playerId: PLAYER_B,
      actionDefinitionId: colonize.id,
      source: bSource,
      target: p,
      strength: 35,
    })
    const cAttack = submit({
      id: attackActionId,
      playerId: PLAYER_C,
      actionDefinitionId: attackMove.id,
      source: cSource,
      target: p,
      strength: 16,
    })

    const eligibilityState = (
      playerId: PlayerId,
      turn: number,
      players: ResolvedTurnState["players"],
      currentPlanets: ReadonlyArray<Pick<Planet, "id" | "ownerPlayerId" | "x" | "y">>,
      currentFleets: readonly Fleet[],
    ): EligibilityState => {
      const currentPlayer = players[playerId]
      Assert.isDefined(currentPlayer)
      return {
        gameId,
        turn,
        submittingPlayerId: playerId,
        resources: currentPlayer.resources,
        players: indexBy(
          "id",
          playerIds.map((id) => ({ id, ownerPlayerId: id })),
        ),
        planets: indexBy(
          "id",
          currentPlanets.map(({ id, ownerPlayerId, x, y }) => ({ id, ownerPlayerId, x, y })),
        ),
        fleets: indexBy("id", currentFleets),
        actions: computeAvailableActions({ playerIds: [playerId], ruleset }),
      }
    }
    const initialA = eligibilityState(PLAYER_A, 1, initialPlayers, planets, fleets)

    assertColonizeEvaluation({
      initialA,
      ruleset,
      colonizeActionId,
      aSource,
      p,
      aColonize,
      moveActionId,
      q,
      outsideRange,
      initialPlayers,
      aMove,
    })

    assertIncompleteForce({
      initialA,
      ruleset,
      moveActionId,
      q,
      ordinaryMove,
      aColonize,
      aMove,
      eligibilityState,
      initialPlayers,
      planets,
      fleets,
      bColonize,
      cAttack,
      aSource,
    })

    const firstRng = createSeededRng(1234)
    const firstResult = resolveTurn(
      createTurnStateStub({
        gameId,
        turn: 1,
        submittedActions: [aColonize, aMove, bColonize, cAttack],
        players: structuredClone(initialPlayers),
        planets: indexBy("id", structuredClone(planets)),
        fleets: indexBy("id", structuredClone(fleets)),
      }),
      ruleset,
      firstRng,
    )
    Assert.isSuccess(firstResult)
    const departure = firstResult.value
    const firstRngState = firstRng.getState()
    const turnTwoRng = Rng.fromState(
      {
        generatorState: Number(firstRngState.generatorState),
        spareNormal: firstRngState.spareNormal,
      },
      mulberry32Prng,
    )
    const reloadTurn = (
      previous: ResolvedTurnState,
      turn: number,
      submissions: Array<ReturnType<typeof createSubmittedActionStub>>,
      rng: ReturnType<typeof createSeededRng>,
    ): ResolvedTurnState => {
      const reloadedFleets = Object.values(previous.fleets).map((fleetValue) => FleetSchema.parse(JSON.parse(JSON.stringify(fleetValue))))
      const result = resolveTurn(
        createTurnStateStub({
          gameId: previous.gameId,
          turn,
          submittedActions: submissions,
          players: structuredClone(previous.players),
          planets: structuredClone(previous.planets),
          fleets: indexBy("id", reloadedFleets),
        }),
        ruleset,
        rng,
      )
      Assert.isSuccess(result)
      return result.value
    }
    const turnTwo = reloadTurn(departure, 2, [], turnTwoRng)
    const turnThreeRng = Rng.fromState(turnTwoRng.getState(), mulberry32Prng)
    const afterArrival = reloadTurn(turnTwo, 3, [], turnThreeRng)
    const strengthTotal = (state: ResolvedTurnState): number =>
      Object.values(state.fleets).reduce((total, currentFleet) => total + currentFleet.strength, 0)
    const aColonizeJourney = findJourneyForSubmission(departure, PLAYER_A, colonizeActionId)
    const aMoveJourney = findJourneyForSubmission(departure, PLAYER_A, moveActionId)
    const bColonizeJourney = findJourneyForSubmission(departure, PLAYER_B, colonizeActionId)
    const cAttackJourney = findJourneyForSubmission(departure, PLAYER_C, attackActionId)

    assertScenarioState2({
      aSource,
      bSource,
      cSource,
      departure,
      aColonizeJourney,
      aMoveJourney,
      bColonizeJourney,
      cAttackJourney,
      strengthTotal,
    })

    const turnTwoJourneys = [
      findJourneyForSubmission(turnTwo, PLAYER_A, colonizeActionId),
      findJourneyForSubmission(turnTwo, PLAYER_A, moveActionId),
      findJourneyForSubmission(turnTwo, PLAYER_B, colonizeActionId),
      findJourneyForSubmission(turnTwo, PLAYER_C, attackActionId),
    ]
    const journeyActionBindings = [
      { playerId: PLAYER_A, actionId: colonizeActionId, freeMoveActionId: attackActionId },
      { playerId: PLAYER_A, actionId: moveActionId, freeMoveActionId: attackActionId },
      { playerId: PLAYER_B, actionId: colonizeActionId, freeMoveActionId: moveActionId },
      { playerId: PLAYER_C, actionId: attackActionId, freeMoveActionId: colonizeActionId },
    ]
    expect(turnTwoJourneys.map(({ strength, distanceToEnd }) => ({ strength, distanceToEnd }))).toStrictEqual([
      { strength: 35, distanceToEnd: 0.5 },
      { strength: 15, distanceToEnd: 1 },
      { strength: 35, distanceToEnd: 1 },
      { strength: 16, distanceToEnd: 0.75 },
    ])
    const preCombatState = createTurnStateStub({
      gameId: turnTwo.gameId,
      turn: 3,
      players: structuredClone(turnTwo.players),
      planets: structuredClone(turnTwo.planets),
      fleets: indexBy(
        "id",
        Object.values(turnTwo.fleets).map((fleetValue) => FleetSchema.parse(JSON.parse(JSON.stringify(fleetValue)))),
      ),
    })
    const preCombatContext: TurnContext = {
      rng: createSeededRng(1234),
      turnState: preCombatState,
      effectPool: new EffectPool([]),
      ruleset,
      previousJourneyFleetIds: turnTwoJourneys.map(({ id }) => id),
      newDepartureFleetIds: new Set(),
      removedFleetIds: new Set(),
      changedPlanetIds: new Set(),
      resolvedContinuations: [],
      pendingArrivalAssaults: [],
      pendingArrivalColonizations: [],
      fleetIdRebindings: new Map(),
    }
    Assert.isSuccess(resolveFleetMovementPhase(preCombatContext))

    assertTurnTwoJourneys({
      turnTwoJourneys,
      preCombatState,
      cAttackJourney,
      p,
      preCombatContext,
      attackActionId,
      strengthTotal,
      turnTwo,
      departure,
      journeyActionBindings,
      eligibilityState,
      ruleset,
      aSource,
    })

    const aAtP = fleetAtPlanetForOwner(afterArrival, p.id, PLAYER_A)
    const aAtQ = fleetAtPlanetForOwner(afterArrival, q.id, PLAYER_A)
    const bAtP = fleetAtPlanetForOwner(afterArrival, p.id, PLAYER_B)
    Assert.isDefined(aAtP)
    Assert.isDefined(aAtQ)
    Assert.isDefined(bAtP)

    assertAAtP2({
      aAtP,
      aAtQ,
      bAtP,
      afterArrival,
      p,
      q,
      cAttackJourney,
      strengthTotal,
      colonizeActionId,
      moveActionId,
      attackActionId,
      aColonizeJourney,
      bColonizeJourney,
    })
    const aAtHome = afterArrival.fleets[aSource.id]
    Assert.isDefined(aAtHome)

    assertAAtP({
      aAtP,
      bAtP,
      aAtQ,
      aAtHome,
      eligibilityState,
      afterArrival,
      journeyActionBindings,
      ruleset,
      moveActionId,
      aSource,
      q,
      ordinaryMove,
      turnThreeRng,
      reloadTurn,
      p,
      strengthTotal,
    })
  })

  it("should persist a 35-Strength arrival through JSON reloads, consume20 once, and preserve the source remainder", () => {
    const origin = planet("arrival-origin", PLAYER_A, 0)
    const target = planet("arrival-neutral", null, 2.5)
    const source = fleet("arrival-source", PLAYER_A, origin, 50)
    const action = submit({
      id: ColonizePlanetTest.id + "_1",
      playerId: PLAYER_A,
      actionDefinitionId: ColonizePlanetTest.id,
      source,
      target,
      strength: 35,
    })
    const rng = createSeededRng(987)

    const departure = resolve({ planets: [origin, target], fleets: [source], submissions: [action], rng })
    const journey = Object.values(departure.fleets).find(({ movement }) => movement !== undefined)
    Assert.isDefined(journey)
    expect(departure.planets[target.id]?.ownerPlayerId).toBeNull()
    expect(departure.fleets[source.id]?.strength).toBe(15)
    expect(journey).toMatchObject({ strength: 35, distanceToEnd: 1.5, movement: { departureTurn: 1 } })
    expect(departure.players[PLAYER_A]?.resources[ResourceType.INFLUENCE]).toBe(25)

    const continuation = resolveContinuation(departure, 2, rng)
    const reloadedJourney = continuation.fleets[journey.id]
    Assert.isDefined(reloadedJourney)
    expect(reloadedJourney.distanceToEnd).toBe(0.5)
    expect(continuation.players[PLAYER_A]?.resources[ResourceType.INFLUENCE]).toBe(25)
    expect(continuation.resolvedActions).toStrictEqual([])

    const arrival = resolveContinuation(continuation, 3, rng)
    expect(arrival.planets[target.id]?.ownerPlayerId).toBe(PLAYER_A)
    expect(arrival.planetOwnershipChanges).toStrictEqual([{ planetId: target.id, ownerPlayerId: PLAYER_A }])
    expect(arrival.fleets[source.id]?.strength).toBe(15)
    expect(arrival.fleets[journey.id]).toMatchObject({
      id: journey.id,
      originPlanetId: target.id,
      strength: 15,
      movement: undefined,
      destinationPlanetId: undefined,
      distanceToEnd: undefined,
    })
    expect(arrival.players[PLAYER_A]?.resources[ResourceType.INFLUENCE]).toBe(25)
    expect(arrival.fleets[journey.id]?.arrivedAtTick).toBe(10)
    expect(arrival.resolvedContinuations[0]?.actionOutcomes.at(-1)).toMatchObject({
      type: "RESOLVED",
      result: expect.stringContaining("colonized Planet"),
    })
    expect(arrival.removedFleetIds).not.toContain(journey.id)
    const emptyTurn = resolveContinuation(arrival, 4)
    expect(emptyTurn.fleets[journey.id]?.strength).toBe(15)
    expect(emptyTurn.planets[target.id]?.ownerPlayerId).toBe(PLAYER_A)
  })

  it("should resolve renamed Seed Outpost at its exact threshold and range edge with speed2 and one-time costs", () => {
    const ruleset = createRuleset(
      [SeedOutpostTest],
      [
        { id: "SEED_OUTPOST_FULL_1", actionDefinitionId: SeedOutpostTest.id },
        { id: "SEED_OUTPOST_EDGE_1", actionDefinitionId: SeedOutpostTest.id },
      ],
    )
    const origin = planet("seed-outpost-origin", PLAYER_A, 0)
    const target = planet("seed-outpost-site", null, 2.5)
    const source = fleet("seed-outpost-force", PLAYER_A, origin, 50)
    const action = createSubmittedActionStub({
      id: "SEED_OUTPOST_FULL_1",
      playerId: PLAYER_A,
      actionDefinitionId: SeedOutpostTest.id,
      selectedTargets: { force: source.id, site: target.id },
      selectedInputs: { quota: 45 },
    })
    const departure = resolve({ planets: [origin, target], fleets: [source], submissions: [action], ruleset })
    const journey = Object.values(departure.fleets).find(({ movement }) => movement !== undefined)
    Assert.isDefined(journey)

    assertDeparture({ departure, target, source, journey, ruleset })

    const edgeOrigin = planet("seed-outpost-edge-origin", PLAYER_A, 0)
    const edgeSite = planet("seed-outpost-range-edge", null, 3)
    const edgeSource = fleet("seed-outpost-edge-force", PLAYER_A, edgeOrigin, 30)
    const edgeAction = createSubmittedActionStub({
      id: "SEED_OUTPOST_EDGE_1",
      playerId: PLAYER_A,
      actionDefinitionId: SeedOutpostTest.id,
      selectedTargets: { force: edgeSource.id, site: edgeSite.id },
      selectedInputs: { quota: 30 },
    })
    const edgeDeparture = resolve({
      planets: [edgeOrigin, edgeSite],
      fleets: [edgeSource],
      submissions: [edgeAction],
      ruleset,
    })
    const edgeJourney = Object.values(edgeDeparture.fleets).find(({ movement }) => movement !== undefined)
    Assert.isDefined(edgeJourney)
    expect(edgeDeparture.planets[edgeSite.id]?.ownerPlayerId).toBeNull()
    expect(edgeDeparture.fleets[edgeSource.id]).toBeUndefined()
    expect(edgeJourney).toMatchObject({ strength: 30, distanceToEnd: 1, movement: { speed: 2, departureTurn: 1 } })
    expect(edgeDeparture.players[PLAYER_A]?.resources).toMatchObject({
      [ResourceType.INFLUENCE]: 43,
      [ResourceType.FUEL]: 98,
    })

    const edgePhaseProbeContext: TurnContext = {
      rng: createSeededRng(1234),
      turnState: createTurnStateStub({
        gameId: edgeDeparture.gameId,
        turn: 2,
        players: structuredClone(edgeDeparture.players),
        planets: structuredClone(edgeDeparture.planets),
        fleets: structuredClone(edgeDeparture.fleets),
      }),
      effectPool: new EffectPool([]),
      ruleset,
      previousJourneyFleetIds: [edgeJourney.id],
      newDepartureFleetIds: new Set(),
      removedFleetIds: new Set(),
      changedPlanetIds: new Set(),
      resolvedContinuations: [],
      pendingArrivalAssaults: [],
      pendingArrivalColonizations: [],
      fleetIdRebindings: new Map(),
    }
    Assert.isSuccess(resolveFleetMovementPhase(edgePhaseProbeContext))
    expect(edgePhaseProbeContext.turnState.fleets[edgeJourney.id]).toMatchObject({
      id: edgeJourney.id,
      originPlanetId: edgeSite.id,
      strength: 30,
      destinationPlanetId: undefined,
      distanceToEnd: undefined,
      movement: undefined,
      arrivedAtTick: 10,
    })
    expect(edgePhaseProbeContext.pendingArrivalColonizations).toMatchObject([
      { tick: 10, actualFleetId: edgeJourney.id, planetId: edgeSite.id },
    ])
    Assert.isSuccess(resolveFleetCombatPhase(edgePhaseProbeContext))
    expect(edgePhaseProbeContext.turnState.fleets[edgeJourney.id]?.strength).toBe(30)
    Assert.isSuccess(resolveColonizationPhase(edgePhaseProbeContext))
    expect(edgePhaseProbeContext.turnState.planets[edgeSite.id]?.ownerPlayerId).toBe(PLAYER_A)
    expect(edgePhaseProbeContext.turnState.fleets[edgeJourney.id]).toBeUndefined()
    expect([...edgePhaseProbeContext.removedFleetIds]).toContain(edgeJourney.id)
    expect(edgePhaseProbeContext.turnState.players[PLAYER_A]?.resources).toMatchObject({
      [ResourceType.INFLUENCE]: 43,
      [ResourceType.FUEL]: 98,
    })
    expect(edgePhaseProbeContext.resolvedContinuations[0]?.actionOutcomes.at(-1)).toMatchObject({
      type: "RESOLVED",
      result: expect.stringContaining("colonized Planet"),
    })

    const edgeArrival = resolveContinuation(edgeDeparture, 2, createSeededRng(1234), ruleset)
    expect(edgeArrival.planets[edgeSite.id]?.ownerPlayerId).toBe(PLAYER_A)
    expect(edgeArrival.fleets[edgeJourney.id]).toBeUndefined()
    expect(edgeArrival.removedFleetIds).toContain(edgeJourney.id)
    expect(edgeArrival.players[PLAYER_A]?.resources).toMatchObject({
      [ResourceType.INFLUENCE]: 43,
      [ResourceType.FUEL]: 98,
    })
  })

  it("should delete an exact20 arrival, report its removed id, and publish only the changed owner", () => {
    const origin = planet("exact-origin", PLAYER_A, 0)
    const target = planet("exact-target", null, 2)
    const source = fleet("exact-source", PLAYER_A, origin, 20)
    const action = submit({
      id: ColonizePlanetTest.id + "_1",
      playerId: PLAYER_A,
      actionDefinitionId: ColonizePlanetTest.id,
      source,
      target,
      strength: 20,
    })

    const resolved = resolve({ planets: [origin, target], fleets: [source], submissions: [action] })
    const journeyId = Object.values(resolved.fleets).find(({ movement }) => movement !== undefined)?.id
    Assert.isDefined(journeyId)
    const arrival = resolveContinuation(resolved, 2)

    expect(arrival.planets[target.id]?.ownerPlayerId).toBe(PLAYER_A)
    expect(arrival.fleets[journeyId]).toBeUndefined()
    expect(arrival.removedFleetIds).toContain(journeyId)
    expect(arrival.fleets[source.id]).toBeUndefined()
    expect(arrival.planetOwnershipChanges).toStrictEqual([{ planetId: target.id, ownerPlayerId: PLAYER_A }])
    expect(arrival.resolvedContinuations[0]?.actionOutcomes.at(-1)?.type).toBe("RESOLVED")
    const emptyTurn = resolveContinuation(arrival, 3)
    expect(emptyTurn.planets[target.id]?.ownerPlayerId).toBe(PLAYER_A)
    expect(emptyTurn.fleets[journeyId]).toBeUndefined()
    expect(emptyTurn.planetOwnershipChanges).toStrictEqual([])
  })

  it("should resolve earliest valid Colonization first and make reversed collections equivalent", () => {
    const scenario = createArrivalRace({ firstDistance: 0.2, secondDistance: 0.4 })
    const forwardRng = createSeededRng(0)
    const forwardRngBefore = forwardRng.getState()
    const forward = resolve({ ...scenario, rng: forwardRng })
    const reversedRng = createSeededRng(0)
    const reversedRngBefore = reversedRng.getState()
    const reversed = resolve({
      ...scenario,
      planets: scenario.planets.toReversed(),
      fleets: scenario.fleets.toReversed(),
      submissions: scenario.submissions.toReversed(),
      rng: reversedRng,
    })

    expect(forward.planets[scenario.target.id]?.ownerPlayerId).toBe(PLAYER_A)
    expect(fleetAtPlanetForOwner(forward, scenario.target.id, PLAYER_A)).toMatchObject({ arrivedAtTick: 4 })
    expect(fleetAtPlanetForOwner(forward, scenario.target.id, PLAYER_B)).toMatchObject({ arrivedAtTick: 8 })
    expect(forward.fleets[scenario.firstSource.id]).toBeUndefined()
    expect(forward.fleets[scenario.secondSource.id]).toBeUndefined()
    expect(
      Object.values(forward.fleets)
        .filter(({ ownerPlayerId }) => ownerPlayerId === PLAYER_A)
        .map(({ strength }) => strength),
    ).toStrictEqual([15])
    expect(
      Object.values(forward.fleets)
        .filter(({ ownerPlayerId }) => ownerPlayerId === PLAYER_B)
        .map(({ strength }) => strength),
    ).toStrictEqual([35])
    expect(outcomeFor(forward, PLAYER_A, scenario.firstAction.id).type).toBe("RESOLVED")
    expect(outcomeFor(forward, PLAYER_B, scenario.secondAction.id)).toMatchObject({
      type: "PREVENTED",
      reason: "Planet is already claimed",
    })
    expect(forwardRng.getState()).toStrictEqual(forwardRngBefore)
    expect(reversedRng.getState()).toStrictEqual(reversedRngBefore)
    expect(outcomeFor(reversed, PLAYER_A, scenario.firstAction.id)).toStrictEqual(outcomeFor(forward, PLAYER_A, scenario.firstAction.id))
    expect(outcomeFor(reversed, PLAYER_B, scenario.secondAction.id)).toStrictEqual(outcomeFor(forward, PLAYER_B, scenario.secondAction.id))
    expect(reversed.planets).toStrictEqual(forward.planets)
    expect(reversed.fleets).toStrictEqual(forward.fleets)
    expect(reversed.players).toStrictEqual(forward.players)
    expect(reversed.planetOwnershipChanges).toStrictEqual(forward.planetOwnershipChanges)
    expect(reversed.removedFleetIds).toStrictEqual(forward.removedFleetIds)
  })

  it.each([
    { seed: 0, owner: PLAYER_B, aStrength: 35, bStrength: 15, generatorState: 1831565813 },
    { seed: 1, owner: PLAYER_A, aStrength: 15, bStrength: 35, generatorState: 1831565814 },
  ])("should shuffle only eligible same-tick contenders with seed $seed", ({ seed, owner, aStrength, bStrength, generatorState }) => {
    const scenario = createArrivalRace({ firstDistance: 0.2, secondDistance: 0.2 })
    const rng = createSeededRng(seed)
    const resolved = resolve({ ...scenario, rng })

    expect(resolved.planets[scenario.target.id]?.ownerPlayerId).toBe(owner)
    expect(fleetAtPlanetForOwner(resolved, scenario.target.id, PLAYER_A)).toMatchObject({ arrivedAtTick: 4 })
    expect(fleetAtPlanetForOwner(resolved, scenario.target.id, PLAYER_B)).toMatchObject({ arrivedAtTick: 4 })
    expect(fleetStrengthForOwner(resolved, PLAYER_A)).toBe(aStrength)
    expect(fleetStrengthForOwner(resolved, PLAYER_B)).toBe(bStrength)
    expect(rng.getState()).toStrictEqual({ generatorState, spareNormal: null })

    const reversedRng = createSeededRng(seed)
    const replayed = resolve({
      ...scenario,
      planets: scenario.planets.toReversed(),
      fleets: scenario.fleets.toReversed(),
      submissions: scenario.submissions.toReversed(),
      rng: reversedRng,
    })
    expect(replayed.planets[scenario.target.id]?.ownerPlayerId).toBe(owner)
    expect(replayed.planets).toStrictEqual(resolved.planets)
    expect(replayed.fleets).toStrictEqual(resolved.fleets)
    expect(replayed.players).toStrictEqual(resolved.players)
    expect(replayed.planetOwnershipChanges).toStrictEqual(resolved.planetOwnershipChanges)
    expect(replayed.removedFleetIds).toStrictEqual(resolved.removedFleetIds)
    expect(outcomeFor(replayed, PLAYER_A, scenario.firstAction.id)).toStrictEqual(outcomeFor(resolved, PLAYER_A, scenario.firstAction.id))
    expect(outcomeFor(replayed, PLAYER_B, scenario.secondAction.id)).toStrictEqual(outcomeFor(resolved, PLAYER_B, scenario.secondAction.id))
    expect(reversedRng.getState()).toStrictEqual(rng.getState())
  })

  it("should treat only a null Planet owner as unclaimed", () => {
    expect(isPlanetUnclaimed(null)).toBe(true)
    expect(isPlanetUnclaimed(PLAYER_A)).toBe(false)
  })
})
