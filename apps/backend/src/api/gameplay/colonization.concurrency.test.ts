import { Assert, mulberry32Prng, Rng, Result, Time, UnitOfTime } from "@guillaume-docquier/tools-ts"
import { createGameConfigurationStub } from "shared/domain/games/GameConfiguration.stub.ts"
import { ColonizeStationedPlanetStandard } from "shared/testing/test-ruleset/action-definitions/colonize-planet.ts"
import { resolveTurn } from "shared/turn-resolution/resolveTurn.ts"
import { describe, expect, it } from "vitest"
import { createColonizationActionsScenario, createStationaryColonizationActionsScenario } from "#tests/ColonizationActionsScenario.stub.ts"
import { ControlledConcurrencyTestApiServer } from "#tests/ConcurrencyTestApiServer.ts"
import { extractSuccess } from "#tests/extractSuccess.ts"

describe("Colonization persistence", () => {
  it(
    "should real PG owner+Fleet+resources+nextActions+RNG+queue save rolls back and retries once, scoped to game",
    { timeout: 120000 },
    async () => {
      // Arrange: router-generated games with repeated planet ID; only save transport is instrumented.
      await using api = await ControlledConcurrencyTestApiServer.create()
      const fixture = await createColonizationActionsScenario({
        players: [await api.createClient(), await api.createClient()],
        clock: api.clock,
        processor: api.processor,
        turnsRepository: api.turnsRepository,
      })
      const { attacker, defender, destination, before, gameId } = fixture
      const secondCreator = await api.createClient(),
        secondJoiner = await api.createClient()
      const { createdGameId: secondGameId } = await secondCreator.client.games.create.mutate({
        configuration: createGameConfigurationStub({ nbSeats: 2, mapGenerationSeed: 1234, turnIntervalSeconds: 10000 }),
      })
      await secondJoiner.client.games.join.mutate({ gameId: secondGameId })
      await secondCreator.client.games.startGame.mutate({ gameId: secondGameId })
      const untouched = await secondCreator.client.gameplay.getPlayerView.query({ gameId: secondGameId })
      const secondPersistence = await api.observeWorkerPersistence(secondGameId)
      await attacker.move("COLONIZE_PLANET_STANDARD_1", 35, destination.id)
      expect(await attacker.endTurn()).toBe("processed")
      const departed = await attacker.view(),
        opposing = await defender.view()
      const saved = await api.observeWorkerPersistence(gameId)
      const current = saved.turns.find((turn) => turn.turn === 9)
      Assert.isDefined(current)
      const { processor, fault } = await api.createSaveFailureProcessor()
      // Act: after all production save statements are awaited, force rollback at the real transaction seam.
      api.clock.increment({ time: Time.create(10, UnitOfTime.SECONDS) })
      await api.turnsRepository.markDueTurnsAwaitingProcessing({ since: api.clock.now() })
      const captured = await api.captureNextDueTurn()
      const replayRng = Rng.fromState(captured.rngState, mulberry32Prng)
      const replayed = extractSuccess(resolveTurn({ ...structuredClone(captured), winnerPlayerId: undefined }, captured.ruleset, replayRng))
      fault.armNextSave()
      const failed = await processor.processNextDueTurn()
      const rollback = await api.observeWorkerPersistence(gameId)
      // Assert
      expect(failed).toBe("failed")
      expect(fault.completedSaveCallbacks).toBe(1)
      expect(await attacker.view()).toStrictEqual({ ...departed, turnStatus: "PROCESSING" })
      expect(await defender.view()).toStrictEqual({ ...opposing, turnStatus: "PROCESSING" })
      expect(rollback.planets).toStrictEqual(saved.planets)
      expect(rollback.fleets).toStrictEqual(saved.fleets)
      expect(rollback.resources).toStrictEqual(saved.resources)
      expect(rollback.actions).toStrictEqual(saved.actions)
      expect(rollback.turns).toHaveLength(9)
      expect(rollback.turns.find((turn) => turn.turn === 9)).toStrictEqual({ ...current, status: "PROCESSING", closedAt: current.endsAt })
      expect(rollback.queue.map((row) => [row.turn, row.processingEndedAt])).toStrictEqual(
        saved.queue.map((row) => [row.turn, row.processingEndedAt]),
      )
      expect(rollback.turns.find((turn) => turn.turn === 9)?.rngGeneratorState).toBe(current.rngGeneratorState)
      expect(rollback.turns.find((turn) => turn.turn === 9)?.rngSpareNormal).toBe(current.rngSpareNormal)
      expect(await api.turnsRepository.resetProcessingAttempt({ gameId, turn: 9 })).toStrictEqual(Result.Success({ reset: true }))
      expect(await processor.processNextDueTurn()).toBe("processed")
      const arrived = await attacker.view(),
        committed = await api.observeWorkerPersistence(gameId)
      expect(arrived.galaxy.systems.flatMap((system) => system.planets).find((planet) => planet.id === destination.id)).toStrictEqual({
        ...destination,
        ownerPlayerId: before.player.id,
      })
      expect(committed.planets.find((planet) => planet.id === destination.id)?.ownerPlayerId).toBe(before.player.id)
      expect(
        committed.fleets
          .filter((fleet) => fleet.ownerPlayerId === before.player.id)
          .find((fleet) => fleet.originPlanetId === destination.id),
      ).toMatchObject({ strength: 15, movement: null, destinationPlanetId: null, distanceToEnd: null })
      expect(committed.turns.find((turn) => turn.turn === 10)).toMatchObject({
        rngGeneratorState: replayRng.getState().generatorState,
        rngSpareNormal: replayRng.getState().spareNormal,
      })
      expect(
        committed.fleets.map((fleet) => [fleet.id, fleet.strength]).toSorted((a, b) => String(a[0]).localeCompare(String(b[0]))),
      ).toStrictEqual(
        Object.values(replayed.fleets)
          .map((fleet) => [fleet.id, fleet.strength])
          .toSorted((a, b) => String(a[0]).localeCompare(String(b[0]))),
      )
      expect(committed.turns).toHaveLength(10)
      expect(committed.actions.filter((action) => action.turn === 10)).toHaveLength(34)
      expect(committed.queue).toHaveLength(10)
      expect(arrived.resources).toStrictEqual(departed.resources)
      expect(arrived.actions.find((action) => action.id === "COLONIZE_PLANET_STANDARD_1")).toMatchObject({
        status: "AVAILABLE",
        canAffordResources: false,
      })
      expect(await processor.processNextDueTurn()).toBe("idle")
      expect(await attacker.view()).toStrictEqual(arrived)
      expect(await secondCreator.client.gameplay.getPlayerView.query({ gameId: secondGameId })).toStrictEqual(untouched)
      expect(await api.observeWorkerPersistence(secondGameId)).toStrictEqual(secondPersistence)
    },
  )

  it(
    "should real PG saved tied Colonize competition selects one eligible owner without extra consumption",
    { timeout: 120000 },
    async () => {
      // Arrange
      await using api = await ControlledConcurrencyTestApiServer.create()
      const { attacker, defender, destination, before } = await createColonizationActionsScenario({
        players: [await api.createClient(), await api.createClient()],
        clock: api.clock,
        processor: api.processor,
        turnsRepository: api.turnsRepository,
      })
      await attacker.move("COLONIZE_PLANET_STANDARD_1", 35, destination.id)
      await defender.move("COLONIZE_PLANET_STANDARD_1", 35, destination.id)
      expect(await attacker.endTurn()).toBe("processed")
      const saved = await attacker.view()
      const reload = await api.recreateProcessor()
      // Act
      api.clock.increment({ time: Time.create(10, UnitOfTime.SECONDS) })
      await api.turnsRepository.markDueTurnsAwaitingProcessing({ since: api.clock.now() })
      const captured = await api.captureNextDueTurn()
      const rng = Rng.fromState(captured.rngState, mulberry32Prng)
      const expected = resolveTurn({ ...structuredClone(captured), winnerPlayerId: undefined }, captured.ruleset, rng)
      const reversed = {
        ...structuredClone(captured),
        winnerPlayerId: undefined,
        fleets: Object.fromEntries(Object.entries(structuredClone(captured.fleets)).toReversed()),
        planets: Object.fromEntries(Object.entries(structuredClone(captured.planets)).toReversed()),
        players: Object.fromEntries(Object.entries(structuredClone(captured.players)).toReversed()),
      }
      const reverseRng = Rng.fromState(captured.rngState, mulberry32Prng)
      expect(resolveTurn(reversed, captured.ruleset, reverseRng)).toStrictEqual(expected)
      expect(reverseRng.getState()).toStrictEqual(rng.getState())
      const replay = extractSuccess(expected)
      const status = await reload.processNextDueTurn()
      const final = await attacker.view(),
        opposing = await defender.view()
      // Assert
      expect(saved.fleets.filter((fleet) => fleet.movement !== undefined)).toHaveLength(2)
      expect(status).toBe("processed")
      const committed = await api.observeWorkerPersistence(before.gameId)
      expect(committed.turns.find((turn) => turn.turn === 10)).toMatchObject({
        rngGeneratorState: rng.getState().generatorState,
        rngSpareNormal: rng.getState().spareNormal,
      })
      expect(
        committed.fleets.map((fleet) => [fleet.id, fleet.strength]).toSorted((a, b) => String(a[0]).localeCompare(String(b[0]))),
      ).toStrictEqual(
        Object.values(replay.fleets)
          .map((fleet) => [fleet.id, fleet.strength])
          .toSorted((a, b) => String(a[0]).localeCompare(String(b[0]))),
      )
      expect(committed.planets.find((planet) => planet.id === destination.id)?.ownerPlayerId).toBe(
        replay.planets[destination.id]?.ownerPlayerId,
      )
      const owner = final.galaxy.systems.flatMap((system) => system.planets).find((planet) => planet.id === destination.id)?.ownerPlayerId
      expect([before.player.id, opposing.player.id]).toContain(owner)
      expect(
        final.fleets.filter((fleet) => fleet.ownerPlayerId === owner).find((fleet) => fleet.originPlanetId === destination.id)?.strength,
      ).toBe(15)
      expect(
        final.fleets.filter((fleet) => fleet.ownerPlayerId !== owner).find((fleet) => fleet.originPlanetId === destination.id)?.strength,
      ).toBe(35)
      expect(final.fleets.every((fleet) => fleet.movement === undefined)).toBe(true)
      for (const view of [final, opposing]) {
        expect(view.resources).toMatchObject({ INFLUENCE: { total: 4 }, METAL: { total: 3 }, FUEL: { total: 1 }, COLONY: { total: 0 } })
        expect(view.actions.find((action) => action.id === "COLONIZE_PLANET_STANDARD_1")?.status).toBe("AVAILABLE")
      }
    },
  )

  it("should real PG stationary20 and simultaneous Move30 serialize source50", { timeout: 120000 }, async () => {
    const amount = 30
    // Arrange: normal public funding/build/travel/fuel actions only.
    await using api = await ControlledConcurrencyTestApiServer.create()
    const { attacker, destination, sibling, before, source } = await createStationaryColonizationActionsScenario({
      players: [await api.createClient(), await api.createClient()],
      clock: api.clock,
      processor: api.processor,
      turnsRepository: api.turnsRepository,
    })
    expect(before.turn).toBe(12)
    expect(source.strength).toBe(50)
    expect(before.resources).toMatchObject({ INFLUENCE: { total: 30 }, METAL: { total: 0 }, FUEL: { total: 5 }, COLONY: { total: 0 } })
    // Act
    const results = await Promise.allSettled([
      attacker.submitDefinition(ColonizeStationedPlanetStandard.id, { fleet: source.id, planet: destination.id }),
      attacker.move("MOVE_FLEET_STANDARD_1", amount, sibling.id),
    ])
    const submitted = await attacker.view()
    // Assert
    const rejected = results.filter((result): result is PromiseRejectedResult => result.status === "rejected")
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(2)
    expect(rejected.map((result) => result.reason)).toStrictEqual([])
    expect([0]).toContain(submitted.fleets.find((fleet) => fleet.id === source.id)?.uncommittedStrength)

    await expect(attacker.move("MOVE_FLEET_STANDARD_1", 31, sibling.id)).rejects.toMatchObject({
      data: { code: "BAD_REQUEST" },
      message: expect.stringContaining("shortfall 1"),
    })
    await attacker.cancel("COLONIZE_STATIONED_PLANET_STANDARD_1")
    expect((await attacker.view()).fleets.find((fleet) => fleet.id === source.id)?.uncommittedStrength).toBe(20)
    await attacker.submitDefinition(ColonizeStationedPlanetStandard.id, { fleet: source.id, planet: destination.id })
    expect(await attacker.endTurn()).toBe("processed")
    const final = await attacker.view()
    expect(final.galaxy.systems.flatMap((system) => system.planets).find((planet) => planet.id === destination.id)?.ownerPlayerId).toBe(
      before.player.id,
    )
    expect(final.fleets.find((fleet) => fleet.id === source.id)).toBeUndefined()
    expect(
      final.fleets.filter((fleet) => fleet.ownerPlayerId === before.player.id).find((fleet) => fleet.originPlanetId === sibling.id)
        ?.strength,
    ).toBe(30)
    expect(final.resources).toMatchObject({ INFLUENCE: { total: 2 }, METAL: { total: 0 }, FUEL: { total: 4 }, COLONY: { total: 0 } })
  })

  it("should real PG stationary20 and simultaneous Move31 serialize source50", { timeout: 120000 }, async () => {
    const amount = 31
    // Arrange: normal public funding/build/travel/fuel actions only.
    await using api = await ControlledConcurrencyTestApiServer.create()
    const { attacker, destination, sibling, before, source } = await createStationaryColonizationActionsScenario({
      players: [await api.createClient(), await api.createClient()],
      clock: api.clock,
      processor: api.processor,
      turnsRepository: api.turnsRepository,
    })
    expect(before.turn).toBe(12)
    expect(source.strength).toBe(50)
    expect(before.resources).toMatchObject({ INFLUENCE: { total: 30 }, METAL: { total: 0 }, FUEL: { total: 5 }, COLONY: { total: 0 } })
    // Act
    const results = await Promise.allSettled([
      attacker.submitDefinition(ColonizeStationedPlanetStandard.id, { fleet: source.id, planet: destination.id }),
      attacker.move("MOVE_FLEET_STANDARD_1", amount, sibling.id),
    ])
    const submitted = await attacker.view()
    // Assert
    const rejected = results.filter((result): result is PromiseRejectedResult => result.status === "rejected")
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1)
    expect(rejected.map((result) => result.reason)).toStrictEqual([
      expect.objectContaining({ data: expect.objectContaining({ code: "BAD_REQUEST" }), message: expect.stringContaining("shortfall 1") }),
    ])
    expect([19, 30]).toContain(submitted.fleets.find((fleet) => fleet.id === source.id)?.uncommittedStrength)
  })

  it("should real PG claimed-during-journey reload keeps loser35 and owner15 without refund", { timeout: 120000 }, async () => {
    // Arrange
    await using api = await ControlledConcurrencyTestApiServer.create()
    const { attacker, defender, destination, before, gameId } = await createColonizationActionsScenario({
      players: [await api.createClient(), await api.createClient()],
      clock: api.clock,
      processor: api.processor,
      turnsRepository: api.turnsRepository,
    })
    await attacker.move("COLONIZE_PLANET_STANDARD_1", 35, destination.id)
    expect(await attacker.endTurn()).toBe("processed")
    await defender.move("COLONIZE_PLANET_STANDARD_1", 35, destination.id)
    expect(await attacker.endTurn()).toBe("processed")
    const journey = await defender.view()
    expect(journey.fleets.find((fleet) => fleet.movement !== undefined)).toMatchObject({ strength: 35, distanceToEnd: 7.703963225688675 })
    // Act
    const processor = await api.recreateProcessor()
    api.clock.increment({ time: Time.create(10, UnitOfTime.SECONDS) })
    await api.turnsRepository.markDueTurnsAwaitingProcessing({ since: api.clock.now() })
    expect(await processor.processNextDueTurn()).toBe("processed")
    const final = await defender.view(),
      winner = await attacker.view(),
      saved = await api.observeWorkerPersistence(gameId)
    // Assert
    expect(final.galaxy).toStrictEqual(winner.galaxy)
    expect(final.galaxy.systems.flatMap((system) => system.planets).find((planet) => planet.id === destination.id)).toStrictEqual({
      ...destination,
      ownerPlayerId: before.player.id,
    })
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
    for (const view of [final, winner]) {
      expect(view.fleets.every((fleet) => fleet.movement === undefined)).toBe(true)
      expect(view.resources).toMatchObject({ INFLUENCE: { total: 4 }, METAL: { total: 3 }, FUEL: { total: 1 }, COLONY: { total: 0 } })
      expect(view.actions.find((action) => action.id === "COLONIZE_PLANET_STANDARD_1")).toMatchObject({
        status: "AVAILABLE",
        canAffordResources: false,
      })
    }
    expect(saved.fleets.map((fleet) => [fleet.movement, fleet.destinationPlanetId, fleet.distanceToEnd])).toStrictEqual(
      saved.fleets.map(() => [null, null, null]),
    )
    expect(await processor.processNextDueTurn()).toBe("idle")
    expect(await api.observeWorkerPersistence(gameId)).toStrictEqual(saved)
  })

  it.each([
    { strength: 20, expected: [] },
    { strength: 21, expected: [{ strength: 1, movement: null, destinationPlanetId: null, distanceToEnd: null }] },
  ])(
    "should real PG exact threshold%s saved arrival deletes zero and explicitly clears journey",
    { timeout: 120000 },
    async ({ strength, expected }) => {
      // Arrange
      await using api = await ControlledConcurrencyTestApiServer.create()
      const { attacker, destination, before, gameId } = await createColonizationActionsScenario({
        players: [await api.createClient(), await api.createClient()],
        clock: api.clock,
        processor: api.processor,
        turnsRepository: api.turnsRepository,
      })
      await attacker.move("COLONIZE_PLANET_STANDARD_1", strength, destination.id)
      expect(await attacker.endTurn()).toBe("processed")
      const departed = await attacker.view()
      expect(departed.fleets.find((fleet) => fleet.movement !== undefined)).toMatchObject({ strength, distanceToEnd: 7.77754335587613 })
      // Act
      const processor = await api.recreateProcessor()
      api.clock.increment({ time: Time.create(10, UnitOfTime.SECONDS) })
      await api.turnsRepository.markDueTurnsAwaitingProcessing({ since: api.clock.now() })
      expect(await processor.processNextDueTurn()).toBe("processed")
      const saved = await api.observeWorkerPersistence(gameId)
      // Assert
      expect(saved.planets.find((planet) => planet.id === destination.id)?.ownerPlayerId).toBe(before.player.id)
      const stations = saved.fleets
        .filter((fleet) => fleet.ownerPlayerId === before.player.id)
        .filter((fleet) => fleet.originPlanetId === destination.id)
      expect(
        stations.map(({ strength: remaining, movement, destinationPlanetId, distanceToEnd }) => ({
          strength: remaining,
          movement,
          destinationPlanetId,
          distanceToEnd,
        })),
      ).toStrictEqual(expected)
      expect(saved.fleets.every((fleet) => fleet.strength > 0)).toBe(true)
      expect((await attacker.view()).resources).toStrictEqual(departed.resources)
    },
  )

  it("should serialize stationary submission with final readiness and process only the committed set", { timeout: 120000 }, async () => {
    // Arrange
    await using api = await ControlledConcurrencyTestApiServer.create()
    const { attacker, defender, destination, source, before, gameId } = await createStationaryColonizationActionsScenario({
      players: [await api.createClient(), await api.createClient()],
      clock: api.clock,
      processor: api.processor,
      turnsRepository: api.turnsRepository,
    })
    await defender.player.client.gameplay.updateReadiness.mutate({ gameId, turn: before.turn, isReady: true })
    // Act
    const [submission, closure] = await Promise.allSettled([
      attacker.submitDefinition(ColonizeStationedPlanetStandard.id, { fleet: source.id, planet: destination.id }),
      attacker.player.client.gameplay.updateReadiness.mutate({ gameId, turn: before.turn, isReady: true }),
    ])
    const closed = await attacker.view()
    const processed = await api.processor.processNextDueTurn()
    const final = await attacker.view()
    // Assert
    expect(closure.status).toBe("fulfilled")
    expect(closed.turnStatus).toBe("AWAITING_PROCESSING")
    expect(closed.actions.find((action) => action.id === "COLONIZE_STATIONED_PLANET_STANDARD_1")?.status).toBe(
      { fulfilled: "SUBMITTED", rejected: "AVAILABLE" }[submission.status],
    )
    expect(processed).toBe("processed")
    expect(
      final.galaxy.systems.flatMap((system) => system.planets).find((planet) => planet.id === destination.id)?.ownerPlayerId ===
        before.player.id,
    ).toBe({ fulfilled: true, rejected: false }[submission.status])
    expect(final.fleets.find((fleet) => fleet.id === source.id)?.strength).toBe({ fulfilled: 30, rejected: 50 }[submission.status])
    expect(final.resources.INFLUENCE.total).toBe({ fulfilled: 5, rejected: 30 }[submission.status])
    expect(final.actions.find((action) => action.id === "COLONIZE_STATIONED_PLANET_STANDARD_1")?.status).toBe("AVAILABLE")
    const rejected = [submission, closure].filter((result): result is PromiseRejectedResult => result.status === "rejected")
    for (const result of rejected) expect(result.reason).toMatchObject({ data: { code: "BAD_REQUEST" } })
    api.clock.increment({ time: Time.create(10, UnitOfTime.SECONDS) })
    const [late, promotion] = await Promise.allSettled([
      attacker.player.client.gameplay.updateActionSubmission.mutate({
        gameId,
        turn: final.turn,
        submittedActionTargets: {
          actionId: "COLONIZE_STATIONED_PLANET_STANDARD_1",
          selectedTargets: { fleet: source.id, planet: destination.id },
          selectedInputs: {},
        },
      }),
      api.turnsRepository.markDueTurnsAwaitingProcessing({ since: api.clock.now() }),
    ])
    expect(late).toStrictEqual({
      status: "rejected",
      reason: expect.objectContaining({ data: expect.objectContaining({ code: "BAD_REQUEST" }) }),
    })
    expect(promotion.status).toBe("fulfilled")
  })
})
