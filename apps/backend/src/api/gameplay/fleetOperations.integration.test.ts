import { Assert, Time, UnitOfTime } from "@guillaume-docquier/tools-ts"
import { createFleetOperationsRuleset } from "shared/testing/FleetOperationsRuleset.stub.ts"
import { expect } from "vitest"
import { createApiStub } from "#api/createApi.stub.ts"
import { ControlledClock } from "#lib/ControlledClock.ts"
import { RulesetsRepository } from "#lib/rulesets/rulesets.repository.ts"
import { ApiServer } from "#tests/ApiServer.ts"
import { createFleetOperationsScenario, submitFleetOrder, authoredFleetOrderMapping } from "#tests/FleetOperationsScenario.stub.ts"
import { integrationTest } from "#tests/vitest.integration.fixture.ts"
import { createTurnProcessorStub } from "#turn-processing/TurnProcessor.stub.ts"

integrationTest(
  "persists renamed fleet bindings and budgets two instances of the same Attack definition",
  { timeout: 60000 },
  async ({ db }) => {
    // Arrange: authored content is persisted before the game exists.
    const clock = new ControlledClock()
    const services = await createApiStub({ db, clock })
    const ruleset = createFleetOperationsRuleset()
    Assert.isSuccess(await new RulesetsRepository({ db, logger: services.logger }).upsertRuleset(ruleset))
    using api = new ApiServer(services)
    const { turnProcessor: processor, turnsRepository } = await createTurnProcessorStub({ db, clock })
    const { right, left, before, rightSource, leftSource, leftHome, destination } = await createFleetOperationsScenario({
      players: [await api.createClient({ authenticated: true }), await api.createClient({ authenticated: true })],
      clock,
      processor,
      turnsRepository,
      rulesetId: ruleset.id,
    })
    const colonize = {
      side: right,
      actionId: "EXPAND_1",
      source: rightSource.id,
      destination: destination.id,
      mapping: authoredFleetOrderMapping,
    }
    const firstAttack = {
      side: right,
      actionId: "ENGAGE_1",
      source: rightSource.id,
      destination: leftHome.id,
      mapping: authoredFleetOrderMapping,
    }
    const secondAttack = { ...firstAttack, actionId: "ENGAGE_2" }

    // Act: each instance reserves its own allocation and resource cost.
    await expect(submitFleetOrder({ ...colonize, amount: 24 })).rejects.toMatchObject({
      data: { code: "BAD_REQUEST" },
      message: expect.stringContaining("25"),
    })
    await submitFleetOrder({ ...colonize, amount: 35 })
    await submitFleetOrder({ ...firstAttack, amount: 30 })
    await submitFleetOrder({ ...secondAttack, amount: 10 })
    await submitFleetOrder({
      side: right,
      actionId: "MOVE_FLEET_EXCEPTIONAL_1",
      source: rightSource.id,
      destination: leftHome.id,
      amount: 5,
    })
    const full = await right.view()
    await expect(submitFleetOrder({ ...secondAttack, amount: 11 })).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } })
    expect(await right.view()).toStrictEqual(full)
    await submitFleetOrder({ ...firstAttack, amount: 25 })
    const replaced = await right.view()
    await right.cancel("ENGAGE_2")
    const cancelled = await right.view()
    await submitFleetOrder({ ...firstAttack, amount: 30 })
    await submitFleetOrder({ ...secondAttack, amount: 10 })
    await submitFleetOrder({
      side: left,
      actionId: "EXPAND_1",
      source: leftSource.id,
      destination: destination.id,
      amount: 35,
      mapping: authoredFleetOrderMapping,
    })
    expect(await right.endTurn()).toBe("processed")
    const departed = await right.view()
    const reloaded = (await createTurnProcessorStub({ db, clock })).turnProcessor
    // The next turn uses a new worker reading the saved movement and definition bindings.
    clock.increment({ time: Time.create(10, UnitOfTime.SECONDS) })
    await turnsRepository.markDueTurnsAwaitingProcessing({ since: clock.now() })
    expect(await reloaded.processNextDueTurn()).toBe("processed")
    const arrived = await right.view()

    // Assert
    expect(before.ruleset).toStrictEqual(ruleset)
    expect(full.fleets.find((fleet) => fleet.id === rightSource.id)?.uncommittedStrength).toBe(0)
    expect(full.resources.INFLUENCE).toStrictEqual({ total: 38, uncommitted: 3 })
    expect(
      full.actions.filter((action) => action.actionDefinitionId === "ENGAGE").map((action) => [action.id, action.status]),
    ).toStrictEqual([
      ["ENGAGE_1", "SUBMITTED"],
      ["ENGAGE_2", "SUBMITTED"],
    ])
    expect(replaced.fleets.find((fleet) => fleet.id === rightSource.id)?.uncommittedStrength).toBe(5)
    expect(cancelled.fleets.find((fleet) => fleet.id === rightSource.id)?.uncommittedStrength).toBe(15)
    expect(cancelled.resources.INFLUENCE).toStrictEqual({ total: 38, uncommitted: 7 })
    expect(cancelled.actions.find((action) => action.id === "ENGAGE_1")?.selectedInputs).toStrictEqual({ force: 25 })
    expect(cancelled.actions.find((action) => action.id === "ENGAGE_2")?.status).toBe("AVAILABLE")
    expect(departed.fleets.find((fleet) => fleet.id === rightSource.id)).toBeUndefined()
    expect(departed.resources).toMatchObject({ INFLUENCE: { total: 3 }, FUEL: { total: 1 } })
    expect(
      departed.fleets
        .filter((fleet) => fleet.ownerPlayerId === before.player.id)
        .map((fleet) => [fleet.movement?.submittedAction.id, fleet.strength, fleet.distanceToEnd])
        .toSorted((a, b) => String(a[0]).localeCompare(String(b[0]))),
    ).toStrictEqual([
      ["ENGAGE_1", 30, 7.080338258080797],
      ["ENGAGE_2", 10, 7.080338258080797],
      ["EXPAND_1", 35, 8.77754335587613],
      ["MOVE_FLEET_EXCEPTIONAL_1", 5, 12.080338258080797],
    ])
    expect(
      arrived.fleets.find(
        (fleet) => fleet.ownerPlayerId === before.player.id && fleet.originPlanetId === leftHome.id && fleet.movement === undefined,
      )?.strength,
    ).toBe(15)
    expect(arrived.fleets.find((fleet) => fleet.id === leftSource.id)).toBeUndefined()
    const opposing = await left.view()
    const owner = arrived.galaxy.systems.flatMap((system) => system.planets).find((planet) => planet.id === destination.id)?.ownerPlayerId
    expect([before.player.id, opposing.player.id]).toContain(owner)
    expect(
      arrived.fleets
        .filter((fleet) => fleet.originPlanetId === destination.id)
        .map((fleet) => [fleet.ownerPlayerId === owner, fleet.strength])
        .toSorted((a, b) => Number(a[0]) - Number(b[0])),
    ).toStrictEqual([
      [false, 35],
      [true, 10],
    ])
    expect(opposing.resources).toMatchObject({ INFLUENCE: { total: 21 }, FUEL: { total: 1 } })
    expect(
      arrived.actions.filter((action) => action.actionDefinitionId === "ENGAGE").map((action) => [action.id, action.status]),
    ).toStrictEqual([
      ["ENGAGE_1", "AVAILABLE"],
      ["ENGAGE_2", "AVAILABLE"],
    ])
    expect(arrived.resources).toStrictEqual(departed.resources)
  },
)

