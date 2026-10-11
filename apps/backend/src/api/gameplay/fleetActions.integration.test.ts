import { Assert } from "@guillaume-docquier/tools-ts"
import { getUntypedClient } from "@trpc/client"
import { createGameConfigurationStub } from "shared/domain/games/GameConfiguration.stub.ts"
import { BuildFleetStandard } from "shared/testing/test-ruleset/action-definitions/build-fleet.ts"
import { GainFuel } from "shared/testing/test-ruleset/action-definitions/gain-fuel.ts"
import { GainInfluence } from "shared/testing/test-ruleset/action-definitions/gain-influence.ts"
import { GainMetal } from "shared/testing/test-ruleset/action-definitions/gain-metal.ts"
import { MoveFleetStandard, MoveFleetImproved } from "shared/testing/test-ruleset/action-definitions/move-fleet.ts"
import { describe, expect } from "vitest"
import { createApiStub } from "#api/createApi.stub.ts"
import { ControlledClock } from "#lib/ControlledClock.ts"
import { ApiServer } from "#tests/ApiServer.ts"
import { FleetActionsScenario } from "#tests/FleetActionsScenario.stub.ts"
import { submitFleetOrder } from "#tests/submitFleetOrder.ts"
import { integrationTest } from "#tests/vitest.integration.fixture.ts"
import { createTurnProcessorStub } from "#turn-processing/TurnProcessor.stub.ts"

