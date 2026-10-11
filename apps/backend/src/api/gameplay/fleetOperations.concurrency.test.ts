import { Assert, branded, mulberry32Prng, Rng, Result, type RngState, Time, UnitOfTime } from "@guillaume-docquier/tools-ts"
import { evaluateActionSelection } from "shared/action-submission/actionEligibility.ts"
import type { FleetId } from "shared/domain/world/fleets/FleetId.ts"
import { createFleetOperationsRuleset } from "shared/testing/FleetOperationsRuleset.stub.ts"
import { GainFuel } from "shared/testing/test-ruleset/action-definitions/gain-fuel.ts"
import { GainInfluence } from "shared/testing/test-ruleset/action-definitions/gain-influence.ts"
import { resolveTurn } from "shared/turn-resolution/resolveTurn.ts"
import { describe, expect, it } from "vitest"
import type { PlayerView } from "#api/types.ts"
import { ControlledConcurrencyTestApiServer } from "#tests/ConcurrencyTestApiServer.ts"
import { extractSuccess } from "#tests/extractSuccess.ts"
import { createFleetOperationsScenario, submitFleetOrder, authoredFleetOrderMapping } from "#tests/FleetOperationsScenario.stub.ts"
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
function replay(input: TurnToProcessModel, reverse = false): { result: ReturnType<typeof resolveTurn>; rng: RngState<number> } {
  const copy = structuredClone(input)
  const state = {
    ...copy,
    winnerPlayerId: undefined,
    submittedActions: reverse ? copy.submittedActions.toReversed() : copy.submittedActions,
    fleets: Object.fromEntries(reverse ? Object.entries(copy.fleets).toReversed() : Object.entries(copy.fleets)),
    planets: Object.fromEntries(reverse ? Object.entries(copy.planets).toReversed() : Object.entries(copy.planets)),
    players: Object.fromEntries(reverse ? Object.entries(copy.players).toReversed() : Object.entries(copy.players)),
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
type ExpectedBudget = Readonly<{ sourceId: string; allocated: number; available: number; influence: number; fuel: number }>
function assertBudget(view: PlayerView, { sourceId, allocated, available, influence, fuel }: ExpectedBudget): void {
  expect(view.fleets.find((fleet) => fleet.id === sourceId)).toMatchObject({ strength: 80, uncommittedStrength: available })
  expect(view.resources.INFLUENCE).toStrictEqual({ total: 38, uncommitted: 38 - influence })
  expect(view.resources.FUEL).toStrictEqual({ total: 6, uncommitted: 6 - fuel })
  expect(80 - available).toBe(allocated)
}

describe("Unified Fleet Operations public lifecycle", () => {
  it(
    "should fund, split, lock, roll back Combat and contested claims, retry and reuse the original Attack next turn",
    { timeout: 120000 },
    async () => {
      // Arrange: no manufactured gameplay rows and no replaced secret RNG.
      await using api = await ControlledConcurrencyTestApiServer.create()
      const fixture = await createFleetOperationsScenario({
        players: [await api.createClient(), await api.createClient()],
        clock: api.clock,
        processor: api.processor,
        turnsRepository: api.turnsRepository,
      })
      const { right, left, before, opposing, rightHome, leftHome, rightSource, leftSource, destination, gameId } = fixture
      expect(before.turn).toBe(12)
      expect([rightHome.id, leftHome.id, destination.id]).toStrictEqual([
        "d40c7e39-481b-51ca-a0de-156e3881fffc",
        "8ad435bf-768f-5f69-98b6-4313bb12654a",
        "18f11e3d-625a-5a0e-84d3-bd8b6d139b1a",
      ])
      expect(rightSource.strength).toBe(80)
      expect(leftSource.strength).toBe(60)
      expect(stockpiles(before)).toStrictEqual([38, 2, 6, 0, 0])
      expect(stockpiles(opposing)).toStrictEqual([45, 1, 1, 0, 0])
      expect(fixture.checkpoints.map((view) => [view.turn, ...stockpiles(view).slice(0, 3)])).toStrictEqual([
        [2, 7, 7, 1],
        [7, 22, 2, 1],
        [8, 25, 1, 1],
        [9, 27, 5, 1],
        [10, 30, 4, 1],
        [11, 33, 2, 6],
        [12, 38, 2, 6],
      ])
      const order = async (id: string, amount: number, target = leftHome.id, source = rightSource.id): Promise<void> => {
        await submitFleetOrder({ side: right, actionId: id, source, destination: target, amount })
      }
      for (const target of [destination.id, leftHome.id, rightHome.id]) {
        await expect(order("MOVE_FLEET_STANDARD_1", 1, target)).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } })
        expect(await right.view()).toStrictEqual(before)
      }
      for (const amount of [0, 1.5]) {
        await expect(order("ATTACK_MOVE_STANDARD_1", amount)).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } })
        expect(await right.view()).toStrictEqual(before)
      }
      for (const source of [leftSource.id, "missing-source"]) {
        await expect(order("ATTACK_MOVE_STANDARD_1", 1, leftHome.id, branded<FleetId>(source))).rejects.toMatchObject({
          data: { code: "BAD_REQUEST" },
        })
        expect(await right.view()).toStrictEqual(before)
      }
      await expect(order("COLONIZE_PLANET_STANDARD_1", 35, leftHome.id)).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } })
      await order("COLONIZE_PLANET_STANDARD_1", 35, destination.id)
      await order("ATTACK_MOVE_STANDARD_1", 30)
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
      assertBudget(await right.view(), { sourceId: rightSource.id, allocated: 70, available: 10, influence: 33, fuel: 6 })
      await order("ATTACK_MOVE_STANDARD_1", 40)
      assertBudget(await right.view(), { sourceId: rightSource.id, allocated: 80, available: 0, influence: 33, fuel: 6 })
      const forty = await right.view()
      await expect(order("ATTACK_MOVE_STANDARD_1", 41)).rejects.toMatchObject({
        data: { code: "BAD_REQUEST" },
        message: expect.stringContaining("1"),
      })
      expect(await right.view()).toStrictEqual(forty)
      await order("ATTACK_MOVE_STANDARD_1", 30)
      await right.cancel("ATTACK_MOVE_STANDARD_1")
      assertBudget(await right.view(), { sourceId: rightSource.id, allocated: 40, available: 40, influence: 28, fuel: 5 })
      await order("ATTACK_MOVE_STANDARD_1", 30)
      assertBudget(await right.view(), { sourceId: rightSource.id, allocated: 70, available: 10, influence: 33, fuel: 6 })
      const leftOrders = await left.view()
      expect(leftOrders.fleets.find((fleet) => fleet.id === leftSource.id)?.uncommittedStrength).toBe(25)
      expect(leftOrders.resources.INFLUENCE).toStrictEqual({ total: 45, uncommitted: 20 })
      // Act: immutable actual departure input; invalid complete sets fail before payment.
      const departure = await capture(api),
        immutableDeparture = structuredClone(departure)
      const valid = replay(departure)
      expect(replay(departure, true)).toStrictEqual(valid)
      expect(replay(departure)).toStrictEqual(valid)
      for (const invalid of [
        { selectedTargets: { fleet: rightSource.id, planet: leftHome.id }, selectedInputs: { strength: 41 } },
        { selectedTargets: { fleet: leftSource.id, planet: leftHome.id }, selectedInputs: { strength: 30 } },
        { selectedTargets: { fleet: rightSource.id, planet: rightHome.id }, selectedInputs: { strength: 30 } },
        { selectedTargets: { fleet: rightSource.id, planet: leftHome.id }, selectedInputs: { strength: 0 } },
        { selectedTargets: { fleet: rightSource.id, planet: leftHome.id }, selectedInputs: { strength: 1.5 } },
      ]) {
        const invalidInput = structuredClone(departure)
        const action = invalidInput.submittedActions
          .filter((action) => action.playerId === before.player.id)
          .find((action) => action.id === "ATTACK_MOVE_STANDARD_1")
        Assert.isDefined(action)
        Reflect.set(action, "selectedTargets", invalid.selectedTargets)
        Reflect.set(action, "selectedInputs", invalid.selectedInputs)
        const unchanged = structuredClone(invalidInput)
        const rng = Rng.fromState(invalidInput.rngState, mulberry32Prng)
        expect(resolveTurn({ ...invalidInput, winnerPlayerId: undefined }, invalidInput.ruleset, rng)).toMatchObject({
          type: "Failure",
          error: { type: "INVALID_SUBMISSIONS" },
        })
        expect(invalidInput).toStrictEqual(unchanged)
        expect(rng.getState()).toStrictEqual(invalidInput.rngState)
      }
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
      for (const id of ["COLONIZE_PLANET_STANDARD_1", "ATTACK_MOVE_STANDARD_1", "MOVE_FLEET_EXCEPTIONAL_1"]) {
        expect(departed.actions.find((action) => action.id === id)?.status).toBe("IN_PROGRESS")
        await expect(right.cancel(id)).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } })
        await expect(order(id, 1)).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } })
        await expect(
          right.player.client.gameplay.updateActionSubmission.mutate({
            gameId,
            turn: 12,
            submittedActionTargets: { actionId: id, selectedTargets: null, selectedInputs: null },
          }),
        ).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } })
      }
      for (const id of ["COLONIZE_PLANET_STANDARD_2", "ATTACK_MOVE_STANDARD_2"])
        expect(departed.actions.find((action) => action.id === id)?.status).toBe("AVAILABLE")
      const moving = journeys.find((fleet) => fleet.ownerPlayerId === before.player.id)
      Assert.isDefined(moving)
      await expect(order("ATTACK_MOVE_STANDARD_2", 1, leftHome.id, moving.id)).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } })
      expect(await right.view()).toStrictEqual(departed)
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
      expect(replay(arrival, true)).toStrictEqual(arrivedReplay)
      expect(replay(arrival)).toStrictEqual(arrivedReplay)
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
      const owner = combined.galaxy.systems
        .flatMap((system) => system.planets)
        .find((planet) => planet.id === destination.id)?.ownerPlayerId
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
      expect(
        committed.fleets.map((fleet) => [fleet.id, fleet.strength]).toSorted((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
      ).toStrictEqual(
        Object.values(extractSuccess(arrivedReplay.result).fleets)
          .map((fleet) => [fleet.id, fleet.strength])
          .toSorted((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
      )
      // Act: reuse the exact released original in immediately collecting T14.
      await order("ATTACK_MOVE_STANDARD_1", 1)
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
        finalSaved.fleets.every((fleet) =>
          [fleet.movement, fleet.destinationPlanetId, fleet.distanceToEnd].every((field) => field === null),
        ),
      ).toBe(true)
      for (const id of ["ATTACK_MOVE_STANDARD_1", "MOVE_FLEET_EXCEPTIONAL_1", "COLONIZE_PLANET_STANDARD_1"])
        expect(final.actions.find((action) => action.id === id)).toMatchObject({ status: "AVAILABLE" })
      expect(await reloaded.processNextDueTurn()).toBe("idle")
      expect(await (await api.recreateProcessor()).processNextDueTurn()).toBe("idle")
      expect(await api.observeWorkerPersistence(gameId)).toStrictEqual(finalSaved)
      expect(await right.view()).toStrictEqual(final)
      expect(departure).toStrictEqual(immutableDeparture)
      expect(arrival).toStrictEqual(immutableArrival)
    },
  )

  it(
    "should use pregame renamed25/speed9/range18/cost24 and two separately budgeted same-definition Attacks",
    { timeout: 120000 },
    async () => {
      // Arrange
      const ruleset = createFleetOperationsRuleset(),
        shorter = createFleetOperationsRuleset(17)
      await using api = await ControlledConcurrencyTestApiServer.create([ruleset, shorter])
      const { right, left, before, opposing, rightSource, leftSource, leftHome, destination, gameId } = await createFleetOperationsScenario(
        {
          players: [await api.createClient(), await api.createClient()],
          clock: api.clock,
          processor: api.processor,
          turnsRepository: api.turnsRepository,
          rulesetId: ruleset.id,
        },
      )
      const routes = new Map([
        ["EXPAND_1", destination.id],
        ["ENGAGE_1", leftHome.id],
        ["ENGAGE_2", leftHome.id],
      ])
      const order = async (id: string, amount: number): Promise<void> => {
        const target = routes.get(id)
        Assert.isDefined(target)
        await submitFleetOrder({
          side: right,
          actionId: id,
          source: rightSource.id,
          destination: target,
          amount,
          mapping: authoredFleetOrderMapping,
        })
      }
      expect(before.ruleset).toStrictEqual(ruleset)
      await expect(order("EXPAND_1", 24)).rejects.toMatchObject({ data: { code: "BAD_REQUEST" }, message: expect.stringContaining("25") })
      await order("EXPAND_1", 25)
      await order("EXPAND_1", 35)
      await order("ENGAGE_1", 30)
      await order("ENGAGE_2", 10)
      await submitFleetOrder({
        side: right,
        actionId: "MOVE_FLEET_EXCEPTIONAL_1",
        source: rightSource.id,
        destination: leftHome.id,
        amount: 5,
      })
      assertBudget(await right.view(), { sourceId: rightSource.id, allocated: 80, available: 0, influence: 35, fuel: 5 })
      expect(
        (await right.view()).actions.filter((action) => action.actionDefinitionId === "ENGAGE").map((action) => [action.id, action.status]),
      ).toStrictEqual([
        ["ENGAGE_1", "SUBMITTED"],
        ["ENGAGE_2", "SUBMITTED"],
      ])
      const eighty = await right.view()
      await expect(order("ENGAGE_2", 11)).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } })
      expect(await right.view()).toStrictEqual(eighty)
      await order("ENGAGE_1", 25)
      assertBudget(await right.view(), { sourceId: rightSource.id, allocated: 75, available: 5, influence: 35, fuel: 5 })
      await order("ENGAGE_1", 30)
      assertBudget(await right.view(), { sourceId: rightSource.id, allocated: 80, available: 0, influence: 35, fuel: 5 })
      await right.cancel("ENGAGE_2")
      assertBudget(await right.view(), { sourceId: rightSource.id, allocated: 70, available: 10, influence: 31, fuel: 5 })
      await order("ENGAGE_2", 10)
      await submitFleetOrder({
        side: left,
        actionId: "EXPAND_1",
        source: leftSource.id,
        destination: destination.id,
        amount: 35,
        mapping: authoredFleetOrderMapping,
      })
      // Act: public valid bindings provide resolver controls with changed content.
      const departure = await capture(api),
        immutableDeparture = structuredClone(departure),
        valid = replay(departure)
      expect(replay(departure, true)).toStrictEqual(valid)
      for (const action of departure.submittedActions
        .filter((action) => action.playerId === before.player.id)
        .filter((action) => ["ENGAGE_1", "EXPAND_1"].includes(action.id))) {
        const evaluation = evaluateActionSelection({ state: departure, ruleset: shorter, action, selection: action, mode: "complete" })
        expect(evaluation.eligible).toBe(false)
        expect(evaluation.issues).toContainEqual(expect.objectContaining({ path: ["selectedTargets", "world"], status: "invalid" }))
      }
      const invalid = structuredClone(departure),
        expand = invalid.submittedActions
          .filter((action) => action.playerId === before.player.id)
          .find((action) => action.id === "EXPAND_1")
      Assert.isDefined(expand)
      Reflect.set(expand, "selectedInputs", { force: 24 })
      const priorWorking = structuredClone({ ...invalid, winnerPlayerId: undefined })
      const working = { ...invalid, winnerPlayerId: undefined }
      const invalidRng = Rng.fromState(invalid.rngState, mulberry32Prng)
      expect(resolveTurn(working, invalid.ruleset, invalidRng)).toMatchObject({ type: "Failure", error: { type: "INVALID_SUBMISSIONS" } })
      expect(working).toStrictEqual(priorWorking)
      expect(invalidRng.getState()).toStrictEqual(invalid.rngState)
      for (const [id, amount] of [
        ["ENGAGE_2", 11],
        ["EXPAND_1", 24],
      ] as const) {
        const working = { ...structuredClone(departure), winnerPlayerId: undefined }
        const action = working.submittedActions.filter((action) => action.playerId === before.player.id).find((action) => action.id === id)
        Assert.isDefined(action)
        Reflect.set(action, "selectedInputs", { force: amount })
        const unchanged = structuredClone(working)
        const rng = Rng.fromState(departure.rngState, mulberry32Prng)
        expect(resolveTurn(working, working.ruleset, rng)).toStrictEqual(
          Result.Failure(expect.objectContaining({ type: "INVALID_SUBMISSIONS" })),
        )
        expect(working).toStrictEqual(unchanged)
        expect(rng.getState()).toStrictEqual(departure.rngState)
      }
      expect(await api.processor.processNextDueTurn()).toBe("processed")
      assertSavedReplay(await api.observeWorkerPersistence(gameId), valid)
      expect(departure).toStrictEqual(immutableDeparture)
      // Assert
      const departed = await right.view()
      expect(departed.fleets.find((fleet) => fleet.id === rightSource.id)).toBeUndefined()
      expect(stockpiles(departed)).toStrictEqual([3, 2, 1, 0, 0])
      expect(stockpiles(await left.view())).toStrictEqual([21, 1, 1, 0, 0])
      expect(
        departed.fleets
          .filter((fleet) => fleet.ownerPlayerId === before.player.id)
          .map((fleet) => [fleet.movement?.submittedAction.id, fleet.strength, fleet.distanceToEnd])
          .toSorted((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
      ).toStrictEqual(
        [
          ["ENGAGE_1", 30, 7.080338258080797],
          ["ENGAGE_2", 10, 7.080338258080797],
          ["EXPAND_1", 35, 8.77754335587613],
          ["MOVE_FLEET_EXCEPTIONAL_1", 5, 12.080338258080797],
        ].toSorted((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
      )
      const arrival = await capture(api),
        immutableArrival = structuredClone(arrival),
        expected = replay(arrival)
      expect(replay(arrival, true)).toStrictEqual(expected)
      expect(await (await api.recreateProcessor()).processNextDueTurn()).toBe("processed")
      const combined = await right.view(),
        saved = await api.observeWorkerPersistence(gameId)
      assertSavedReplay(saved, expected)
      expect(arrival).toStrictEqual(immutableArrival)
      expect(stockpiles(combined)).toStrictEqual([3, 2, 1, 0, 0])
      expect(stockpiles(await left.view())).toStrictEqual([21, 1, 1, 0, 0])
      expect(
        combined.fleets.filter((fleet) => fleet.originPlanetId === leftHome.id).find((fleet) => fleet.movement === undefined),
      ).toMatchObject({
        ownerPlayerId: before.player.id,
        strength: 15,
      })
      expect(combined.fleets.find((fleet) => fleet.id === leftSource.id)).toBeUndefined()
      const owner = combined.galaxy.systems
        .flatMap((system) => system.planets)
        .find((planet) => planet.id === destination.id)?.ownerPlayerId
      expect([before.player.id, opposing.player.id]).toContain(owner)
      expect(
        combined.fleets
          .filter((fleet) => fleet.originPlanetId === destination.id)
          .map((fleet) => [fleet.ownerPlayerId === owner, fleet.strength])
          .toSorted((a, b) => Number(a[0]) - Number(b[0])),
      ).toStrictEqual([
        [false, 35],
        [true, 10],
      ])
      expect(combined.fleets.reduce((total, fleet) => total + fleet.strength, 0)).toBe(65)
      expect(combined.fleets.find((fleet) => fleet.movement !== undefined)).toMatchObject({ strength: 5, distanceToEnd: 7.080338258080797 })
      expect(saved.turns.find((turn) => turn.turn === 14)).toMatchObject({
        rngGeneratorState: expected.rng.generatorState,
        rngSpareNormal: expected.rng.spareNormal,
      })
      expect(
        saved.fleets.map((fleet) => [fleet.id, fleet.strength]).toSorted((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
      ).toStrictEqual(
        Object.values(extractSuccess(expected.result).fleets)
          .map((fleet) => [fleet.id, fleet.strength])
          .toSorted((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
      )
    },
  )
})

describe("Pregame range variant", () => {
  it("should reject both long routes in a separately authored persisted range17 game before payment", { timeout: 120000 }, async () => {
    // Arrange
    const ruleset = createFleetOperationsRuleset(17)
    await using api = await ControlledConcurrencyTestApiServer.create([ruleset])
    const { right, before, rightSource, leftHome, destination } = await createFleetOperationsScenario({
      players: [await api.createClient(), await api.createClient()],
      clock: api.clock,
      processor: api.processor,
      turnsRepository: api.turnsRepository,
      rulesetId: ruleset.id,
    })
    // Act & Assert
    for (const [id, planet, amount] of [
      ["ENGAGE_1", leftHome.id, 30],
      ["ENGAGE_1", destination.id, 30],
      ["EXPAND_1", destination.id, 35],
    ] as const) {
      await expect(
        submitFleetOrder({
          side: right,
          actionId: id,
          source: rightSource.id,
          destination: planet,
          amount,
          mapping: authoredFleetOrderMapping,
        }),
      ).rejects.toMatchObject({
        data: { code: "BAD_REQUEST" },
      })
      expect(await right.view()).toStrictEqual(before)
    }
    const input = await capture(api),
      players = structuredClone(input.players)
    const validAction = input.ruleset.actionPool.find((action) => action.id === "ENGAGE_1")
    Assert.isDefined(validAction)
    const invalid = {
      ...validAction,
      playerId: before.player.id,
      selectedTargets: { craft: rightSource.id, world: leftHome.id },
      selectedInputs: { force: 30 },
    }
    const controlled = { ...structuredClone(input), winnerPlayerId: undefined, submittedActions: [invalid] }
    const rng = Rng.fromState(input.rngState, mulberry32Prng)
    expect(resolveTurn(controlled, input.ruleset, rng)).toMatchObject({ type: "Failure", error: { type: "INVALID_SUBMISSIONS" } })
    expect(controlled.players).toStrictEqual(players)
  })
})