integrationTest("rejects routes beyond the persisted authored range before reserving or paying", { timeout: 60000 }, async ({ db }) => {
  // Arrange
  const clock = new ControlledClock()
  const services = await createApiStub({ db, clock })
  const ruleset = createFleetOperationsRuleset(17)
  Assert.isSuccess(await new RulesetsRepository({ db, logger: services.logger }).upsertRuleset(ruleset))
  using api = new ApiServer(services)
  const { turnProcessor: processor, turnsRepository } = await createTurnProcessorStub({ db, clock })
  const { right, before, rightSource, leftHome, destination } = await createFleetOperationsScenario({
    players: [await api.createClient({ authenticated: true }), await api.createClient({ authenticated: true })],
    clock,
    processor,
    turnsRepository,
    rulesetId: ruleset.id,
  })
  // Act & Assert
  for (const [actionId, planet, amount] of [
    ["ENGAGE_1", leftHome.id, 30],
    ["ENGAGE_1", destination.id, 30],
    ["EXPAND_1", destination.id, 35],
  ] as const) {
    await expect(
      submitFleetOrder({ side: right, actionId, source: rightSource.id, destination: planet, amount, mapping: authoredFleetOrderMapping }),
    ).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } })
    expect(await right.view()).toStrictEqual(before)
  }
})
