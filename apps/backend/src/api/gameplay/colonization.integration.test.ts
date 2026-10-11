import { Assert, Time, UnitOfTime } from "@guillaume-docquier/tools-ts"
import { ColonizePlanetStandard } from "shared/testing/test-ruleset/action-definitions/colonize-planet.ts"
import { GainFuel } from "shared/testing/test-ruleset/action-definitions/gain-fuel.ts"
import { GainInfluence } from "shared/testing/test-ruleset/action-definitions/gain-influence.ts"
import { MoveFleetExceptional } from "shared/testing/test-ruleset/action-definitions/move-fleet.ts"
import { expect } from "vitest"
import { createApiStub } from "#api/createApi.stub.ts"
import { ControlledClock } from "#lib/ControlledClock.ts"
import { RulesetsRepository } from "#lib/rulesets/rulesets.repository.ts"
import { ApiServer } from "#tests/ApiServer.ts"
import {
  createStationaryColonizationActionsScenario,
  createColonizationActionsScenario,
  createConfiguredColonizationRuleset,
} from "#tests/ColonizationActionsScenario.stub.ts"
import { integrationTest } from "#tests/vitest.integration.fixture.ts"
import { createTurnProcessorStub } from "#turn-processing/TurnProcessor.stub.ts"

for (const strength of [20, 21, 35])
  integrationTest(`public Colonize${strength} persists owner and exact consumption after reload`, { timeout: 60000 }, async ({ db }) => {
    // Arrange: normal router funding and generated two-player seed1234 routes.
    const clock = new ControlledClock()
    using api = new ApiServer(await createApiStub({ db, clock }))
    const { turnProcessor: processor, turnsRepository } = await createTurnProcessorStub({ db, clock })
    const { attacker, defender, destination, before, funded } = await createColonizationActionsScenario({
      players: [await api.createClient({ authenticated: true }), await api.createClient({ authenticated: true })],
      clock,
      processor,
      turnsRepository,
    })
    const source = before.fleets.find((fleet) => fleet.ownerPlayerId === before.player.id)
    Assert.isDefined(source)
    await expect(attacker.move("COLONIZE_PLANET_STANDARD_1", 19, destination.id)).rejects.toMatchObject({
      data: { code: "BAD_REQUEST" },
      message: expect.stringContaining("at least 20"),
    })
    expect((await attacker.view()).fleets).toStrictEqual(before.fleets)
    // Act
    await attacker.move("COLONIZE_PLANET_STANDARD_1", strength, destination.id)
    const departedStatus = await attacker.endTurn()
    const departed = await attacker.view()
    await expect(attacker.cancel("COLONIZE_PLANET_STANDARD_1")).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } })
    const reloadedProcessor = (await createTurnProcessorStub({ db, clock })).turnProcessor
    clock.increment({ time: Time.create(10, UnitOfTime.SECONDS) })
    await turnsRepository.markDueTurnsAwaitingProcessing({ since: clock.now() })
    const arrivalStatus = await reloadedProcessor.processNextDueTurn()
    const arrived = await attacker.view()
    const opponent = await defender.view()
    const idle = await reloadedProcessor.processNextDueTurn()
    // Assert
    expect(funded.resources).toMatchObject({ INFLUENCE: { total: 7 }, METAL: { total: 7 }, FUEL: { total: 1 }, COLONY: { total: 0 } })
    expect(before.resources).toMatchObject({ INFLUENCE: { total: 29 }, METAL: { total: 3 }, FUEL: { total: 1 }, COLONY: { total: 0 } })
    expect(before.turn).toBe(8)
    expect(source.strength).toBe(40)
    expect(departedStatus).toBe("processed")
    expect(departed.fleets.find((fleet) => fleet.movement !== undefined)).toMatchObject({
      strength,
      distanceToEnd: 7.77754335587613,
      movement: { speed: 10, initiatingTurn: 8, pendingArrivalEffects: [{ type: "COLONIZE", effectIndex: 1 }] },
    })
    expect(departed.fleets.find((fleet) => fleet.id === source.id)?.strength).toBe(40 - strength)
    expect(departed.actions.find((action) => action.id === "COLONIZE_PLANET_STANDARD_1")?.status).toBe("IN_PROGRESS")
    expect(departed.actions.find((action) => action.id === "COLONIZE_PLANET_STANDARD_2")?.status).toBe("AVAILABLE")
    expect(arrivalStatus).toBe("processed")
    expect(arrived.galaxy.systems.flatMap((system) => system.planets).find((planet) => planet.id === destination.id)).toStrictEqual({
      ...destination,
      ownerPlayerId: before.player.id,
    })
    expect(opponent.galaxy).toStrictEqual(arrived.galaxy)
    const survivor = arrived.fleets.find((fleet) => fleet.ownerPlayerId === before.player.id && fleet.originPlanetId === destination.id)
    if (strength === 20) expect(survivor).toBeUndefined()
    else {
      expect(survivor?.strength).toBe(strength - 20)
      expect([survivor?.movement, survivor?.destinationPlanetId, survivor?.distanceToEnd]).toStrictEqual([undefined, undefined, undefined])
    }
    expect(arrived.resources).toMatchObject({ INFLUENCE: { total: 4 }, METAL: { total: 3 }, FUEL: { total: 1 }, COLONY: { total: 0 } })
    expect(arrived.actions.find((action) => action.id === "COLONIZE_PLANET_STANDARD_1")).toMatchObject({
      status: "AVAILABLE",
      canAffordResources: false,
    })
    expect(idle).toBe("idle")
    expect(await attacker.view()).toStrictEqual(arrived)
  })

