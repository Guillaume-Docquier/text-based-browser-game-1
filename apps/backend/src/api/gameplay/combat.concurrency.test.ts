import { Assert, Result, Time, UnitOfTime } from "@guillaume-docquier/tools-ts"
import { AttackMoveStandard } from "shared/testing/test-ruleset/action-definitions/attack-move.ts"
import { describe, expect, it } from "vitest"
import { createCombatActionsScenario } from "#tests/CombatActionsScenario.stub.ts"
import { ControlledConcurrencyTestApiServer } from "#tests/ConcurrencyTestApiServer.ts"
import { FleetActionsScenario } from "#tests/FleetActionsScenario.stub.ts"

function expectRejectedRequests(results: ReadonlyArray<PromiseSettledResult<unknown>>): void {
  for (const rejected of results.filter((result) => result.status === "rejected"))
    expect(rejected.reason).toMatchObject({ data: { code: "BAD_REQUEST" } })
}

describe("public Assault PostgreSQL", () => {
  it("should roll back real departure and arrival save writes and retry once", { timeout: 120000 }, async () => {
    // Arrange: router-generated map, normal funding and builds; only the worker DB transport is instrumented.
    await using api = await ControlledConcurrencyTestApiServer.create()
    const fixture = await createCombatActionsScenario({
      players: [await api.createClient(), await api.createClient()],
      clock: api.clock,
      processor: api.processor,
      turnsRepository: api.turnsRepository,
    })
    const { attacker, defender, gameId } = fixture
    const before = await attacker.view()
    const destination = before.galaxy.systems.flatMap((system) => system.planets).find((planet) => planet.coordinates === "44:96:25")
    Assert.isDefined(destination)
    await attacker.move("ATTACK_MOVE_STANDARD_1", 30, destination.id)
    const submitted = await attacker.view()
    const defenderBefore = await defender.view()
    const { processor, fault } = await api.createSaveFailureProcessor()

    // Act & Assert: claim commits normally; abort only after all awaited production save statements finish.
    api.clock.increment({ time: Time.create(10, UnitOfTime.SECONDS) })
    await api.turnsRepository.markDueTurnsAwaitingProcessing({ since: api.clock.now() })
    fault.armNextSave()
    expect(await processor.processNextDueTurn()).toBe("failed")
    expect(fault.completedSaveCallbacks).toBe(1)
    expect(fault.failures).toBe(1)
    expect(await attacker.view()).toStrictEqual({ ...submitted, turnStatus: "PROCESSING" })
    expect(await defender.view()).toStrictEqual({ ...defenderBefore, turnStatus: "PROCESSING" })
    expect(await api.turnsRepository.resetProcessingAttempt({ gameId, turn: 6 })).toStrictEqual(Result.Success({ reset: true }))
    expect(await processor.processNextDueTurn()).toBe("processed")
    const departed = await attacker.view()
    const defenderDeparted = await defender.view()
    expect(departed.turn).toBe(7)
    expect(departed.resources).toMatchObject({ INFLUENCE: { total: 14 }, METAL: { total: 3 }, FUEL: { total: 0 } })
    expect(departed.fleets.map((fleet) => fleet.strength).toSorted((a, b) => a - b)).toStrictEqual([10, 20, 30])
    expect(departed.fleets.find((fleet) => fleet.movement !== undefined)).toMatchObject({
      distanceToEnd: 7.080338258080797,
      movement: { initiatingTurn: 6, pendingArrivalEffects: [{ type: "ASSAULT", effectIndex: 1 }] },
    })
    expect(departed.actions.find((action) => action.id === "ATTACK_MOVE_STANDARD_1")?.status).toBe("IN_PROGRESS")
    expect(await processor.processNextDueTurn()).toBe("idle")
    expect(await attacker.view()).toStrictEqual(departed)

    api.clock.increment({ time: Time.create(10, UnitOfTime.SECONDS) })
    await api.turnsRepository.markDueTurnsAwaitingProcessing({ since: api.clock.now() })
    fault.armNextSave()
    expect(await processor.processNextDueTurn()).toBe("failed")
    expect(fault.completedSaveCallbacks).toBe(3)
    expect(fault.failures).toBe(2)
    expect(await attacker.view()).toStrictEqual({ ...departed, turnStatus: "PROCESSING" })
    expect(await defender.view()).toStrictEqual({ ...defenderDeparted, turnStatus: "PROCESSING" })
    expect(await api.turnsRepository.resetProcessingAttempt({ gameId, turn: 7 })).toStrictEqual(Result.Success({ reset: true }))
    expect(await processor.processNextDueTurn()).toBe("processed")
    const arrived = await attacker.view()
    expect(arrived.turn).toBe(8)
    expect(arrived.resources).toStrictEqual(departed.resources)
    expect(
      arrived.fleets.map((fleet) => [fleet.ownerPlayerId, fleet.strength, fleet.movement, fleet.destinationPlanetId, fleet.distanceToEnd]),
    ).toStrictEqual([
      [before.player.id, 10, undefined, undefined, undefined],
      [before.player.id, 10, undefined, undefined, undefined],
    ])
    expect(arrived.actions.find((action) => action.id === "ATTACK_MOVE_STANDARD_1")?.status).toBe("AVAILABLE")
    expect((await defender.view()).resources).toStrictEqual(defenderBefore.resources)
    expect(fault.completedSaveCallbacks).toBe(4)
    expect(fault.failures).toBe(2)
    expect(await processor.processNextDueTurn()).toBe("idle")
    expect(await attacker.view()).toStrictEqual(arrived)
  })

  it("should round trips pending Assault and explicit null/deletion with real PostgreSQL", { timeout: 120000 }, async () => {
    // Arrange
    await using api = await ControlledConcurrencyTestApiServer.create()
    const { clock, processor, turnsRepository } = api
    const fixture = await createCombatActionsScenario({
      players: [await api.createClient(), await api.createClient()],
      clock,
      processor,
      turnsRepository,
    })
    const { attacker, defender } = fixture
    const before = await attacker.view()
    const source = before.fleets.find((fleet) => fleet.ownerPlayerId === before.player.id)
    const destination = before.galaxy.systems.flatMap((system) => system.planets).find((planet) => planet.coordinates === "44:96:25")
    Assert.isDefined(source)
    Assert.isDefined(destination)
    const x = before.actions.find((action) => action.id === "ATTACK_MOVE_STANDARD_1")
    Assert.isDefined(x)
    // Act
    await attacker.move(x.id, 30, destination.id)
    const departureStatus = await attacker.endTurn()
    const departed = await attacker.view()
    const reload = await attacker.view()
    const reloadedProcessor = await api.recreateProcessor()
    clock.increment({ time: Time.create(10, UnitOfTime.SECONDS) })
    await turnsRepository.markDueTurnsAwaitingProcessing({ since: clock.now() })
    const arrivalStatus = await reloadedProcessor.processNextDueTurn()
    const arrived = await attacker.view()
    const defenderView = await defender.view()
    const idle = await reloadedProcessor.processNextDueTurn()
    const idleView = await attacker.view()
    // Assert
    expect(fixture.funded.resources).toMatchObject({ INFLUENCE: { total: 7 }, METAL: { total: 7 }, FUEL: { total: 1 } })
    expect(before.resources).toMatchObject({ INFLUENCE: { total: 19 }, METAL: { total: 3 }, FUEL: { total: 1 } })
    expect(before.fleets.find((fleet) => fleet.ownerPlayerId === before.player.id)?.strength).toBe(40)
    expect(before.fleets.find((fleet) => fleet.ownerPlayerId !== before.player.id)?.strength).toBe(20)
    expect(departureStatus).toBe("processed")
    expect(departed.fleets.find((fleet) => fleet.movement !== undefined)).toMatchObject({
      strength: 30,
      distanceToEnd: 7.080338258080797,
      movement: {
        speed: 10,
        initiatingTurn: 6,
        submittedAction: { id: x.id, selectedInputs: { strength: 30 } },
        pendingArrivalEffects: [{ type: "ASSAULT", effectIndex: 1 }],
      },
    })
    expect(departed.fleets.find((fleet) => fleet.id === source.id)).toMatchObject({
      id: source.id,
      strength: 10,
    })
    expect(departed.actions.find((action) => action.id === x.id)?.status).toBe("IN_PROGRESS")
    expect(departed.actions.find((action) => action.id === "ATTACK_MOVE_STANDARD_2")?.status).toBe("AVAILABLE")
    expect(reload.fleets).toStrictEqual(departed.fleets)
    expect(arrivalStatus).toBe("processed")
    expect(arrived.fleets).toHaveLength(2)
    expect(arrived.fleets.map((fleet) => fleet.strength)).toStrictEqual([10, 10])
    expect(
      arrived.fleets.map((fleet) => [fleet.ownerPlayerId, fleet.movement, fleet.destinationPlanetId, fleet.distanceToEnd]),
    ).toStrictEqual([
      [before.player.id, undefined, undefined, undefined],
      [before.player.id, undefined, undefined, undefined],
    ])
    expect(arrived.actions.find((action) => action.id === x.id)?.status).toBe("AVAILABLE")
    expect(arrived.resources).toMatchObject({ INFLUENCE: { total: 14 }, FUEL: { total: 0 } })
    expect(defenderView.resources).toMatchObject({ INFLUENCE: { total: 13 }, METAL: { total: 5 }, FUEL: { total: 1 } })
    expect(
      defenderView.galaxy.systems.flatMap((system) => system.planets).find((planet) => planet.id === destination.id)?.ownerPlayerId,
    ).toBe(defenderView.player.id)
    expect(idle).toBe("idle")
    expect(idleView).toStrictEqual(arrived)
  })

  it.each([
    [30, 30, 1, 30],
    [20, 30, 2, 50],
  ])("should serializes Attack/Move %s/%s against source50", async (attack, move, successes, committed) => {
    // Arrange
    await using api = await ControlledConcurrencyTestApiServer.create()
    const scenario = await FleetActionsScenario.create({
      player: await api.createClient(),
      clock: api.clock,
      processor: api.processor,
      turnsRepository: api.turnsRepository,
    })
    const view = await scenario.view()
    const x = view.actions.find((action) => action.actionDefinitionId === AttackMoveStandard.id)
    const [y] = await scenario.moveInstances()
    Assert.isDefined(x)
    Assert.isDefined(y)
    // Act
    const results = await Promise.allSettled([scenario.move(x.id, attack), scenario.move(y, move)])
    const reserved = await scenario.view()
    await scenario.endTurn()
    const resolved = await scenario.view()
    // Assert
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(successes)
    for (const result of results.filter((result) => result.status === "rejected"))
      expect(result.reason).toMatchObject({ data: { code: "BAD_REQUEST" }, message: expect.stringContaining("shortfall") })
    expect(reserved.fleets[0]?.uncommittedStrength).toBe(50 - committed)
    expect(resolved.fleets.reduce((sum, fleet) => sum + fleet.strength, 0)).toBe(50)
    expect(resolved.fleets.every((fleet) => fleet.strength > 0)).toBe(true)
  })

  it("should serializes Attack edit and occupied cancellation against closure and arrival", { timeout: 120000 }, async () => {
    // Arrange: public source50 and stockpiles, then a genuine multi-turn route.
    await using api = await ControlledConcurrencyTestApiServer.create()
    const scenario = await FleetActionsScenario.create({
      player: await api.createClient(),
      clock: api.clock,
      processor: api.processor,
      turnsRepository: api.turnsRepository,
    })
    const before = await scenario.view()
    const source = before.fleets[0]
    Assert.isDefined(source)
    const home = before.galaxy.systems.flatMap((system) => system.planets).find((planet) => planet.id === source.originPlanetId)
    Assert.isDefined(home)
    const destination = before.galaxy.systems
      .flatMap((system) => system.planets)
      .find((planet) => {
        const distance = Math.hypot(home.x - planet.x, home.y - planet.y)
        return [distance > 10, distance <= 20].every(Boolean)
      })
    Assert.isDefined(destination)
    const x = before.actions.find((action) => action.actionDefinitionId === AttackMoveStandard.id)
    Assert.isDefined(x)
    await scenario.move(x.id, 20, destination.id)
    // Act: original valid order always exists; only the committed preclosure edit can change it.
    const [edit, closure] = await Promise.allSettled([
      scenario.move(x.id, 25, destination.id),
      scenario.player.client.gameplay.updateReadiness.mutate({ gameId: scenario.gameId, turn: before.turn, isReady: true }),
    ])
    const closed = await scenario.view()
    const departure = await api.processor.processNextDueTurn()
    const moving = await scenario.view()
    await expect(scenario.cancel(x.id)).rejects.toMatchObject({
      data: { code: "BAD_REQUEST" },
      message: expect.stringContaining("in progress"),
    })
    await expect(scenario.move(x.id, 1, destination.id)).rejects.toMatchObject({
      data: { code: "BAD_REQUEST" },
      message: expect.stringContaining("in progress"),
    })
    api.clock.increment({ time: Time.create(10, UnitOfTime.SECONDS) })
    const oldTurnRequest = scenario.player.client.gameplay.updateActionSubmission.mutate({
      gameId: scenario.gameId,
      turn: moving.turn,
      submittedActionTargets: { actionId: x.id, selectedTargets: null, selectedInputs: null },
    })
    const processing = (async (): Promise<string> => {
      await api.turnsRepository.markDueTurnsAwaitingProcessing({ since: api.clock.now() })
      return await api.processor.processNextDueTurn()
    })()
    const [cancellation, arrival] = await Promise.allSettled([oldTurnRequest, processing])
    const arrived = await scenario.view()
    const landedAttacker = arrived.fleets.find((fleet) => fleet.originPlanetId === destination.id)
    Assert.isDefined(landedAttacker)
    await scenario.player.client.gameplay.updateActionSubmission.mutate({
      gameId: scenario.gameId,
      turn: arrived.turn,
      submittedActionTargets: {
        actionId: x.id,
        selectedTargets: { fleet: landedAttacker.id, planet: home.id },
        selectedInputs: { strength: 1 },
      },
    })
    const reused = await scenario.view()
    // Assert
    expect(closure.status).toBe("fulfilled")
    expect(closed.actions.find((action) => action.id === x.id)?.selectedInputs).toStrictEqual({
      strength: { fulfilled: 25, rejected: 20 }[edit.status],
    })
    expectRejectedRequests([edit])
    expect(departure).toBe("processed")
    expect(moving.actions.find((action) => action.id === x.id)?.status).toBe("IN_PROGRESS")
    expect(moving.fleets.find((fleet) => fleet.movement !== undefined)?.movement?.submittedAction.selectedInputs).toStrictEqual({
      strength: { fulfilled: 25, rejected: 20 }[edit.status],
    })
    expect(cancellation.status).toBe("rejected")
    expectRejectedRequests([cancellation])
    expect(arrival).toStrictEqual({ status: "fulfilled", value: "processed" })
    expect(arrived.fleets.every((fleet) => fleet.movement === undefined)).toBe(true)
    expect(arrived.actions.find((action) => action.id === x.id)?.status).toBe("AVAILABLE")
    expect(arrived.resources).toStrictEqual(moving.resources)
    expect(reused.actions.find((action) => action.id === x.id)?.status).toBe("SUBMITTED")
    expect(reused.actions.find((action) => action.id === x.id)?.selectedInputs).toStrictEqual({ strength: 1 })
  })
})