describe("fleet actions through production routers", () => {
  integrationTest(
    "reserves 20+30, retains failed edits, replaces and cancels exactly one commitment",
    { timeout: 60_000 },
    async ({ db }) => {
      // Arrange
      const clock = new ControlledClock()
      using api = new ApiServer(await createApiStub({ db, clock }))
      const player = await api.createClient({ authenticated: true })
      const { turnProcessor: processor, turnsRepository } = await createTurnProcessorStub({ db, clock })
      const scenario = await FleetActionsScenario.create({ player, clock, processor, turnsRepository })
      const [x = "", y = ""] = await scenario.moveInstances()
      const before = await scenario.view()
      const source = before.fleets[0]
      const destination = before.galaxy.systems.flatMap((system) => system.planets).find((planet) => planet.coordinates === "55:07:50")
      Assert.isDefined(source)
      Assert.isDefined(destination)
      expect(before.fleets.map((fleet) => fleet.strength)).toStrictEqual([50])
      // Act
      await submitFleetOrder({ side: scenario, actionId: x, source: source.id, destination: destination.id, amount: 20 })
      await submitFleetOrder({ side: scenario, actionId: y, source: source.id, destination: destination.id, amount: 30 })
      await expect(
        submitFleetOrder({ side: scenario, actionId: y, source: source.id, destination: destination.id, amount: 31 }),
      ).rejects.toMatchObject({
        data: { code: "BAD_REQUEST" },
        message: expect.stringContaining("shortfall 1"),
      })
      const failedEdit = await scenario.view()
      await submitFleetOrder({ side: scenario, actionId: x, source: source.id, destination: destination.id, amount: 15 })
      const replaced = await scenario.view()
      await scenario.cancel(x)
      const cancelled = await scenario.view()
      await scenario.cancel(y)
      const released = await scenario.view()
      const improved = released.actions.find((action) => action.actionDefinitionId === MoveFleetImproved.id)
      Assert.isDefined(improved)
      await submitFleetOrder({ side: scenario, actionId: x, source: source.id, destination: destination.id, amount: 20 })
      await scenario.submitDefinition(MoveFleetImproved.id, { fleet: before.fleets[0]?.id ?? "", planet: destination.id }, { strength: 30 })
      const mixedDefinitions = await scenario.view()
      // Assert
      expect(failedEdit.actions.filter((action) => action.status === "SUBMITTED").map((action) => action.selectedInputs)).toStrictEqual([
        { strength: 20 },
        { strength: 30 },
      ])
      expect(failedEdit.resources.INFLUENCE.uncommitted).toBe(before.resources.INFLUENCE.total - 6)
      expect(replaced.actions.find((action) => action.id === x)?.selectedInputs).toStrictEqual({ strength: 15 })
      expect(cancelled.resources.INFLUENCE.uncommitted).toBe(before.resources.INFLUENCE.total - 3)
      expect(released.resources.INFLUENCE.uncommitted).toBe(before.resources.INFLUENCE.total)
      expect(released.fleets.map((fleet) => fleet.strength)).toStrictEqual([50])
      expect(mixedDefinitions.fleets[0]?.uncommittedStrength).toBe(0)
      expect(
        mixedDefinitions.actions.filter((action) => action.status === "SUBMITTED").map((action) => action.actionDefinitionId),
      ).toStrictEqual([MoveFleetImproved.id, before.actions.find((action) => action.id === x)?.actionDefinitionId])
    },
  )
  integrationTest(
    "persists partial departure, refuses occupied edit/cancel, continues without payment and releases on arrival",
    { timeout: 60_000 },
    async ({ db }) => {
      // Arrange
      const clock = new ControlledClock()
      using api = new ApiServer(await createApiStub({ db, clock }))
      const player = await api.createClient({ authenticated: true })
      const { turnProcessor: processor, turnsRepository } = await createTurnProcessorStub({ db, clock })
      const scenario = await FleetActionsScenario.create({ player, clock, processor, turnsRepository })
      const [x = "", y = ""] = await scenario.moveInstances()
      const before = await scenario.view()
      const source = before.fleets[0]
      const destination = before.galaxy.systems.flatMap((system) => system.planets).find((planet) => planet.coordinates === "55:07:50")
      Assert.isDefined(source)
      Assert.isDefined(destination)
      await submitFleetOrder({ side: scenario, actionId: x, source: source.id, destination: destination.id, amount: 20 })
      // Act
      expect(await scenario.endTurn()).toBe("processed")
      const first = await scenario.view()
      const reload = await scenario.view()
      await expect(scenario.cancel(x)).rejects.toMatchObject({
        data: { code: "BAD_REQUEST" },
        message: expect.stringContaining("in progress"),
      })
      await expect(
        submitFleetOrder({ side: scenario, actionId: x, source: source.id, destination: destination.id, amount: 1 }),
      ).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } })
      expect(await scenario.endTurn()).toBe("processed")
      const second = await scenario.view()
      for (let turn = 0; turn < 10; turn++) expect(await scenario.endTurn()).toBe("processed")
      const arrived = await scenario.view()
      // Assert
      expect(first.fleets.find((fleet) => fleet.movement === undefined)).toMatchObject({ id: before.fleets[0]?.id, strength: 30 })
      expect(first.fleets.find((fleet) => fleet.movement !== undefined)).toMatchObject({
        strength: 20,
        distanceToEnd: expect.closeTo(1.045643504594252, 12),
        movement: { speed: 0.1, initiatingTurn: 8, submittedAction: { id: x, selectedInputs: { strength: 20 } } },
      })
      expect(reload.fleets).toStrictEqual(first.fleets)
      expect(first.actions.find((action) => action.id === x)?.status).toBe("IN_PROGRESS")
      expect(first.actions.find((action) => action.id === y)?.status).toBe("AVAILABLE")
      expect(second.fleets.find((fleet) => fleet.movement !== undefined)?.distanceToEnd).toBeCloseTo(0.9456435045942517, 12)
      expect(second.resources.FUEL.total).toBe(before.resources.FUEL.total - 1)
      expect(arrived.fleets.find((fleet) => fleet.strength === 20)?.movement).toBeUndefined()
      expect(arrived.actions.find((action) => action.id === x)?.status).toBe("AVAILABLE")
      expect(arrived.resources.FUEL.total).toBe(before.resources.FUEL.total - 1)
    },
  )
})