integrationTest(
  "claimed during a saved journey prevents without combat, refund, return or extra loss",
  { timeout: 60000 },
  async ({ db }) => {
    // Arrange
    const clock = new ControlledClock()
    using api = new ApiServer(await createApiStub({ db, clock }))
    const { turnProcessor: processor, turnsRepository } = await createTurnProcessorStub({ db, clock })
    const { attacker, defender, destination, before } = await createColonizationActionsScenario({
      players: [await api.createClient({ authenticated: true }), await api.createClient({ authenticated: true })],
      clock,
      processor,
      turnsRepository,
    })
    // Act
    await attacker.move("COLONIZE_PLANET_STANDARD_1", 35, destination.id)
    expect(await attacker.endTurn()).toBe("processed")
    await defender.move("COLONIZE_PLANET_STANDARD_1", 35, destination.id)
    expect(await attacker.endTurn()).toBe("processed")
    const claimed = await defender.view()
    const reload = (await createTurnProcessorStub({ db, clock })).turnProcessor
    clock.increment({ time: Time.create(10, UnitOfTime.SECONDS) })
    await turnsRepository.markDueTurnsAwaitingProcessing({ since: clock.now() })
    const completion = await reload.processNextDueTurn()
    const final = await defender.view()
    // Assert
    expect(claimed.fleets.find((fleet) => fleet.movement !== undefined)).toMatchObject({ strength: 35, distanceToEnd: 7.703963225688675 })
    expect(claimed.galaxy.systems.flatMap((system) => system.planets).find((planet) => planet.id === destination.id)?.ownerPlayerId).toBe(
      before.player.id,
    )
    expect(completion).toBe("processed")
    expect(
      final.fleets
        .filter((fleet) => fleet.originPlanetId === destination.id)
        .map((fleet) => [fleet.ownerPlayerId, fleet.strength])
        .toSorted((a, b) => String(a[0]).localeCompare(String(b[0]))),
    ).toStrictEqual(
      [
        [before.player.id, 15],
        [final.player.id, 35],
      ].toSorted((a, b) => String(a[0]).localeCompare(String(b[0]))),
    )
    expect(final.fleets.every((fleet) => fleet.movement === undefined)).toBe(true)
    expect(final.resources).toMatchObject({ INFLUENCE: { total: 4 }, METAL: { total: 3 }, FUEL: { total: 1 }, COLONY: { total: 0 } })
    expect(final.actions.find((action) => action.id === "COLONIZE_PLANET_STANDARD_1")?.status).toBe("AVAILABLE")
    expect(final.galaxy).toStrictEqual((await attacker.view()).galaxy)
  },
)

