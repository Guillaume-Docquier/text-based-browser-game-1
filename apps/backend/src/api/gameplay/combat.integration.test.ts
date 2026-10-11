import { Assert, Time, UnitOfTime } from "@guillaume-docquier/tools-ts"
import { createGameConfigurationStub } from "shared/domain/games/GameConfiguration.stub.ts"
import { AttackMoveStandard } from "shared/testing/test-ruleset/action-definitions/attack-move.ts"
import { BuildFleetStandard } from "shared/testing/test-ruleset/action-definitions/build-fleet.ts"
import { GainFuel } from "shared/testing/test-ruleset/action-definitions/gain-fuel.ts"
import { GainInfluence } from "shared/testing/test-ruleset/action-definitions/gain-influence.ts"
import { GainMetal } from "shared/testing/test-ruleset/action-definitions/gain-metal.ts"
import { MoveFleetExceptional } from "shared/testing/test-ruleset/action-definitions/move-fleet.ts"
import { expect } from "vitest"
import { createApiStub } from "#api/createApi.stub.ts"
import { ControlledClock } from "#lib/ControlledClock.ts"
import { ApiServer } from "#tests/ApiServer.ts"
import { createCombatActionsScenario } from "#tests/CombatActionsScenario.stub.ts"
import { FleetActionsScenario } from "#tests/FleetActionsScenario.stub.ts"
import { submitFleetOrder } from "#tests/submitFleetOrder.ts"
import { integrationTest } from "#tests/vitest.integration.fixture.ts"
import { createTurnProcessorStub } from "#turn-processing/TurnProcessor.stub.ts"
integrationTest("should persists normal Assault then reloads without repeat payment or conquest", { timeout: 60000 }, async ({ db }) => {
  // Arrange
  const clock = new ControlledClock()
  using api = new ApiServer(await createApiStub({ db, clock }))
  const { turnProcessor: processor, turnsRepository } = await createTurnProcessorStub({ db, clock })
  const fixture = await createCombatActionsScenario({
    players: [await api.createClient({ authenticated: true }), await api.createClient({ authenticated: true })],
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
  const x = before.actions.find((action) => action.actionDefinitionId === AttackMoveStandard.id && action.id.endsWith("_1"))
  Assert.isDefined(x)
  // Act
  await submitFleetOrder({ side: attacker, actionId: x.id, source: source.id, destination: destination.id, amount: 30 })
  const departureStatus = await attacker.endTurn()
  const departed = await attacker.view()
  const reload = await attacker.view()
  const reloadedProcessor = (await createTurnProcessorStub({ db, clock })).turnProcessor
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
  expect(departed.fleets.find((fleet) => fleet.ownerPlayerId === before.player.id && fleet.movement === undefined)).toMatchObject({
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
    arrived.fleets.every(
      (fleet) =>
        fleet.ownerPlayerId === before.player.id &&
        fleet.movement === undefined &&
        fleet.destinationPlanetId === undefined &&
        fleet.distanceToEnd === undefined,
    ),
  ).toBe(true)
  expect(arrived.actions.find((action) => action.id === x.id)?.status).toBe("AVAILABLE")
  expect(arrived.resources).toMatchObject({ INFLUENCE: { total: 14 }, FUEL: { total: 0 } })
  expect(defenderView.resources).toMatchObject({ INFLUENCE: { total: 13 }, METAL: { total: 5 }, FUEL: { total: 1 } })
  expect(
    defenderView.galaxy.systems.flatMap((system) => system.planets).find((planet) => planet.id === destination.id)?.ownerPlayerId,
  ).toBe(defenderView.player.id)
  expect(idle).toBe("idle")
  expect(idleView).toStrictEqual(arrived)
})

integrationTest("should share Attack and ordinary Move reservations, replacement and cancellation", { timeout: 60000 }, async ({ db }) => {
  // Arrange
  const clock = new ControlledClock()
  using api = new ApiServer(await createApiStub({ db, clock }))
  const { turnProcessor: processor, turnsRepository } = await createTurnProcessorStub({ db, clock })
  const scenario = await FleetActionsScenario.create({
    player: await api.createClient({ authenticated: true }),
    clock,
    processor,
    turnsRepository,
  })
  const [move] = await scenario.moveInstances()
  const attack = (await scenario.view()).actions.find((action) => action.actionDefinitionId === AttackMoveStandard.id)
  Assert.isDefined(move)
  Assert.isDefined(attack)
  const before = await scenario.view()
  const source = before.fleets[0]
  const destination = before.galaxy.systems.flatMap((system) => system.planets).find((planet) => planet.coordinates === "55:07:50")
  Assert.isDefined(source)
  Assert.isDefined(destination)
  await submitFleetOrder({ side: scenario, actionId: move, source: source.id, destination: destination.id, amount: 20 })
  // Act
  await submitFleetOrder({ side: scenario, actionId: attack.id, source: source.id, destination: destination.id, amount: 30 })
  await expect(
    submitFleetOrder({ side: scenario, actionId: attack.id, source: source.id, destination: destination.id, amount: 31 }),
  ).rejects.toMatchObject({
    data: { code: "BAD_REQUEST" },
    message: expect.stringContaining("shortfall 1"),
  })
  const retained = await scenario.view()
  await submitFleetOrder({ side: scenario, actionId: attack.id, source: source.id, destination: destination.id, amount: 25 })
  const replaced = await scenario.view()
  await scenario.cancel(attack.id)
  const cancelled = await scenario.view()
  // Assert
  expect(retained.fleets[0]?.uncommittedStrength).toBe(0)
  expect(retained.actions.find((action) => action.id === attack.id)?.selectedInputs).toStrictEqual({ strength: 30 })
  expect(replaced.fleets[0]?.uncommittedStrength).toBe(5)
  expect(replaced.actions.find((action) => action.id === attack.id)?.selectedInputs).toStrictEqual({ strength: 25 })
  expect(cancelled.fleets[0]?.uncommittedStrength).toBe(30)
  expect(cancelled.actions.find((action) => action.id === move)?.selectedInputs).toStrictEqual({ strength: 20 })
  expect(cancelled.resources.INFLUENCE).toStrictEqual({ total: 10, uncommitted: 7 })
})

integrationTest(
  "should exchanges Attack10 against publicly staged opponents10 and20 with literal survivors7 and13",
  { timeout: 60000 },
  async ({ db }) => {
    // Arrange: ordinary movement stages two owners; no SQL or synthetic fleet writes.
    const clock = new ControlledClock()
    using api = new ApiServer(await createApiStub({ db, clock }))
    const { turnProcessor: processor, turnsRepository } = await createTurnProcessorStub({ db, clock })
    const clients = await Promise.all([1, 2, 3].map(async () => await api.createClient({ authenticated: true })))
    const creator = clients[0]
    Assert.isDefined(creator)
    const { createdGameId: gameId } = await creator.client.games.create.mutate({
      configuration: createGameConfigurationStub({ nbSeats: 3, mapGenerationSeed: 1234, turnIntervalSeconds: 10 }),
    })
    for (const client of clients.slice(1)) await client.client.games.join.mutate({ gameId })
    await creator.client.games.startGame.mutate({ gameId })
    const scenarios = clients.map((player) => new FleetActionsScenario({ player, gameId, clock, processor, turnsRepository }))
    const attacker = scenarios[0],
      firstDefender = scenarios[1],
      secondDefender = scenarios[2]
    Assert.isDefined(attacker)
    Assert.isDefined(firstDefender)
    Assert.isDefined(secondDefender)
    const initial = await attacker.view()
    const planets = initial.galaxy.systems.flatMap((system) => system.planets)
    const attackerHome = planets.find((planet) => planet.ownerPlayerId === initial.player.id)
    Assert.isDefined(attackerHome)
    const destination = planets.find(
      (planet) => planet.ownerPlayerId === null && Math.hypot(attackerHome.x - planet.x, attackerHome.y - planet.y) <= 25,
    )
    Assert.isDefined(destination)
    for (const scenario of scenarios) {
      await scenario.submitDefinition(GainInfluence.id)
      await scenario.submitDefinition(GainMetal.id)
      await scenario.submitDefinition(GainFuel.id)
    }
    await attacker.endTurn()
    for (let build = 0; build < 2; build++) {
      for (const [index, scenario] of scenarios.entries()) {
        const view = await scenario.view()
        const home = planets.find((planet) => planet.ownerPlayerId === view.player.id)
        Assert.isDefined(home)
        if (index === 2 || build === 0) await scenario.submitDefinition(BuildFleetStandard.id, { planet: home.id })
        await scenario.submitDefinition(GainInfluence.id)
        await scenario.submitDefinition(GainMetal.id)
        await scenario.submitDefinition(GainFuel.id)
      }
      await attacker.endTurn()
    }
    for (const [scenario, strength, resources] of [
      [attacker, 10, [7, 10, 16]],
      [firstDefender, 10, [7, 10, 16]],
      [secondDefender, 20, [5, 9, 16]],
    ] as const) {
      const view = await scenario.view()
      const own = view.fleets.filter((fleet) => fleet.ownerPlayerId === view.player.id)
      expect(own).toHaveLength(1)
      const home = planets.find((planet) => planet.ownerPlayerId === view.player.id)
      Assert.isDefined(home)
      expect(own[0]).toMatchObject({ ownerPlayerId: view.player.id, strength, originPlanetId: home.id })
      expect(own[0]?.movement).toBeUndefined()
      expect(own[0]?.destinationPlanetId).toBeUndefined()
      expect(own[0]?.distanceToEnd).toBeUndefined()
      expect([view.resources.INFLUENCE.total, view.resources.METAL.total, view.resources.FUEL.total]).toStrictEqual(resources)
    }
    for (const [scenario, strength] of [
      [firstDefender, 10],
      [secondDefender, 20],
    ] as const) {
      const beforeRoute = await scenario.view()
      const home = planets.find((planet) => planet.ownerPlayerId === beforeRoute.player.id)
      Assert.isDefined(home)
      // Geometry chooses normal legal hops only; literal damage is independent of this setup.
      const queue = [[home]]
      const visited = new Set([home.id])
      let route: (typeof queue)[number] | undefined
      for (let next = 0; next < queue.length; next++) {
        const candidate = queue[next]
        Assert.isDefined(candidate)
        const last = candidate.at(-1)
        Assert.isDefined(last)
        if (last.id === destination.id) {
          route = candidate
          break
        }
        for (const planet of planets) {
          if (visited.has(planet.id) || Math.hypot(last.x - planet.x, last.y - planet.y) > 25) continue
          visited.add(planet.id)
          queue.push([...candidate, planet])
        }
      }
      Assert.isDefined(route)
      let previousStop = home
      for (const stop of route.slice(1)) {
        const view = await scenario.view()
        const own = view.fleets.filter((fleet) => fleet.ownerPlayerId === view.player.id)
        expect(own).toHaveLength(1)
        expect(own[0]).toMatchObject({ ownerPlayerId: view.player.id, strength, originPlanetId: previousStop.id })
        expect(own[0]?.movement).toBeUndefined()
        expect(own[0]?.destinationPlanetId).toBeUndefined()
        expect(own[0]?.distanceToEnd).toBeUndefined()
        const action = view.actions.find((candidate) => candidate.actionDefinitionId === MoveFleetExceptional.id)
        Assert.isDefined(action)
        expect(action.status).toBe("AVAILABLE")
        expect(view.resources.INFLUENCE.uncommitted).toBeGreaterThanOrEqual(3)
        expect(view.resources.FUEL.uncommitted).toBeGreaterThanOrEqual(5)
        const source = own[0]
        Assert.isDefined(source)
        await submitFleetOrder({ side: scenario, actionId: action.id, source: source.id, destination: stop.id, amount: strength })
        await scenario.submitDefinition(GainInfluence.id)
        await attacker.endTurn()
        await scenario.submitDefinition(GainInfluence.id)
        await scenario.submitDefinition(GainMetal.id)
        await scenario.submitDefinition(GainFuel.id)
        await attacker.endTurn()
        for (let travel = 0; travel < 3; travel++) await attacker.endTurn()
        const arrived = await scenario.view()
        const stationed = arrived.fleets.filter((fleet) => fleet.ownerPlayerId === arrived.player.id)
        expect(stationed).toHaveLength(1)
        expect(stationed[0]).toMatchObject({ ownerPlayerId: arrived.player.id, strength, originPlanetId: stop.id })
        expect(stationed[0]?.movement).toBeUndefined()
        expect(stationed[0]?.destinationPlanetId).toBeUndefined()
        expect(stationed[0]?.distanceToEnd).toBeUndefined()
        expect(arrived.actions.find((candidate) => candidate.id === action.id)?.status).toBe("AVAILABLE")
        previousStop = stop
      }
    }
    const staged = await attacker.view()
    expect(
      staged.fleets
        .filter((fleet) => fleet.originPlanetId === destination.id)
        .map((fleet) => fleet.strength)
        .sort((a, b) => a - b),
    ).toStrictEqual([10, 20])
    const attack = staged.actions.find((action) => action.actionDefinitionId === AttackMoveStandard.id)
    Assert.isDefined(attack)
    const attackSource = staged.fleets.find((fleet) => fleet.ownerPlayerId === staged.player.id)
    Assert.isDefined(attackSource)
    // Act
    await submitFleetOrder({ side: attacker, actionId: attack.id, source: attackSource.id, destination: destination.id, amount: 10 })
    for (let travel = 0; travel < 3; travel++) await attacker.endTurn()
    const after = await attacker.view()
    // Assert: independent literal damage3/7, no conquest or remaining transit.
    const survivors = after.fleets.filter((fleet) => fleet.originPlanetId === destination.id)
    expect(
      survivors.map((fleet) => ({ owner: fleet.ownerPlayerId, strength: fleet.strength })).sort((a, b) => a.strength - b.strength),
    ).toStrictEqual([
      { owner: (await firstDefender.view()).player.id, strength: 7 },
      { owner: (await secondDefender.view()).player.id, strength: 13 },
    ])
    for (const survivor of survivors) {
      expect(survivor.movement).toBeUndefined()
      expect(survivor.destinationPlanetId).toBeUndefined()
      expect(survivor.distanceToEnd).toBeUndefined()
    }
    expect(after.fleets.some((fleet) => fleet.ownerPlayerId === after.player.id)).toBe(false)
    expect(after.actions.find((action) => action.id === attack.id)?.status).toBe("AVAILABLE")
    expect(
      after.galaxy.systems.flatMap((system) => system.planets).find((planet) => planet.id === destination.id)?.ownerPlayerId,
    ).toBeNull()
  },
)

integrationTest(
  "should keeps the earlier arriving public child after two saved friendly Attack journeys merge",
  { timeout: 60000 },
  async ({ db }) => {
    // Arrange: normal source50; stage20 at another generated planet with an ordinary Move.
    const clock = new ControlledClock()
    using api = new ApiServer(await createApiStub({ db, clock }))
    const { turnProcessor: processor, turnsRepository } = await createTurnProcessorStub({ db, clock })
    const scenario = await FleetActionsScenario.create({
      player: await api.createClient({ authenticated: true }),
      clock,
      processor,
      turnsRepository,
    })
    const before = await scenario.view()
    const homeSource = before.fleets[0]
    Assert.isDefined(homeSource)
    const planets = before.galaxy.systems.flatMap((system) => system.planets)
    const home = planets.find((planet) => planet.id === homeSource.originPlanetId)
    Assert.isDefined(home)
    const stage = planets.find(
      (planet) =>
        planet.ownerPlayerId === null &&
        Math.hypot(home.x - planet.x, home.y - planet.y) > 5 &&
        Math.hypot(home.x - planet.x, home.y - planet.y) <= 10,
    )
    Assert.isDefined(stage)
    const destination = planets.find((planet) => {
      const farther = Math.hypot(home.x - planet.x, home.y - planet.y)
      const nearer = Math.hypot(stage.x - planet.x, stage.y - planet.y)
      return planet.ownerPlayerId === null && nearer > 10 && farther <= 20 && Math.ceil((nearer - 10) * 2) < Math.ceil((farther - 10) * 2)
    })
    Assert.isDefined(destination)
    const ordinary = before.actions.find((action) => action.actionDefinitionId === MoveFleetExceptional.id)
    Assert.isDefined(ordinary)
    await submitFleetOrder({ side: scenario, actionId: ordinary.id, source: homeSource.id, destination: stage.id, amount: 20 })
    for (let turn = 0; turn < 2; turn++) {
      await scenario.submitDefinition(GainInfluence.id)
      await scenario.submitDefinition(GainMetal.id)
      await scenario.submitDefinition(GainFuel.id)
      await scenario.endTurn()
    }
    const staged = await scenario.view()
    const nearSource = staged.fleets.find((fleet) => fleet.originPlanetId === stage.id)
    Assert.isDefined(nearSource)
    const attacks = staged.actions.filter((action) => action.actionDefinitionId === AttackMoveStandard.id)
    const fartherOrder = attacks[0],
      nearerOrder = attacks[1]
    Assert.isDefined(fartherOrder)
    Assert.isDefined(nearerOrder)
    for (const [action, source, strength] of [
      [fartherOrder, homeSource, 15],
      [nearerOrder, nearSource, 20],
    ] as const) {
      await scenario.player.client.gameplay.updateActionSubmission.mutate({
        gameId: scenario.gameId,
        turn: staged.turn,
        submittedActionTargets: {
          actionId: action.id,
          selectedTargets: { fleet: source.id, planet: destination.id },
          selectedInputs: { strength },
        },
      })
    }
    // Act: read actual persisted children before a recreated production processor resolves arrivals.
    await scenario.endTurn()
    const departed = await scenario.view()
    const nearerChild = departed.fleets.find((fleet) => fleet.movement?.submittedAction.id === nearerOrder.id)
    const fartherChild = departed.fleets.find((fleet) => fleet.movement?.submittedAction.id === fartherOrder.id)
    Assert.isDefined(nearerChild)
    Assert.isDefined(fartherChild)
    const reloadProcessor = (await createTurnProcessorStub({ db, clock })).turnProcessor
    clock.increment({ time: Time.create(10, UnitOfTime.SECONDS) })
    await turnsRepository.markDueTurnsAwaitingProcessing({ since: clock.now() })
    expect(await reloadProcessor.processNextDueTurn()).toBe("processed")
    const arrived = await scenario.view()
    // Assert: geometry-selected earlier child wins even though its action instance is canonical later.
    expect(arrived.fleets.find((fleet) => fleet.originPlanetId === destination.id)).toMatchObject({
      id: nearerChild.id,
      name: nearerChild.name,
      strength: 35,
    })
    expect(arrived.fleets.some((fleet) => fleet.id === fartherChild.id)).toBe(false)
    expect(arrived.fleets.find((fleet) => fleet.id === homeSource.id)?.strength).toBe(15)
    expect(arrived.fleets.every((fleet) => fleet.movement === undefined)).toBe(true)
    expect(
      arrived.actions.filter((action) => action.actionDefinitionId === AttackMoveStandard.id).map((action) => action.status),
    ).toStrictEqual(["AVAILABLE", "AVAILABLE"])
    expect(arrived.resources).toStrictEqual(departed.resources)
  },
)

integrationTest("should includes a public same-turn defender Build before arriving Assault", { timeout: 60000 }, async ({ db }) => {
  // Arrange: normal setup40/10 then Attack30 with a remainder10 at origin.
  const clock = new ControlledClock()
  using api = new ApiServer(await createApiStub({ db, clock }))
  const { turnProcessor: processor, turnsRepository } = await createTurnProcessorStub({ db, clock })
  const { attacker, defender } = await createCombatActionsScenario({
    players: [await api.createClient({ authenticated: true }), await api.createClient({ authenticated: true })],
    clock,
    processor,
    turnsRepository,
    defenderBuildThroughTurn: 2,
  })
  const view = await attacker.view()
  const destination = view.galaxy.systems.flatMap((system) => system.planets).find((planet) => planet.coordinates === "44:96:25")
  const attack = view.actions.find((action) => action.actionDefinitionId === AttackMoveStandard.id)
  Assert.isDefined(destination)
  Assert.isDefined(attack)
  const source = view.fleets.find((fleet) => fleet.ownerPlayerId === view.player.id)
  Assert.isDefined(source)
  await submitFleetOrder({ side: attacker, actionId: attack.id, source: source.id, destination: destination.id, amount: 30 })
  await attacker.endTurn()
  const beforeArrival = await defender.view()
  expect(beforeArrival.fleets.find((fleet) => fleet.ownerPlayerId === beforeArrival.player.id)?.strength).toBe(10)
  await defender.submitDefinition(BuildFleetStandard.id, { planet: destination.id })
  // Act
  await attacker.endTurn()
  const arrived = await attacker.view()
  // Assert: the defender snapshot is20 after Build, so the attacker leaves10.
  expect(
    arrived.fleets
      .filter((fleet) => fleet.originPlanetId === destination.id)
      .map((fleet) => ({ owner: fleet.ownerPlayerId, strength: fleet.strength })),
  ).toStrictEqual([{ owner: arrived.player.id, strength: 10 }])
  expect(arrived.actions.find((action) => action.id === attack.id)?.status).toBe("AVAILABLE")
})

integrationTest("should uses public merged station37 then leaves25 against defender12", { timeout: 60000 }, async ({ db }) => {
  // Arrange: all fleet strengths and funding reached through ordinary public actions.
  const clock = new ControlledClock()
  using api = new ApiServer(await createApiStub({ db, clock }))
  const { turnProcessor: processor, turnsRepository } = await createTurnProcessorStub({ db, clock })
  const { attacker, defender } = await createCombatActionsScenario({
    players: [await api.createClient({ authenticated: true }), await api.createClient({ authenticated: true })],
    clock,
    processor,
    turnsRepository,
  })
  for (let turn = 0; turn < 2; turn++) {
    for (const scenario of [attacker, defender]) {
      await scenario.submitDefinition(GainInfluence.id)
      await scenario.submitDefinition(GainMetal.id)
      await scenario.submitDefinition(GainFuel.id)
    }
    await attacker.endTurn()
  }
  const view = await attacker.view()
  const planets = view.galaxy.systems.flatMap((system) => system.planets)
  const destination = planets.find((planet) => planet.coordinates === "44:96:25")
  Assert.isDefined(destination)
  const remote = planets.find(
    (planet) => planet.id !== destination.id && Math.hypot(planet.x - destination.x, planet.y - destination.y) <= 25,
  )
  Assert.isDefined(remote)
  const ordinary = view.actions.find((action) => action.actionDefinitionId === MoveFleetExceptional.id)
  const defenderView = await defender.view()
  const defenderMove = defenderView.actions.find((action) => action.actionDefinitionId === MoveFleetExceptional.id)
  const attackerSource = view.fleets.find((fleet) => fleet.ownerPlayerId === view.player.id)
  const defenderSource = defenderView.fleets.find((fleet) => fleet.ownerPlayerId === defenderView.player.id)
  Assert.isDefined(attackerSource)
  Assert.isDefined(defenderSource)
  Assert.isDefined(ordinary)
  Assert.isDefined(defenderMove)
  await submitFleetOrder({ side: attacker, actionId: ordinary.id, source: attackerSource.id, destination: destination.id, amount: 7 })
  await submitFleetOrder({ side: defender, actionId: defenderMove.id, source: defenderSource.id, destination: remote.id, amount: 8 })
  for (let turn = 0; turn < 5; turn++) {
    await attacker.submitDefinition(GainInfluence.id)
    await attacker.submitDefinition(GainMetal.id)
    await attacker.submitDefinition(GainFuel.id)
    await attacker.endTurn()
  }
  const staged = await attacker.view()
  const station = staged.fleets.find((fleet) => fleet.ownerPlayerId === staged.player.id && fleet.originPlanetId === destination.id)
  const source = staged.fleets.find((fleet) => fleet.ownerPlayerId === staged.player.id && fleet.originPlanetId !== destination.id)
  Assert.isDefined(station)
  Assert.isDefined(source)
  expect(station.strength).toBe(7)
  expect(staged.fleets.find((fleet) => fleet.ownerPlayerId !== staged.player.id && fleet.originPlanetId === destination.id)?.strength).toBe(
    12,
  )
  const attack = staged.actions.find((action) => action.actionDefinitionId === AttackMoveStandard.id)
  Assert.isDefined(attack)
  await attacker.player.client.gameplay.updateActionSubmission.mutate({
    gameId: attacker.gameId,
    turn: staged.turn,
    submittedActionTargets: {
      actionId: ordinary.id,
      selectedTargets: { fleet: source.id, planet: destination.id },
      selectedInputs: { strength: 10 },
    },
  })
  await attacker.endTurn()
  await attacker.endTurn()
  const departure = await attacker.view()
  await attacker.player.client.gameplay.updateActionSubmission.mutate({
    gameId: attacker.gameId,
    turn: departure.turn,
    submittedActionTargets: {
      actionId: attack.id,
      selectedTargets: { fleet: source.id, planet: destination.id },
      selectedInputs: { strength: 20 },
    },
  })
  // Act: ordinary arrival and Assault arrival both finish before the combat snapshot.
  await attacker.endTurn()
  await attacker.endTurn()
  const arrived = await attacker.view()
  // Assert: original station keeps identity, receives7+10+20, then loses12 once.
  expect(arrived.fleets.filter((fleet) => fleet.originPlanetId === destination.id)).toStrictEqual([
    expect.objectContaining({ id: station.id, name: station.name, ownerPlayerId: arrived.player.id, strength: 25 }),
  ])
  expect(arrived.fleets.find((fleet) => fleet.id === source.id)?.strength).toBe(3)
  expect(arrived.fleets.every((fleet) => fleet.movement === undefined)).toBe(true)
  expect(arrived.actions.find((action) => action.id === attack.id)?.status).toBe("AVAILABLE")
})

integrationTest(
  "should releases both publicly merged pending Attack instances after mutual destruction",
  { timeout: 60000 },
  async ({ db }) => {
    // Arrange: normal public builds40/40 and one ordinary fuel extraction turn.
    const clock = new ControlledClock()
    using api = new ApiServer(await createApiStub({ db, clock }))
    const { turnProcessor: processor, turnsRepository } = await createTurnProcessorStub({ db, clock })
    const { attacker, defender } = await createCombatActionsScenario({
      players: [await api.createClient({ authenticated: true }), await api.createClient({ authenticated: true })],
      clock,
      processor,
      turnsRepository,
      defenderBuildThroughTurn: 5,
    })
    await attacker.submitDefinition(GainFuel.id)
    await attacker.endTurn()
    const before = await attacker.view()
    const destination = before.galaxy.systems.flatMap((system) => system.planets).find((planet) => planet.coordinates === "44:96:25")
    Assert.isDefined(destination)
    const attacks = before.actions.filter((action) => action.actionDefinitionId === AttackMoveStandard.id)
    expect(attacks).toHaveLength(2)
    const source = before.fleets.find((fleet) => fleet.ownerPlayerId === before.player.id)
    Assert.isDefined(source)
    for (const attack of attacks)
      await submitFleetOrder({ side: attacker, actionId: attack.id, source: source.id, destination: destination.id, amount: 20 })
    // Act
    await attacker.endTurn()
    const departure = await attacker.view()
    const saved = await attacker.view()
    const reloadProcessor = (await createTurnProcessorStub({ db, clock })).turnProcessor
    clock.increment({ time: Time.create(10, UnitOfTime.SECONDS) })
    await turnsRepository.markDueTurnsAwaitingProcessing({ since: clock.now() })
    expect(await reloadProcessor.processNextDueTurn()).toBe("processed")
    const arrived = await attacker.view()
    const opposing = await defender.view()
    // Assert: two departure children merge40 before snapshot40, both disappear and both bindings release.
    expect(departure.fleets.filter((fleet) => fleet.ownerPlayerId === departure.player.id).map((fleet) => fleet.strength)).toStrictEqual([
      20, 20,
    ])
    expect(
      departure.actions.filter((action) => action.actionDefinitionId === AttackMoveStandard.id).map((action) => action.status),
    ).toStrictEqual(["IN_PROGRESS", "IN_PROGRESS"])
    expect(saved.fleets).toStrictEqual(departure.fleets)
    expect(arrived.fleets).toStrictEqual([])
    expect(opposing.fleets).toStrictEqual([])
    expect(
      arrived.actions.filter((action) => action.actionDefinitionId === AttackMoveStandard.id).map((action) => action.status),
    ).toStrictEqual(["AVAILABLE", "AVAILABLE"])
    expect(arrived.resources).toStrictEqual(departure.resources)
    expect(arrived.resources).toMatchObject({ INFLUENCE: { total: 7 }, FUEL: { total: 4 } })
  },
)