integrationTest(
  "should reject malformed inputs, wrong scoped targets and moving sources without changing the saved order",
  { timeout: 60_000 },
  async ({ db }) => {
    // Arrange
    const clock = new ControlledClock()
    using api = new ApiServer(await createApiStub({ db, clock }))
    const player = await api.createClient({ authenticated: true })
    const { turnProcessor: processor, turnsRepository } = await createTurnProcessorStub({ db, clock })
    const foreign = await player.client.games.create.mutate({
      configuration: createGameConfigurationStub({ mapGenerationSeed: 1234, turnIntervalSeconds: 86400 }),
    })
    await player.client.games.startGame.mutate({ gameId: foreign.createdGameId })
    const foreignScenario = new FleetActionsScenario({ player, clock, processor, turnsRepository, gameId: foreign.createdGameId })
    const foreignBefore = await foreignScenario.view()
    const foreignPlanet = foreignBefore.galaxy.systems
      .flatMap((system) => system.planets)
      .find((planet) => planet.ownerPlayerId === foreignBefore.player.id)
    Assert.isDefined(foreignPlanet)
    await foreignScenario.submitDefinition(BuildFleetStandard.id, { planet: foreignPlanet.id })
    await player.client.gameplay.updateReadiness.mutate({ gameId: foreign.createdGameId, turn: foreignBefore.turn, isReady: true })
    await foreignScenario.endTurn()
    const foreignFleet = (await foreignScenario.view()).fleets[0]
    Assert.isDefined(foreignFleet)
    const scenario = await FleetActionsScenario.create({ player, clock, processor, turnsRepository })
    const [x = "", y = ""] = await scenario.moveInstances()
    const before = await scenario.view()
    const source = before.fleets[0]
    Assert.isDefined(source)
    const destination = before.galaxy.systems.flatMap((system) => system.planets).find((planet) => planet.coordinates === "55:07:50")
    Assert.isDefined(destination)
    await submitFleetOrder({ side: scenario, actionId: x, source: source.id, destination: destination.id, amount: 20 })
    const invalid = [
      {},
      { strength: 0 },
      { strength: -1 },
      { strength: 1.5 },
      { strength: 51 },
      { strength: Infinity },
      { strength: NaN },
      { strength: Number.MAX_SAFE_INTEGER + 1 },
      { strength: 1, extra: 1 },
    ]
    // Act
    for (const selectedInputs of invalid)
      await expect(
        player.client.gameplay.updateActionSubmission.mutate({
          gameId: scenario.gameId,
          turn: before.turn,
          submittedActionTargets: { actionId: x, selectedTargets: { fleet: source.id, planet: destination.id }, selectedInputs },
        }),
      ).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } })
    for (const selectedTargets of [
      { fleet: "missing", planet: destination.id },
      { fleet: foreignFleet.id, planet: destination.id },
      { fleet: source.id, planet: source.originPlanetId },
      { fleet: source.id, planet: foreignPlanet.id },
      { fleet: source.id, planet: destination.id, extra: "20" },
      { fleet: source.id },
    ])
      await expect(
        player.client.gameplay.updateActionSubmission.mutate({
          gameId: scenario.gameId,
          turn: before.turn,
          submittedActionTargets: { actionId: x, selectedTargets, selectedInputs: { strength: 1 } },
        }),
      ).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } })
    const retained = await scenario.view()
    await scenario.endTurn()
    const departed = await scenario.view()
    const journey = departed.fleets.find((fleet) => fleet.movement !== undefined)
    Assert.isDefined(journey)
    await expect(
      player.client.gameplay.updateActionSubmission.mutate({
        gameId: scenario.gameId,
        turn: departed.turn,
        submittedActionTargets: {
          actionId: y,
          selectedTargets: { fleet: journey.id, planet: source.originPlanetId },
          selectedInputs: { strength: 1 },
        },
      }),
    ).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } })
    // Assert
    expect(retained.actions.find((action) => action.id === x)?.selectedInputs).toStrictEqual({ strength: 20 })
    expect(retained.fleets[0]?.strength).toBe(50)
    expect(retained.fleets[0]?.uncommittedStrength).toBe(30)
    expect(retained.resources.FUEL.total).toBe(before.resources.FUEL.total)
    expect(departed.fleets.reduce((sum, fleet) => sum + fleet.strength, 0)).toBe(50)
  },
)