for (const strength of [25, 35])
  integrationTest(`alternate renamed required25 uses public input${strength} and exact final loss`, { timeout: 60000 }, async ({ db }) => {
    // Arrange: author persisted content before any game exists.
    const clock = new ControlledClock()
    const services = await createApiStub({ db, clock })
    const ruleset = createConfiguredColonizationRuleset()
    Assert.isSuccess(await new RulesetsRepository({ db, logger: services.logger }).upsertRuleset(ruleset))
    using api = new ApiServer(services)
    const { turnProcessor: processor, turnsRepository } = await createTurnProcessorStub({ db, clock })
    const { attacker, destination, before } = await createColonizationActionsScenario({
      rulesetId: ruleset.id,
      players: [await api.createClient({ authenticated: true }), await api.createClient({ authenticated: true })],
      clock,
      processor,
      turnsRepository,
    })
    const definition = Object.values(ruleset.actionDefinitions).find((definition) => definition.id === "EXPAND")
    Assert.isDefined(definition)
    const source = before.fleets.find((fleet) => fleet.ownerPlayerId === before.player.id)
    Assert.isDefined(source)
    // Act
    await expect(
      attacker.submitDefinition(definition.id, { craft: source.id, world: destination.id }, { force: 24 }),
    ).rejects.toMatchObject({ data: { code: "BAD_REQUEST" }, message: expect.stringContaining("at least 25") })
    await attacker.submitDefinition(definition.id, { craft: source.id, world: destination.id }, { force: strength })
    const committed = await attacker.view()
    expect(await attacker.endTurn()).toBe("processed")
    expect(await attacker.endTurn()).toBe("processed")
    const final = await attacker.view()
    // Assert
    expect(committed.fleets.find((fleet) => fleet.id === source.id)?.uncommittedStrength).toBe(40 - strength)
    expect(final.galaxy.systems.flatMap((system) => system.planets).find((planet) => planet.id === destination.id)?.ownerPlayerId).toBe(
      before.player.id,
    )
    expect(
      final.fleets.find((fleet) => fleet.ownerPlayerId === before.player.id && fleet.originPlanetId === destination.id)?.strength,
    ).toBe(strength === 25 ? undefined : 10)
    expect(final.resources).toMatchObject({ INFLUENCE: { total: 4 }, METAL: { total: 3 }, FUEL: { total: 1 }, COLONY: { total: 0 } })
  })

for (const { defenderStrength, assault, expectedStrengths, claimed } of [
  { defenderStrength: 16, assault: true, expectedStrengths: [19], claimed: false },
  { defenderStrength: 35, assault: true, expectedStrengths: [], claimed: false },
  { defenderStrength: 16, assault: false, expectedStrengths: [15, 16], claimed: true },
])
  integrationTest(
    `public composed Move+Assault+Colonize35 against${defenderStrength} uses post-Combat force`,
    { timeout: 90000 },
    async ({ db }) => {
      // Arrange: custom valid composed content before creation, then only normal funding/travel.
      const clock = new ControlledClock(),
        services = await createApiStub({ db, clock })
      const ruleset = createConfiguredColonizationRuleset({ assault, requiredStrength: 20 })
      Assert.isSuccess(await new RulesetsRepository({ db, logger: services.logger }).upsertRuleset(ruleset))
      using api = new ApiServer(services)
      const { turnProcessor: processor, turnsRepository } = await createTurnProcessorStub({ db, clock })
      const { attacker, defender, destination, before } = await createColonizationActionsScenario({
        rulesetId: ruleset.id,
        players: [await api.createClient({ authenticated: true }), await api.createClient({ authenticated: true })],
        clock,
        processor,
        turnsRepository,
      })
      await defender.submitDefinition(GainFuel.id)
      await defender.submitDefinition(GainInfluence.id)
      await attacker.submitDefinition(GainInfluence.id)
      expect(await attacker.endTurn()).toBe("processed")
      await defender.submitDefinition(
        MoveFleetExceptional.id,
        {
          fleet:
            (await defender.view()).fleets.find(
              (fleet) => fleet.ownerPlayerId === before.fleets.find((fleet) => fleet.ownerPlayerId !== before.player.id)?.ownerPlayerId,
            )?.id ?? "missing",
          planet: destination.id,
        },
        { strength: defenderStrength },
      )
      for (let turn = 9; turn <= 12; turn++) expect(await attacker.endTurn()).toBe("processed")
      const staged = await attacker.view()
      expect(staged.fleets.find((fleet) => fleet.originPlanetId === destination.id)?.strength).toBe(defenderStrength)
      const source = staged.fleets.find((fleet) => fleet.ownerPlayerId === before.player.id)
      Assert.isDefined(source)
      const definition = Object.values(ruleset.actionDefinitions).find((definition) => definition.id === "EXPAND")
      Assert.isDefined(definition)
      // Act
      await attacker.submitDefinition(definition.id, { craft: source.id, world: destination.id }, { force: 35 })
      expect(await attacker.endTurn()).toBe("processed")
      expect(await attacker.endTurn()).toBe("processed")
      const final = await attacker.view()
      // Assert
      expect(
        final.galaxy.systems.flatMap((system) => system.planets).find((planet) => planet.id === destination.id)?.ownerPlayerId ===
          before.player.id,
      ).toBe(claimed)
      expect(
        final.fleets
          .filter((fleet) => fleet.originPlanetId === destination.id)
          .map((fleet) => fleet.strength)
          .toSorted((a, b) => a - b),
      ).toStrictEqual(expectedStrengths)
      expect(final.resources).toMatchObject({ INFLUENCE: { total: 9 }, METAL: { total: 3 }, FUEL: { total: 1 }, COLONY: { total: 0 } })
      expect(final.actions.find((action) => action.actionDefinitionId === definition.id)?.status).toBe("AVAILABLE")
    },
  )

