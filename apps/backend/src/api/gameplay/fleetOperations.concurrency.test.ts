import { Assert, mulberry32Prng, Rng, Result, type RngState, Time, UnitOfTime } from "@guillaume-docquier/tools-ts"
import { GainFuel } from "shared/testing/test-ruleset/action-definitions/gain-fuel.ts"
import { GainInfluence } from "shared/testing/test-ruleset/action-definitions/gain-influence.ts"
import { resolveTurn } from "shared/turn-resolution/resolveTurn.ts"
import { describe, expect, it } from "vitest"
import type { PlayerView } from "#api/types.ts"
import { ControlledConcurrencyTestApiServer } from "#tests/ConcurrencyTestApiServer.ts"
import { extractSuccess } from "#tests/extractSuccess.ts"
import { createFleetOperationsScenario } from "#tests/FleetOperationsScenario.stub.ts"
import { submitFleetOrder } from "#tests/submitFleetOrder.ts"
import type { TurnToProcessModel } from "#turn-processing/turns.repository.ts"

function stockpiles(view: PlayerView): number[] {
  return [
    view.resources.INFLUENCE.total,
    view.resources.METAL.total,
    view.resources.FUEL.total,
    view.resources.ENERGY.total,
    view.resources.COLONY.total,
  ]
}
function replay(input: TurnToProcessModel): { result: ReturnType<typeof resolveTurn>; rng: RngState<number> } {
  const copy = structuredClone(input)
  const state = {
    ...copy,
    winnerPlayerId: undefined,
  }
  const rng = Rng.fromState(input.rngState, mulberry32Prng)
  return { result: resolveTurn(state, copy.ruleset, rng), rng: rng.getState() }
}
/** Compare every durable gameplay field; replay equality alone cannot detect a lossy worker save. */
function assertSavedReplay(
  saved: Awaited<ReturnType<ControlledConcurrencyTestApiServer["observeWorkerPersistence"]>>,
  replayed: ReturnType<typeof replay>,
): void {
  const resolved = extractSuccess(replayed.result)
  expect(saved.fleets.map(({ gameId: _gameId, ...fleet }) => fleet)).toStrictEqual(
    Object.values(resolved.fleets)
      .filter((fleet) => fleet.strength > 0)
      .map((fleet) => ({
        id: fleet.id,
        ownerPlayerId: fleet.ownerPlayerId,
        name: fleet.name,
        strength: fleet.strength,
        originPlanetId: fleet.originPlanetId,
        destinationPlanetId: fleet.destinationPlanetId ?? null,
        distanceToEnd: fleet.distanceToEnd ?? null,
        movement: fleet.movement ?? null,
      }))
      .toSorted((a, b) => a.id.localeCompare(b.id)),
  )
  expect(
    saved.resources
      .map(({ playerId, resourceType, amount }) => [playerId, resourceType, amount])
      .toSorted((a, b) => JSON.stringify(a.slice(0, 2)).localeCompare(JSON.stringify(b.slice(0, 2)))),
  ).toStrictEqual(
    Object.values(resolved.players)
      .flatMap((player) => Object.entries(player.resources).map(([type, amount]) => [player.id, type, amount]))
      .toSorted((a, b) => JSON.stringify(a.slice(0, 2)).localeCompare(JSON.stringify(b.slice(0, 2)))),
  )
  expect(saved.planets.map(({ id, ownerPlayerId }) => [id, ownerPlayerId])).toStrictEqual(
    Object.values(resolved.planets)
      .map((planet) => [planet.id, planet.ownerPlayerId])
      .toSorted((a, b) => String(a[0]).localeCompare(String(b[0]))),
  )
}
async function capture(api: ControlledConcurrencyTestApiServer): Promise<TurnToProcessModel> {
  api.clock.increment({ time: Time.create(10, UnitOfTime.SECONDS) })
  await api.turnsRepository.markDueTurnsAwaitingProcessing({ since: api.clock.now() })
  return await api.captureNextDueTurn()
}
describe("Unified Fleet Operations public lifecycle", () => {
  it("should roll back mixed arrivals, retry persisted journeys and reuse the original Attack next turn", { timeout: 120000 }, async () => {
    // Arrange: no manufactured gameplay rows and no replaced secret RNG.
    await using api = await ControlledConcurrencyTestApiServer.create()
    const fixture = await createFleetOperationsScenario({
      players: [await api.createClient(), await api.createClient()],
      clock: api.clock,
      processor: api.processor,
      turnsRepository: api.turnsRepository,
    })
    const { right, left, before, opposing, rightHome, leftHome, rightSource, leftSource, destination, gameId } = fixture
    await submitFleetOrder({
      side: right,
      actionId: "COLONIZE_PLANET_STANDARD_1",
      source: rightSource.id,
      destination: destination.id,
      amount: 35,
    })
    await submitFleetOrder({
      side: right,
      actionId: "ATTACK_MOVE_STANDARD_1",
      source: rightSource.id,
      destination: leftHome.id,
      amount: 30,
    })
    await submitFleetOrder({
      side: right,
      actionId: "MOVE_FLEET_EXCEPTIONAL_1",
      source: rightSource.id,
      destination: leftHome.id,
      amount: 5,
    })
    await submitFleetOrder({
      side: left,
      actionId: "COLONIZE_PLANET_STANDARD_1",
      source: leftSource.id,
      destination: destination.id,
      amount: 35,
    })
    // Act: resolve the captured worker input, then compare its durable save.
    const departure = await capture(api),
      immutableDeparture = structuredClone(departure)
    const valid = replay(departure)
    expect(await api.processor.processNextDueTurn()).toBe("processed")
    const departed = await right.view(),
      leftDeparted = await left.view()
    // Assert: I5-03 exact saved progress, force and payments.
    assertSavedReplay(await api.observeWorkerPersistence(gameId), valid)
    expect(departed.turn).toBe(13)
    expect(stockpiles(departed)).toStrictEqual([5, 2, 0, 0, 0])
    expect(stockpiles(leftDeparted)).toStrictEqual([20, 1, 1, 0, 0])
    expect(departed.fleets.reduce((total, fleet) => total + fleet.strength, 0)).toBe(140)
    expect(departed.fleets.find((fleet) => fleet.id === rightSource.id)).toMatchObject({ strength: 10 })
    expect(departed.fleets.find((fleet) => fleet.id === leftSource.id)).toMatchObject({ strength: 25 })
    const journeys = departed.fleets.filter((fleet) => fleet.movement !== undefined)
    expect(journeys).toHaveLength(4)
    for (const [owner, id, strength, remaining, speed, pending, originId, destinationId] of [
      [before.player.id, "COLONIZE_PLANET_STANDARD_1", 35, 7.77754335587613, 10, [[1, "COLONIZE"]], rightHome.id, destination.id],
      [before.player.id, "ATTACK_MOVE_STANDARD_1", 30, 7.080338258080797, 10, [[1, "ASSAULT"]], rightHome.id, leftHome.id],
      [before.player.id, "MOVE_FLEET_EXCEPTIONAL_1", 5, 12.080338258080797, 5, [], rightHome.id, leftHome.id],
      [opposing.player.id, "COLONIZE_PLANET_STANDARD_1", 35, 7.703963225688675, 10, [[1, "COLONIZE"]], leftHome.id, destination.id],
    ] as const) {
      const journey = journeys.filter((fleet) => fleet.ownerPlayerId === owner).find((fleet) => fleet.movement?.submittedAction.id === id)
      expect(journey).toMatchObject({
        strength,
        distanceToEnd: remaining,
        movement: { initiatingTurn: 12, speed, submittedAction: { id, selectedInputs: { strength } } },
      })
      expect(journey?.movement?.submittedAction).toStrictEqual(
        departure.submittedActions.filter((action) => action.playerId === owner).find((action) => action.id === id),
      )
      expect(journey?.originPlanetId).toBe(originId)
      expect(journey?.destinationPlanetId).toBe(destinationId)
      expect(journey?.movement?.pendingArrivalEffects?.map((effect) => [effect.effectIndex, effect.type])).toStrictEqual(pending)
    }
    await right.submitDefinition(GainInfluence.id)
    await right.submitDefinition(GainFuel.id)
    const priorPublic = await right.view(),
      priorLeft = await left.view()
    const baseline = await api.observeWorkerPersistence(gameId)
    const current = baseline.turns.find((turn) => turn.turn === 13)
    Assert.isDefined(current)
    expect(baseline.actions.filter((action) => action.turn === 13)).toHaveLength(30)
    const arrival = await capture(api),
      immutableArrival = structuredClone(arrival),
      arrivedReplay = replay(arrival)
    const outcomes = extractSuccess(arrivedReplay.result).resolvedActions.filter((action) => action.initiatingTurn === 12)
    expect(outcomes).toHaveLength(3)
    expect(
      outcomes
        .filter((action) => action.submittedAction.id === "ATTACK_MOVE_STANDARD_1")
        .map((action) => action.actionOutcomes.map((outcome) => outcome.type)),
    ).toStrictEqual([["RESOLVED"]])
    expect(
      outcomes
        .filter((action) => action.submittedAction.id === "COLONIZE_PLANET_STANDARD_1")
        .flatMap((action) => action.actionOutcomes.map((outcome) => outcome.type))
        .toSorted((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
    ).toStrictEqual(["PREVENTED", "RESOLVED"])
    const { processor: failing, fault } = await api.createSaveFailureProcessor()
    fault.armNextSave()
    expect(await failing.processNextDueTurn()).toBe("failed")
    expect(fault.failures).toBe(1)
    expect(fault.completedSaveCallbacks).toBe(1)
    const rollback = await api.observeWorkerPersistence(gameId)
    for (const field of ["planets", "fleets", "resources", "actions"] as const) expect(rollback[field]).toStrictEqual(baseline[field])
    expect(rollback.turns).toHaveLength(13)
    expect(rollback.queue).toHaveLength(13)
    expect(rollback.turns.find((turn) => turn.turn === 13)).toStrictEqual({ ...current, status: "PROCESSING", closedAt: current.endsAt })
    expect(rollback.queue.map((row) => [row.turn, row.processingEndedAt])).toStrictEqual(
      baseline.queue.map((row) => [row.turn, row.processingEndedAt]),
    )
    expect(await right.view()).toStrictEqual({ ...priorPublic, turnStatus: "PROCESSING" })
    expect(await left.view()).toStrictEqual({ ...priorLeft, turnStatus: "PROCESSING" })
    expect(await api.turnsRepository.resetProcessingAttempt({ gameId, turn: 13 })).toStrictEqual(Result.Success({ reset: true }))
    const reloaded = await api.recreateProcessor()
    expect(await reloaded.processNextDueTurn()).toBe("processed")
    const combined = await right.view(),
      leftCombined = await left.view(),
      committed = await api.observeWorkerPersistence(gameId)
    assertSavedReplay(committed, arrivedReplay)
    expect(combined.turn).toBe(14)
    expect(stockpiles(combined)).toStrictEqual([8, 0, 5, 0, 0])
    expect(stockpiles(leftCombined)).toStrictEqual([20, 1, 1, 0, 0])
    expect(combined.fleets.reduce((total, fleet) => total + fleet.strength, 0)).toBe(70)
    expect(combined.fleets.find((fleet) => fleet.id === leftSource.id)).toBeUndefined()
    const station = combined.fleets
      .filter((fleet) => fleet.ownerPlayerId === before.player.id)
      .filter((fleet) => fleet.originPlanetId === leftHome.id)
      .find((fleet) => fleet.movement === undefined)
    Assert.isDefined(station)
    expect(station.strength).toBe(5)
    const owner = combined.galaxy.systems.flatMap((system) => system.planets).find((planet) => planet.id === destination.id)?.ownerPlayerId
    expect([before.player.id, opposing.player.id]).toContain(owner)
    expect(
      combined.fleets
        .filter((fleet) => fleet.originPlanetId === destination.id)
        .map((fleet) => [fleet.ownerPlayerId === owner, fleet.strength])
        .toSorted((a, b) => Number(a[0]) - Number(b[0])),
    ).toStrictEqual([
      [false, 35],
      [true, 15],
    ])
    expect(combined.galaxy.systems.flatMap((system) => system.planets).find((planet) => planet.id === leftHome.id)?.ownerPlayerId).toBe(
      opposing.player.id,
    )
    expect(combined.fleets.find((fleet) => fleet.movement !== undefined)).toMatchObject({ strength: 5, distanceToEnd: 7.080338258080797 })
    expect(committed.actions.filter((action) => action.turn === 14)).toHaveLength(33)
    expect(committed.turns).toHaveLength(14)
    expect(committed.queue).toHaveLength(14)
    expect(committed.turns.find((turn) => turn.turn === 14)).toMatchObject({
      rngGeneratorState: arrivedReplay.rng.generatorState,
      rngSpareNormal: arrivedReplay.rng.spareNormal,
    })
    // Act: reuse the exact released original in immediately collecting T14.
    await submitFleetOrder({ side: right, actionId: "ATTACK_MOVE_STANDARD_1", source: rightSource.id, destination: leftHome.id, amount: 1 })
    expect(await right.endTurn()).toBe("processed")
    const reused = await right.view()
    expect(reused.turn).toBe(15)
    expect(stockpiles(reused)).toStrictEqual([3, 0, 4, 0, 0])
    expect(reused.fleets.find((fleet) => fleet.id === rightSource.id)?.strength).toBe(9)
    expect(reused.fleets.find((fleet) => fleet.movement?.submittedAction.id === "ATTACK_MOVE_STANDARD_1")).toMatchObject({
      strength: 1,
      distanceToEnd: 7.080338258080797,
      movement: { initiatingTurn: 14 },
    })
    expect(reused.fleets.find((fleet) => fleet.movement?.submittedAction.id === "MOVE_FLEET_EXCEPTIONAL_1")).toMatchObject({
      strength: 5,
      distanceToEnd: 2.080338258080797,
      movement: { initiatingTurn: 12 },
    })
    const finalCapture = await capture(api),
      finalReplay = replay(finalCapture),
      finalOutcomes = extractSuccess(finalReplay.result).resolvedActions
    expect(
      finalOutcomes.filter((action) => action.submittedAction.id === "ATTACK_MOVE_STANDARD_1").map((action) => action.initiatingTurn),
    ).toStrictEqual([14])
    expect(await reloaded.processNextDueTurn()).toBe("processed")
    const final = await right.view(),
      finalSaved = await api.observeWorkerPersistence(gameId)
    assertSavedReplay(finalSaved, finalReplay)
    expect(final.turn).toBe(16)
    expect(stockpiles(final)).toStrictEqual([3, 0, 4, 0, 0])
    expect(stockpiles(await left.view())).toStrictEqual([20, 1, 1, 0, 0])
    expect(final.fleets.reduce((total, fleet) => total + fleet.strength, 0)).toBe(70)
    expect(final.fleets.find((fleet) => fleet.id === rightSource.id)?.strength).toBe(9)
    expect(final.fleets.find((fleet) => fleet.id === station.id)).toMatchObject({
      name: station.name,
      strength: 11,
      originPlanetId: leftHome.id,
    })
    expect(
      finalSaved.fleets.every((fleet) => [fleet.movement, fleet.destinationPlanetId, fleet.distanceToEnd].every((field) => field === null)),
    ).toBe(true)
    for (const id of ["ATTACK_MOVE_STANDARD_1", "MOVE_FLEET_EXCEPTIONAL_1", "COLONIZE_PLANET_STANDARD_1"])
      expect(final.actions.find((action) => action.id === id)).toMatchObject({ status: "AVAILABLE" })
    expect(await reloaded.processNextDueTurn()).toBe("idle")
    expect(await (await api.recreateProcessor()).processNextDueTurn()).toBe("idle")
    expect(await api.observeWorkerPersistence(gameId)).toStrictEqual(finalSaved)
    expect(await right.view()).toStrictEqual(final)
    expect(departure).toStrictEqual(immutableDeparture)
    expect(arrival).toStrictEqual(immutableArrival)
  })
})