integrationTest(
  "should reject raw transport shapes and old-turn occupied requests while preserving saved commitments",
  { timeout: 60_000 },
  async ({ db }) => {
    // Arrange
    const clock = new ControlledClock()
    using api = new ApiServer(await createApiStub({ db, clock }))
    const player = await api.createClient({ authenticated: true })
    const { turnProcessor: processor, turnsRepository } = await createTurnProcessorStub({ db, clock })
    const scenario = await FleetActionsScenario.create({ player, clock, processor, turnsRepository })
    const [x = "", y = ""] = await scenario.moveInstances()
    const before = await scenario.view()
    const source = before.fleets[0]
    const destination = before.galaxy.systems.flatMap((system) => system.planets).find((planet) => planet.coordinates === "55:07:50")
    Assert.isDefined(source)
    Assert.isDefined(destination)
    await submitFleetOrder({ side: scenario, actionId: x, source: source.id, destination: destination.id, amount: 20 })
    const validTargets = { fleet: source.id, planet: destination.id }
    const raw = getUntypedClient(player.client)
    // Act
    for (const selectedInputs of [{ strength: null }, { strength: "20" }, null]) {
      await expect(
        raw.mutation("gameplay.updateActionSubmission", {
          gameId: scenario.gameId,
          turn: before.turn,
          submittedActionTargets: { actionId: x, selectedTargets: validTargets, selectedInputs },
        }),
      ).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } })
    }
    await expect(
      raw.mutation("gameplay.updateActionSubmission", {
        gameId: scenario.gameId,
        turn: before.turn,
        submittedActionTargets: { actionId: x, selectedTargets: null, selectedInputs: {} },
      }),
    ).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } })
    const retained = await scenario.view()
    await scenario.endTurn()
    await expect(
      player.client.gameplay.updateActionSubmission.mutate({
        gameId: scenario.gameId,
        turn: before.turn,
        submittedActionTargets: { actionId: x, selectedTargets: null, selectedInputs: null },
      }),
    ).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } })
    await submitFleetOrder({ side: scenario, actionId: y, source: source.id, destination: destination.id, amount: 30 })
    const next = await scenario.view()
    // Assert
    expect(retained.actions.find((action) => action.id === x)?.selectedInputs).toStrictEqual({ strength: 20 })
    expect(retained.resources.INFLUENCE).toStrictEqual({
      total: before.resources.INFLUENCE.total,
      uncommitted: before.resources.INFLUENCE.total - 3,
    })
    expect(retained.resources.FUEL).toStrictEqual({ total: before.resources.FUEL.total, uncommitted: before.resources.FUEL.total - 1 })
    expect(next.actions.find((action) => action.id === x)?.status).toBe("IN_PROGRESS")
    expect(next.actions.find((action) => action.id === y)?.selectedInputs).toStrictEqual({ strength: 30 })
    expect(next.fleets.find((fleet) => fleet.movement === undefined)?.uncommittedStrength).toBe(0)
  },
)

integrationTest(
  "should retain a saved allocation when a sibling exceeds the remaining resource budget",
  { timeout: 60_000 },
  async ({ db }) => {
    // Arrange
    const clock = new ControlledClock()
    using api = new ApiServer(await createApiStub({ db, clock }))
    const player = await api.createClient({ authenticated: true })
    const { turnProcessor: processor, turnsRepository } = await createTurnProcessorStub({ db, clock })
    const scenario = await FleetActionsScenario.create({ player, clock, processor, turnsRepository })
    const [x = "", y = ""] = await scenario.moveInstances()
    const before = await scenario.view()
    const source = before.fleets[0]
    const destination = before.galaxy.systems.flatMap((system) => system.planets).find((planet) => planet.coordinates === "55:07:50")
    Assert.isDefined(source)
    Assert.isDefined(destination)
    await submitFleetOrder({ side: scenario, actionId: x, source: source.id, destination: destination.id, amount: 20 })
    await scenario.submitDefinition(BuildFleetStandard.id, { planet: source.originPlanetId })
    await scenario.submitDefinition(GainFuel.id)
    await scenario.submitDefinition(GainMetal.id)
    const saved = await scenario.view()

    // Act
    await expect(
      submitFleetOrder({ side: scenario, actionId: y, source: source.id, destination: destination.id, amount: 30 }),
    ).rejects.toMatchObject({
      data: { code: "BAD_REQUEST" },
      message: expect.stringContaining("Insufficient INFLUENCE: shortfall 1"),
    })
    const retained = await scenario.view()
    const processing = await scenario.endTurn()
    const resolved = await scenario.view()

    // Assert
    expect(saved.resources.INFLUENCE).toStrictEqual({ total: 10, uncommitted: 2 })
    expect(retained.resources).toStrictEqual(saved.resources)
    expect(retained.actions).toStrictEqual(saved.actions)
    expect(retained.fleets).toStrictEqual(saved.fleets)
    expect(retained.fleets[0]?.uncommittedStrength).toBe(30)
    expect(retained.actions.find((action) => action.id === x)?.selectedInputs).toStrictEqual({ strength: 20 })
    expect(retained.actions.find((action) => action.id === y)?.status).toBe("AVAILABLE")
    expect(processing).toBe("processed")
    expect(resolved.resources.INFLUENCE.total).toBe(2)
    expect(resolved.resources.FUEL.total).toBe(before.resources.FUEL.total + 4)
    expect(resolved.fleets.find((fleet) => fleet.movement === undefined)?.strength).toBe(40)
    expect(resolved.fleets.find((fleet) => fleet.movement !== undefined)?.strength).toBe(20)
  },
)