integrationTest("public two Colonize20 arrivals merge40 and consume20 once", { timeout: 60000 }, async ({ db }) => {
  // Arrange
  const clock = new ControlledClock()
  using api = new ApiServer(await createApiStub({ db, clock }))
  const { turnProcessor: processor, turnsRepository } = await createTurnProcessorStub({ db, clock })
  const { attacker, destination, before } = await createColonizationActionsScenario({
    players: [await api.createClient({ authenticated: true }), await api.createClient({ authenticated: true })],
    clock,
    processor,
    turnsRepository,
  })
  for (let turn = 8; turn <= 12; turn++) {
    await attacker.submitDefinition(GainInfluence.id)
    expect(await attacker.endTurn()).toBe("processed")
  }
  const funded = await attacker.view()
  expect(funded.resources.INFLUENCE.total).toBe(54)
  // Act
  await attacker.move("COLONIZE_PLANET_STANDARD_1", 20, destination.id)
  await attacker.move("COLONIZE_PLANET_STANDARD_2", 20, destination.id)
  expect(await attacker.endTurn()).toBe("processed")
  expect(await attacker.endTurn()).toBe("processed")
  const final = await attacker.view()
  // Assert
  expect(final.fleets.filter((fleet) => fleet.ownerPlayerId === before.player.id).map((fleet) => fleet.strength)).toStrictEqual([20])
  expect(final.galaxy.systems.flatMap((system) => system.planets).find((planet) => planet.id === destination.id)?.ownerPlayerId).toBe(
    before.player.id,
  )
  expect(
    final.actions.filter((action) => action.actionDefinitionId === ColonizePlanetStandard.id).map((action) => action.status),
  ).toStrictEqual(["AVAILABLE", "AVAILABLE"])
  expect(final.resources).toMatchObject({ INFLUENCE: { total: 4 }, METAL: { total: 3 }, FUEL: { total: 1 }, COLONY: { total: 0 } })
})

for (const amount of [25, 26])
  integrationTest(`renamed stationary25 and Move${amount} use the same public source50 budget`, { timeout: 90000 }, async ({ db }) => {
    // Arrange: configured content is persisted before game creation.
    const clock = new ControlledClock(),
      services = await createApiStub({ db, clock })
    const ruleset = createConfiguredColonizationRuleset()
    Assert.isSuccess(await new RulesetsRepository({ db, logger: services.logger }).upsertRuleset(ruleset))
    using api = new ApiServer(services)
    const { turnProcessor: processor, turnsRepository } = await createTurnProcessorStub({ db, clock })
    const { attacker, source, destination, sibling, before } = await createStationaryColonizationActionsScenario({
      rulesetId: ruleset.id,
      players: [await api.createClient({ authenticated: true }), await api.createClient({ authenticated: true })],
      clock,
      processor,
      turnsRepository,
    })
    // Act
    const stationaryDefinition = Object.values(ruleset.actionDefinitions).find((definition) => definition.id === "ESTABLISH")
    Assert.isDefined(stationaryDefinition)
    await attacker.submitDefinition(stationaryDefinition.id, { craft: source.id, world: destination.id })
    if (amount === 26) {
      await expect(attacker.move("MOVE_FLEET_STANDARD_1", amount, sibling.id)).rejects.toMatchObject({
        data: { code: "BAD_REQUEST" },
        message: expect.stringContaining("shortfall 1"),
      })
      expect((await attacker.view()).fleets.find((fleet) => fleet.id === source.id)?.uncommittedStrength).toBe(25)
    } else {
      await attacker.move("MOVE_FLEET_STANDARD_1", amount, sibling.id)
      expect((await attacker.view()).fleets.find((fleet) => fleet.id === source.id)?.uncommittedStrength).toBe(0)
      expect(await attacker.endTurn()).toBe("processed")
      const final = await attacker.view()
      expect(final.fleets.find((fleet) => fleet.id === source.id)).toBeUndefined()
      expect(final.fleets.find((fleet) => fleet.ownerPlayerId === before.player.id && fleet.originPlanetId === sibling.id)?.strength).toBe(
        25,
      )
      expect(final.galaxy.systems.flatMap((system) => system.planets).find((planet) => planet.id === destination.id)?.ownerPlayerId).toBe(
        before.player.id,
      )
    }
  })
