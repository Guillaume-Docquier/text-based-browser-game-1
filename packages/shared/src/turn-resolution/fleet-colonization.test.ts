import { Assert, indexBy, mulberry32Prng, Rng } from "@guillaume-docquier/tools-ts"
import { describe, expect, it } from "vitest"
import { computeAvailableActions } from "#shared/action-submission/computeAvailableActions.ts"
import type { EligibilityState } from "#shared/action-submission/evaluateActionSelection.ts"
import type { PlayerId } from "#shared/domain/players/PlayerId.ts"
import { ResourceType } from "#shared/domain/resources/ResourceType.ts"
import type { createSubmittedActionStub } from "#shared/domain/turns/actions/Action.stub.ts"
import { FleetSchema, type Fleet } from "#shared/domain/world/fleets/Fleet.ts"
import { isPlanetUnclaimed } from "#shared/domain/world/planets/isPlanetUnclaimed.ts"
import type { Planet } from "#shared/domain/world/planets/Planet.ts"
import { createSeededRng } from "#shared/testing/createSeededRng.ts"
import { ColonizePlanetTest } from "#shared/testing/test-ruleset/action-definitions/colonize.ts"
import type { ResolvedTurnState } from "#shared/turn-resolution/ResolvedTurnState.ts"
import { resolveTurn } from "#shared/turn-resolution/resolveTurn.ts"
import { createTurnStateStub } from "#shared/turn-resolution/TurnState.stub.ts"
import { assertAAtP2, assertAAtP } from "./fleet-colonization.assertions-2.test-support.ts"
import { createEdgeArrivalSetup } from "./fleet-colonization.stages-2.test-support.ts"
import {
  createColonizeSetup,
  createInitialPlayersSetup,
  createDepartureSetup,
  createAColonizeJourneySetup,
  createAAtPSetup,
  createRulesetSetup,
} from "./fleet-colonization.stages.test-support.ts"
import {
  PLAYER_A,
  PLAYER_B,
  PLAYER_C,
  createArrivalRace,
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
    expect.hasAssertions()

    const createColonizeSetupPhase1Result = createColonizeSetup({})
    const { ordinaryMove, attackMove, colonizeActionId, moveActionId, attackActionId, ruleset, gameId, playerIds } =
      createColonizeSetupPhase1Result

    const createInitialPlayersSetupPhase2Result = createInitialPlayersSetup({ ...createColonizeSetupPhase1Result })
    const { p, q, aSource, cSource } = createInitialPlayersSetupPhase2Result
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

    const createDepartureSetupPhase3Result = createDepartureSetup({
      ...createColonizeSetupPhase1Result,
      ...createInitialPlayersSetupPhase2Result,
      eligibilityState,
      cAttack,
    })
    const { departure, firstRngState } = createDepartureSetupPhase3Result
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

    const createAColonizeJourneySetupPhase4Result = createAColonizeJourneySetup({
      ...createColonizeSetupPhase1Result,
      ...createInitialPlayersSetupPhase2Result,
      ...createDepartureSetupPhase3Result,
      strengthTotal,
      turnTwo,
    })
    const { aColonizeJourney, bColonizeJourney, cAttackJourney, journeyActionBindings } = createAColonizeJourneySetupPhase4Result

    const createAAtPSetupPhase5Result = createAAtPSetup({
      ...createColonizeSetupPhase1Result,
      ...createInitialPlayersSetupPhase2Result,
      ...createDepartureSetupPhase3Result,
      ...createAColonizeJourneySetupPhase4Result,
      strengthTotal,
      turnTwo,
      eligibilityState,
      afterArrival,
    })
    const { aAtP, aAtQ, bAtP } = createAAtPSetupPhase5Result

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
    const createRulesetSetupPhase6Result = createRulesetSetup({})
    const { edgeSite, edgeJourney } = createRulesetSetupPhase6Result

    const createEdgeArrivalSetupPhase7Result = createEdgeArrivalSetup({ ...createRulesetSetupPhase6Result })
    const { edgeArrival } = createEdgeArrivalSetupPhase7Result
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