for (const [assignment, playerId, opponentId] of [
  ["lower identity", "00000000-0000-4000-8000-000000000001", "00000000-0000-4000-8000-000000000002"],
  ["higher identity", "00000000-0000-4000-8000-000000000002", "00000000-0000-4000-8000-000000000001"],
] as const) {
  integrationTest(
    `should reject a same-game enemy source while preserving an owned saved allocation (${assignment})`,
    { timeout: 60_000 },
    async ({ db }) => {
      // Arrange
      const clock = new ControlledClock()
      using api = new ApiServer(await createApiStub({ db, clock }))
      const player = await api.createClient({ authenticated: true, id: playerId })
      const opponent = await api.createClient({ authenticated: true, id: opponentId })
      const { turnProcessor: processor, turnsRepository } = await createTurnProcessorStub({ db, clock })
      const { createdGameId: gameId } = await player.client.games.create.mutate({
        configuration: createGameConfigurationStub({ nbSeats: 2, mapGenerationSeed: 1234, turnIntervalSeconds: 10 }),
      })
      await opponent.client.games.join.mutate({ gameId })
      await player.client.games.startGame.mutate({ gameId })
      const own = new FleetActionsScenario({ player, clock, processor, turnsRepository, gameId })
      const enemy = new FleetActionsScenario({ player: opponent, clock, processor, turnsRepository, gameId })
      for (const scenario of [own, enemy]) {
        const view = await scenario.view()
        const home = view.galaxy.systems.flatMap((system) => system.planets).find((planet) => planet.ownerPlayerId === view.player.id)
        Assert.isDefined(home)
        await scenario.submitDefinition(BuildFleetStandard.id, { planet: home.id })
        await scenario.submitDefinition(GainInfluence.id)
      }
      expect(await own.endTurn()).toBe("processed")
      const before = await own.view()
      const source = before.fleets.find((fleet) => fleet.ownerPlayerId === before.player.id)
      const enemySource = before.fleets.find((fleet) => fleet.ownerPlayerId !== before.player.id)
      const planets = before.galaxy.systems.flatMap((system) => system.planets)
      Assert.isDefined(source)
      const origin = planets.find((planet) => planet.id === source.originPlanetId)
      Assert.isDefined(origin)
      // Geometry selects legal setup only; ownership and retention below are independent router oracles.
      const destination = planets.find((planet) => planet.id !== origin.id && Math.hypot(planet.x - origin.x, planet.y - origin.y) <= 5)
      const instance = before.actions.find((action) => action.actionDefinitionId === MoveFleetStandard.id)
      Assert.isDefined(source)
      Assert.isDefined(enemySource)
      Assert.isDefined(destination)
      Assert.isDefined(instance)
      expect(destination.id).not.toBe(source.originPlanetId)
      expect(Math.hypot(destination.x - origin.x, destination.y - origin.y)).toBeLessThanOrEqual(5)
      if (assignment === "lower identity") expect(origin.x).toBeGreaterThan(50)
      else expect(origin.x).toBeLessThan(50)
      await player.client.gameplay.updateActionSubmission.mutate({
        gameId,
        turn: before.turn,
        submittedActionTargets: {
          actionId: instance.id,
          selectedTargets: { fleet: source.id, planet: destination.id },
          selectedInputs: { strength: 4 },
        },
      })
      const saved = await own.view()

      // Act
      await expect(
        player.client.gameplay.updateActionSubmission.mutate({
          gameId,
          turn: before.turn,
          submittedActionTargets: {
            actionId: instance.id,
            selectedTargets: { fleet: enemySource.id, planet: destination.id },
            selectedInputs: { strength: 4 },
          },
        }),
      ).rejects.toMatchObject({
        data: { code: "BAD_REQUEST" },
        message: expect.stringContaining("Target must be owned by submitting player"),
      })
      const retained = await own.view()

      // Assert
      expect(source.strength).toBe(10)
      expect(enemySource.strength).toBe(10)
      expect(enemySource.ownerPlayerId).toBe(opponent.account.id)
      expect(enemySource.movement).toBeUndefined()
      expect(retained.actions).toStrictEqual(saved.actions)
      expect(retained.resources).toStrictEqual(saved.resources)
      expect(retained.fleets).toStrictEqual(saved.fleets)
      expect(retained.actions.find((action) => action.id === instance.id)?.selectedTargets).toStrictEqual({
        fleet: source.id,
        planet: destination.id,
      })
    },
  )
}
