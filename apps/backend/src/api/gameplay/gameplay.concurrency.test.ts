import { Assert, branded, Logger, mulberry32Prng, Time, UnitOfTime, type DeepUnbranded } from "@guillaume-docquier/tools-ts"
import { eq } from "drizzle-orm"
import { createGameConfigurationStub } from "shared/domain/games/GameConfiguration.stub.ts"
import type { PlayerId } from "shared/domain/players/PlayerId.ts"
import { ResourceType } from "shared/domain/resources/ResourceType.ts"
import type { ActionDefinitionId } from "shared/domain/ruleset/action-definitions/ActionDefinitionId.ts"
import { ColonizeHereTest } from "shared/testing/test-ruleset/action-definitions/colonize.ts"
import { MoveFleetExceptional } from "shared/testing/test-ruleset/action-definitions/move-fleet.ts"
import { describe, expect, it } from "vitest"
import type { SubmittedActionTargetsDto } from "#api/gameplay/SubmittedActionTargetsDto.ts"
import type { PlayerView } from "#api/types.ts"
import { ControlledClock } from "#lib/ControlledClock.ts"
import { TransactionRollbackError } from "#lib/db/drizzle/TransactionRollbackError.ts"
import { turnsTable } from "#lib/db/schema.ts"
import { RulesetsRepository } from "#lib/rulesets/rulesets.repository.ts"
import type { AuthenticatedApiClient } from "#tests/ApiClient.ts"
import { ConcurrencyTestApiServer } from "#tests/ConcurrencyTestApiServer.ts"
import { createTurnProcessorStub } from "#turn-processing/TurnProcessor.stub.ts"
import type { TurnToProcessModel } from "#turn-processing/turns.repository.ts"
import {
  workerTieFundingRounds,
  markManualDeadlineDue,
  processManualDeadlineTurn,
} from "../../tests/fleet-concurrency/gameplay.scenarios.ts"
import {
  MANUAL_WORKER_TURN_INTERVAL,
  WorkerBuildFleetForty,
  PostgresColonizeWorkerRuleset,
  ColonizePlanetSpeedFive,
  PostgresColonizeTickZeroPriorityRuleset,
  publicTickZeroPriorityScenarios,
  findStationaryFleetAt,
  fundingTargetsFor,
  replayWorkerInput,
  reverseWorkerInputEnumeration,
  expectedTwoPlayerTieWinner,
  findViewForPlayer,
  tieWinnerForce,
} from "../../tests/fleet-concurrency/gameplay.ts"

describe("gameplay submission concurrency", () => {
  it("should persist a natural tick-zero Colonize tie through the public worker and reload", async () => {
    await using server = await ConcurrencyTestApiServer.create()
    const clock = new ControlledClock({ startDate: new Date() })
    const rulesetsRepository = new RulesetsRepository({ db: server.database, logger: Logger.get() })
    Assert.isSuccess(await rulesetsRepository.upsertRuleset(PostgresColonizeWorkerRuleset))
    const alice = await server.createClient({ authenticated: true, id: "00000000-0000-4000-8000-000000000001" })
    const bob = await server.createClient({ authenticated: true, id: "00000000-0000-4000-8000-000000000002" })

    const { createdGameId: gameId } = await alice.client.games.create.mutate({
      configuration: createGameConfigurationStub({
        rulesetId: PostgresColonizeWorkerRuleset.id,
        nbSeats: 2,
        turnIntervalSeconds: Time.in(MANUAL_WORKER_TURN_INTERVAL, UnitOfTime.SECONDS),
        mapGenerationSeed: 147,
      }),
    })
    await bob.client.games.join.mutate({ gameId })
    await alice.client.games.startGame.mutate({ gameId })

    const { createdGameId: untouchedGameId } = await alice.client.games.create.mutate({
      configuration: createGameConfigurationStub({
        rulesetId: PostgresColonizeWorkerRuleset.id,
        nbSeats: 2,
        turnIntervalSeconds: Time.in(Time.create(30, UnitOfTime.DAYS), UnitOfTime.SECONDS),
        mapGenerationSeed: 147,
      }),
    })
    await bob.client.games.join.mutate({ gameId: untouchedGameId })
    await alice.client.games.startGame.mutate({ gameId: untouchedGameId })

    const { turnProcessor, turnsRepository } = await createTurnProcessorStub({ db: server.database, clock })
    const clients = [alice, bob] as const
    const readViews = async (): Promise<[PlayerView, PlayerView]> =>
      await Promise.all([alice.client.gameplay.getPlayerView.query({ gameId }), bob.client.gameplay.getPlayerView.query({ gameId })])
    const submit = async (
      client: AuthenticatedApiClient["client"],
      view: PlayerView,
      actionDefinitionId: ActionDefinitionId,
      selectedTargets: DeepUnbranded<SubmittedActionTargetsDto["selectedTargets"]>,
      selectedInputs: DeepUnbranded<SubmittedActionTargetsDto["selectedInputs"]>,
    ): Promise<string> => {
      const action = view.actions.find(({ actionDefinitionId: definitionId }) => definitionId === actionDefinitionId)
      Assert.isDefined(action)
      await client.gameplay.updateActionSubmission.mutate({
        gameId,
        turn: view.turn,
        submittedActionTargets: { actionId: action.id, selectedTargets, selectedInputs },
      })
      return action.id
    }
    const processDeadlineTurn = async (turn: number): Promise<void> => {
      await processManualDeadlineTurn({ clock, turnProcessor, turnsRepository, client: alice.client, gameId, turn })
    }

    const initialViews = await readViews()
    const allPlanets = initialViews[0].galaxy.systems.flatMap(({ planets }) => planets)
    const homes = clients.map(({ account }) => allPlanets.find(({ ownerPlayerId }) => ownerPlayerId === branded<PlayerId>(account.id)))
    const homeA = homes[0]
    const homeB = homes[1]
    Assert.isDefined(homeA)
    Assert.isDefined(homeB)
    const target = allPlanets.find(({ coordinates }) => coordinates === "45:80:45")
    Assert.isDefined(target)
    expect([homeA.coordinates, homeB.coordinates].toSorted()).toStrictEqual(["44:98:05", "45:83:40"])
    expect({ id: target.id, name: target.name, x: target.x, y: target.y }).toStrictEqual({
      id: "80784487-ba71-54b9-b7c6-32ca91390a9d",
      name: "planet 907284",
      x: 50.87043629812449,
      y: 48.287412347151275,
    })
    const distances = [homeA, homeB].map((home) => Math.hypot(home.x - target.x, home.y - target.y))
    expect(distances).toStrictEqual([2.404059226669645, 2.4665348802971394])
    expect(target.ownerPlayerId).toBeNull()

    const untouchedInitialView = await alice.client.gameplay.getPlayerView.query({ gameId: untouchedGameId })
    const untouchedTarget = untouchedInitialView.galaxy.systems.flatMap(({ planets }) => planets).find(({ id }) => id === target.id)
    Assert.isDefined(untouchedTarget)

    const verifyUntouchedTargetPhase1 = async (): Promise<void> => {
      expect(untouchedTarget.ownerPlayerId).toBeNull()
      expect(untouchedInitialView.fleets).toStrictEqual([])
      expect(untouchedInitialView.turn).toBe(1)

      // Public funding: ship40 costs2I/1M; the single GainMetal and GainFuel actions cover the supported movement costs.
      for (const fundingRound of workerTieFundingRounds) {
        const views = await readViews()
        for (let ownerIndex = 0; ownerIndex < clients.length; ownerIndex += 1) {
          const client = clients[ownerIndex]
          const view = views[ownerIndex]
          const home = homes[ownerIndex]
          Assert.isDefined(client)
          Assert.isDefined(view)
          Assert.isDefined(home)
          for (const actionDefinitionId of fundingRound.actionDefinitionIds) {
            await submit(client.client, view, actionDefinitionId, fundingTargetsFor(actionDefinitionId, home.id), {})
          }
        }
        await processDeadlineTurn(views[0].turn)
        const afterFundingTurn = await readViews()
        expect(afterFundingTurn.map(({ resources }) => resources[ResourceType.INFLUENCE].total)).toStrictEqual([
          fundingRound.expectedInfluence,
          fundingRound.expectedInfluence,
        ])
      }

      const fundedViews = await readViews()
      for (let ownerIndex = 0; ownerIndex < clients.length; ownerIndex += 1) {
        const client = clients[ownerIndex]
        const view = fundedViews[ownerIndex]
        const home = homes[ownerIndex]
        Assert.isDefined(client)
        Assert.isDefined(view)
        Assert.isDefined(home)
        expect(view.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 53, uncommitted: 53 })
        expect(view.resources[ResourceType.METAL]).toStrictEqual({ total: 4, uncommitted: 4 })
        expect(view.resources[ResourceType.FUEL]).toStrictEqual({ total: 6, uncommitted: 6 })
        const source = findStationaryFleetAt(view, view.player.id, home.id)
        Assert.isDefined(source)
        expect(source.strength).toBe(40)
        await submit(client.client, view, MoveFleetExceptional.id, { fleet: source.id, planet: target.id }, { strength: 35 })
        const selectedView = await client.client.gameplay.getPlayerView.query({ gameId })
        expect(selectedView.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 53, uncommitted: 50 })
        expect(selectedView.resources[ResourceType.FUEL]).toStrictEqual({ total: 6, uncommitted: 1 })
      }
      await processDeadlineTurn(fundedViews[0].turn)
    }
    await verifyUntouchedTargetPhase1()

    const stationedViews = await readViews()
    const stationedFleets = clients.map(({ account }, index) => {
      const view = stationedViews[index]
      Assert.isDefined(view)
      return findStationaryFleetAt(view, branded<PlayerId>(account.id), target.id)
    })
    const stationedA = stationedFleets[0]
    const stationedB = stationedFleets[1]
    Assert.isDefined(stationedA)
    Assert.isDefined(stationedB)
    expect([stationedA.strength, stationedB.strength]).toStrictEqual([35, 35])
    for (const view of stationedViews) {
      expect(view.galaxy.systems.flatMap(({ planets }) => planets).find(({ id }) => id === target.id)?.ownerPlayerId).toBeNull()
      expect(view.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 50, uncommitted: 50 })
      expect(view.resources[ResourceType.FUEL]).toStrictEqual({ total: 1, uncommitted: 1 })
    }

    const colonizeActionIds: string[] = []
    for (let ownerIndex = 0; ownerIndex < clients.length; ownerIndex += 1) {
      const client = clients[ownerIndex]
      const view = stationedViews[ownerIndex]
      const fleet = stationedFleets[ownerIndex]
      Assert.isDefined(client)
      Assert.isDefined(view)
      Assert.isDefined(fleet)
      colonizeActionIds.push(await submit(client.client, view, ColonizeHereTest.id, { fleet: fleet.id, planet: target.id }, {}))
      const selected = await client.client.gameplay.getPlayerView.query({ gameId })
      expect(selected.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 50, uncommitted: 25 })
    }

    const observationView = await alice.client.gameplay.getPlayerView.query({ gameId })
    await markManualDeadlineDue({ clock, turnsRepository })
    let observed: TurnToProcessModel | undefined
    const rollbackMessage = `Intentional C3-10 worker input observation rollback for game ${gameId}`
    await expect(
      server.database.transaction(async (tx) => {
        const turn = await turnsRepository.getNextTurnForProcessing({ since: clock.now() }, tx)
        Assert.isDefined(turn)
        expect(turn.gameId).toBe(gameId)
        expect(turn.turn).toBe(observationView.turn)
        observed = structuredClone(await turnsRepository.startTurnProcessing({ turn, processingStartedAt: clock.now() }, tx))
        throw new TransactionRollbackError(rollbackMessage)
      }),
    ).rejects.toMatchObject({ name: "TransactionRollbackError", message: rollbackMessage })
    Assert.isDefined(observed)
    const observedPreResolutionRngState = observed.rngState

    const verifyObservedPreResolutionRngStatePhase2Observed = observed
    const verifyObservedPreResolutionRngStatePhase2 = (): void => {
      expect(observedPreResolutionRngState.spareNormal).toBeNull()
      expect([alice.account.id, bob.account.id]).toStrictEqual([
        "00000000-0000-4000-8000-000000000001",
        "00000000-0000-4000-8000-000000000002",
      ])
      expect(verifyObservedPreResolutionRngStatePhase2Observed.ruleset.id).toBe(PostgresColonizeWorkerRuleset.id)
      expect(verifyObservedPreResolutionRngStatePhase2Observed.submittedActions.map(({ id }) => id).toSorted()).toStrictEqual(
        [...colonizeActionIds].toSorted(),
      )
      expect(verifyObservedPreResolutionRngStatePhase2Observed.planets[target.id]?.ownerPlayerId).toBeNull()
      expect(
        verifyObservedPreResolutionRngStatePhase2Observed.players[stationedViews[0].player.id]?.resources[ResourceType.INFLUENCE],
      ).toBe(50)
      expect(
        verifyObservedPreResolutionRngStatePhase2Observed.players[stationedViews[1].player.id]?.resources[ResourceType.INFLUENCE],
      ).toBe(50)
      for (const fleet of stationedFleets) {
        Assert.isDefined(fleet)
        expect(verifyObservedPreResolutionRngStatePhase2Observed.fleets[fleet.id]?.strength).toBe(35)
        expect(verifyObservedPreResolutionRngStatePhase2Observed.fleets[fleet.id]?.movement).toBeUndefined()
      }

      const capturedInput = verifyObservedPreResolutionRngStatePhase2Observed
      Logger.get().info("[C3-10 captured input before replay]", {
        targetOwner: capturedInput.planets[target.id]?.ownerPlayerId,
        submissions: capturedInput.submittedActions.map(({ id, playerId, selectedTargets, selectedInputs }) => ({
          id,
          playerId,
          selectedTargets,
          selectedInputs,
        })),
        contenders: stationedFleets.map((fleet) => {
          Assert.isDefined(fleet)
          return {
            id: fleet.id,
            ownerPlayerId: fleet.ownerPlayerId,
            strength: capturedInput.fleets[fleet.id]?.strength,
            ownerState: capturedInput.players[fleet.ownerPlayerId]?.resources[ResourceType.INFLUENCE],
          }
        }),
      })
    }
    verifyObservedPreResolutionRngStatePhase2()

    const forwardReplay = replayWorkerInput(observed)
    const reversedReplay = replayWorkerInput(reverseWorkerInputEnumeration(observed))
    // Independently apply the documented two-entry Fisher-Yates draw to the pinned canonical Alice/Bob order.
    const tieOraclePrng = mulberry32Prng(observedPreResolutionRngState.generatorState)
    const firstTieShuffleDraw = tieOraclePrng.next()
    const expectedOwner = expectedTwoPlayerTieWinner(firstTieShuffleDraw, alice.account.id, bob.account.id)
    const expectedNextRngState = {
      generatorState: tieOraclePrng.getState(),
      spareNormal: observedPreResolutionRngState.spareNormal,
    }
    expect(forwardReplay.resolved.planets[target.id]?.ownerPlayerId).toBe(expectedOwner)
    expect(forwardReplay.rngState).toStrictEqual(expectedNextRngState)
    expect(reversedReplay.resolved.planets[target.id]?.ownerPlayerId).toBe(forwardReplay.resolved.planets[target.id]?.ownerPlayerId)
    expect(reversedReplay.actionOutcomes).toStrictEqual(forwardReplay.actionOutcomes)
    expect(reversedReplay.rngState).toStrictEqual(forwardReplay.rngState)
    expect(forwardReplay.resolved.planetOwnershipChanges).toHaveLength(1)

    expect(await turnProcessor.processNextDueTurn()).toBe("processed")
    const aliceAfter = await alice.client.gameplay.getPlayerView.query({ gameId })
    const bobAfter = await bob.client.gameplay.getPlayerView.query({ gameId })
    const replayOwner = forwardReplay.resolved.planets[target.id]?.ownerPlayerId
    Assert.isDefined(replayOwner)
    expect(replayOwner).toBe(expectedOwner)
    const persistedOwner = aliceAfter.galaxy.systems.flatMap(({ planets }) => planets).find(({ id }) => id === target.id)?.ownerPlayerId
    expect(persistedOwner).toBe(expectedOwner)
    expect(bobAfter.galaxy.systems.flatMap(({ planets }) => planets).find(({ id }) => id === target.id)?.ownerPlayerId).toBe(expectedOwner)
    const alicePlayerId = branded<PlayerId>(alice.account.id)
    const bobPlayerId = branded<PlayerId>(bob.account.id)
    const finalViews = [aliceAfter, bobAfter]
    const aliceFinalView = findViewForPlayer(finalViews, alicePlayerId)
    const bobFinalView = findViewForPlayer(finalViews, bobPlayerId)
    Assert.isDefined(aliceFinalView)
    Assert.isDefined(bobFinalView)
    const aliceSurvivor = findStationaryFleetAt(aliceFinalView, alicePlayerId, target.id)
    const bobSurvivor = findStationaryFleetAt(bobFinalView, bobPlayerId, target.id)
    Assert.isDefined(aliceSurvivor)
    Assert.isDefined(bobSurvivor)
    const finalStrengths = [
      { playerId: alicePlayerId, strength: aliceSurvivor.strength },
      { playerId: bobPlayerId, strength: bobSurvivor.strength },
    ]
    expect(finalStrengths).toHaveLength(2)
    expect(aliceSurvivor.strength).toBe(tieWinnerForce(alicePlayerId, expectedOwner))
    expect(bobSurvivor.strength).toBe(tieWinnerForce(bobPlayerId, expectedOwner))
    for (const view of [aliceAfter, bobAfter]) {
      expect(view.turn).toBe(observationView.turn + 1)
      expect(view.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 25, uncommitted: 25 })
      expect(view.resources[ResourceType.METAL]).toStrictEqual({ total: 4, uncommitted: 4 })
      expect(view.resources[ResourceType.FUEL]).toStrictEqual({ total: 1, uncommitted: 1 })
      expect(view.resources[ResourceType.COLONY]).toStrictEqual({ total: 0, uncommitted: 0 })
      for (const actionId of colonizeActionIds) {
        expect(view.actions.find(({ id }) => id === actionId)).toMatchObject({ selectedTargets: null, isInProgress: false })
      }
    }

    const savedTurns = await server.database.select().from(turnsTable).where(eq(turnsTable.gameId, gameId))
    const savedNextTurn = savedTurns.find(({ turn }) => turn === observationView.turn + 1)
    Assert.isDefined(savedNextTurn)

    const verifyUntouchedAfterPhase3Observed = observed
    const verifyUntouchedAfterPhase3 = async (): Promise<void> => {
      expect({ generatorState: savedNextTurn.rngGeneratorState, spareNormal: savedNextTurn.rngSpareNormal }).toStrictEqual(
        expectedNextRngState,
      )
      expect({ generatorState: savedNextTurn.rngGeneratorState, spareNormal: savedNextTurn.rngSpareNormal }).toStrictEqual(
        forwardReplay.rngState,
      )

      const untouchedAfter = await alice.client.gameplay.getPlayerView.query({ gameId: untouchedGameId })
      expect(untouchedAfter.turn).toBe(untouchedInitialView.turn)
      expect(untouchedAfter.fleets).toStrictEqual([])
      expect(untouchedAfter.resources).toStrictEqual(untouchedInitialView.resources)
      expect(untouchedAfter.galaxy.systems.flatMap(({ planets }) => planets).find(({ id }) => id === target.id)?.ownerPlayerId).toBeNull()

      Logger.get().info("[C3-10 public worker receipt]", {
        gameId,
        untouchedGameId,
        seed: 147,
        target: { id: target.id, name: target.name, coordinates: target.coordinates, x: target.x, y: target.y },
        homes: [homeA, homeB].map((home) => ({ id: home.id, name: home.name, coordinates: home.coordinates })),
        distances,
        observationTurn: observationView.turn,
        loadedRngState: observedPreResolutionRngState,
        loadedPlayers: Object.values(verifyUntouchedAfterPhase3Observed.players).map(({ id, resources }) => ({
          id,
          influence: resources[ResourceType.INFLUENCE],
        })),
        loadedTargetOwner: verifyUntouchedAfterPhase3Observed.planets[target.id]?.ownerPlayerId,
        independentlyPinnedContenders: [alice.account.id, bob.account.id],
        independentFirstTieDraw: firstTieShuffleDraw,
        independentExpectedOwner: expectedOwner,
        independentExpectedNextRngState: expectedNextRngState,
        persistedOwner,
        persistedTargetForces: finalStrengths,
        persistedResources: [aliceAfter, bobAfter].map(({ player, resources }) => ({
          playerId: player.id,
          influence: resources[ResourceType.INFLUENCE].total,
          metal: resources[ResourceType.METAL].total,
          fuel: resources[ResourceType.FUEL].total,
        })),
        persistedNextRngState: { generatorState: savedNextTurn.rngGeneratorState, spareNormal: savedNextTurn.rngSpareNormal },
        replayNextRngState: forwardReplay.rngState,
      })
    }
    await verifyUntouchedAfterPhase3()
  })

  it.each(publicTickZeroPriorityScenarios)(
    "should prefer valid stationary tick-zero Colonize over a positive-tick arrival with $label",
    async ({ movingStrength, buildActionDefinitionId, builtStrength, bobHomeRemainderStrengths }) => {
      // Arrange
      await using server = await ConcurrencyTestApiServer.create()
      const rulesetsRepository = new RulesetsRepository({ db: server.database, logger: Logger.get() })
      Assert.isSuccess(await rulesetsRepository.upsertRuleset(PostgresColonizeTickZeroPriorityRuleset))
      const alice = await server.createClient({ authenticated: true, id: "00000000-0000-4000-8000-000000000061" })
      const bob = await server.createClient({ authenticated: true, id: "00000000-0000-4000-8000-000000000062" })
      const { createdGameId: gameId } = await alice.client.games.create.mutate({
        configuration: createGameConfigurationStub({
          rulesetId: PostgresColonizeTickZeroPriorityRuleset.id,
          nbSeats: 2,
          turnIntervalSeconds: Time.in(MANUAL_WORKER_TURN_INTERVAL, UnitOfTime.SECONDS),
          mapGenerationSeed: 147,
        }),
      })
      await bob.client.games.join.mutate({ gameId })
      await alice.client.games.startGame.mutate({ gameId })
      const clock = new ControlledClock({ startDate: new Date() })
      const { turnProcessor, turnsRepository } = await createTurnProcessorStub({ db: server.database, clock })
      const readViews = async (): Promise<[PlayerView, PlayerView]> =>
        await Promise.all([alice.client.gameplay.getPlayerView.query({ gameId }), bob.client.gameplay.getPlayerView.query({ gameId })])
      const findPlanetOwner = (
        view: PlayerView,
        planetId: PlayerView["galaxy"]["systems"][number]["planets"][number]["id"],
      ): PlayerId | null | undefined =>
        view.galaxy.systems.flatMap(({ planets }) => planets).find(({ id }) => id === planetId)?.ownerPlayerId
      const submitAction = async (
        client: AuthenticatedApiClient["client"],
        view: PlayerView,
        actionDefinitionId: ActionDefinitionId,
        selectedTargets: DeepUnbranded<SubmittedActionTargetsDto["selectedTargets"]>,
        selectedInputs: DeepUnbranded<SubmittedActionTargetsDto["selectedInputs"]>,
      ): Promise<string> => {
        const action = view.actions.find(({ actionDefinitionId: definitionId }) => definitionId === actionDefinitionId)
        Assert.isDefined(action)
        await client.gameplay.updateActionSubmission.mutate({
          gameId,
          turn: view.turn,
          submittedActionTargets: { actionId: action.id, selectedTargets, selectedInputs },
        })
        return action.id
      }
      let views = await readViews()
      const allPlanets = views[0].galaxy.systems.flatMap(({ planets }) => planets)
      const alicePlayerId = branded<PlayerId>(alice.account.id)
      const bobPlayerId = branded<PlayerId>(bob.account.id)
      const homeA = allPlanets.find(({ ownerPlayerId }) => ownerPlayerId === alicePlayerId)
      const homeB = allPlanets.find(({ ownerPlayerId }) => ownerPlayerId === bobPlayerId)
      const target = allPlanets.find(({ coordinates }) => coordinates === "45:80:45")
      Assert.isDefined(homeA)
      Assert.isDefined(homeB)
      Assert.isDefined(target)
      expect([homeA.coordinates, homeB.coordinates].toSorted()).toStrictEqual(["44:98:05", "45:83:40"])
      expect({ id: target.id, name: target.name, x: target.x, y: target.y }).toStrictEqual({
        id: "80784487-ba71-54b9-b7c6-32ca91390a9d",
        name: "planet 907284",
        x: 50.87043629812449,
        y: 48.287412347151275,
      })
      const distances = [homeA, homeB].map((home) => Math.hypot(home.x - target.x, home.y - target.y))
      expect(distances).toStrictEqual([2.404059226669645, 2.4665348802971394])
      expect(target.ownerPlayerId).toBeNull()
      for (const view of views) {
        expect(view.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 100, uncommitted: 100 })
        expect(view.resources[ResourceType.COLONY]).toStrictEqual({ total: 0, uncommitted: 0 })
      }

      const aliceInitialView = views[0]
      const bobInitialView = views[1]
      const buildTurn = aliceInitialView.turn
      await submitAction(alice.client, aliceInitialView, WorkerBuildFleetForty.id, { planet: homeA.id }, {})
      await submitAction(bob.client, bobInitialView, buildActionDefinitionId, { planet: homeB.id }, {})
      await processManualDeadlineTurn({ clock, turnProcessor, turnsRepository, client: alice.client, gameId, turn: buildTurn })
      views = await readViews()
      const aliceBuild = findStationaryFleetAt(views[0], alicePlayerId, homeA.id)
      const bobBuild = findStationaryFleetAt(views[1], bobPlayerId, homeB.id)
      Assert.isDefined(aliceBuild)
      Assert.isDefined(bobBuild)
      expect(aliceBuild.strength).toBe(40)
      expect(bobBuild.strength).toBe(builtStrength)
      expect(findPlanetOwner(views[0], target.id)).toBeNull()

      const stageTurn = views[0].turn
      await submitAction(alice.client, views[0], MoveFleetExceptional.id, { fleet: aliceBuild.id, planet: target.id }, { strength: 35 })
      await processManualDeadlineTurn({ clock, turnProcessor, turnsRepository, client: alice.client, gameId, turn: stageTurn })
      views = await readViews()
      const stagedAlice = findStationaryFleetAt(views[0], alicePlayerId, target.id)
      const stagedAliceHomeRemainder = findStationaryFleetAt(views[0], alicePlayerId, homeA.id)
      const stagedBob = findStationaryFleetAt(views[1], bobPlayerId, homeB.id)
      Assert.isDefined(stagedAlice)
      Assert.isDefined(stagedAliceHomeRemainder)
      Assert.isDefined(stagedBob)
      expect(stagedAlice.strength).toBe(35)
      expect(stagedAliceHomeRemainder.strength).toBe(5)
      expect(stagedBob.strength).toBe(builtStrength)
      expect(findPlanetOwner(views[0], target.id)).toBeNull()

      // Act & Assert
      const priorityTurn = views[0].turn
      const aliceColonizeActionId = await submitAction(
        alice.client,
        views[0],
        ColonizeHereTest.id,
        { fleet: stagedAlice.id, planet: target.id },
        {},
      )
      const bobColonizeActionId = await submitAction(
        bob.client,
        views[1],
        ColonizePlanetSpeedFive.id,
        { fleet: stagedBob.id, planet: target.id },
        { strength: movingStrength },
      )
      const selectedViews = await readViews()
      expect(selectedViews.map(({ resources }) => resources[ResourceType.INFLUENCE])).toStrictEqual([
        { total: 95, uncommitted: 70 },
        { total: 98, uncommitted: 73 },
      ])
      expect(selectedViews.map(({ resources }) => resources[ResourceType.COLONY])).toStrictEqual([
        { total: 0, uncommitted: 0 },
        { total: 0, uncommitted: 0 },
      ])
      expect(findPlanetOwner(selectedViews[0], target.id)).toBeNull()

      await markManualDeadlineDue({ clock, turnsRepository })
      let observed: TurnToProcessModel | undefined
      const rollbackMessage = "Intentional C3-07 worker input observation rollback for game " + gameId
      await expect(
        server.database.transaction(async (tx) => {
          const turn = await turnsRepository.getNextTurnForProcessing({ since: clock.now() }, tx)
          Assert.isDefined(turn)
          expect(turn.gameId).toBe(gameId)
          expect(turn.turn).toBe(priorityTurn)
          observed = structuredClone(await turnsRepository.startTurnProcessing({ turn, processingStartedAt: clock.now() }, tx))
          throw new TransactionRollbackError(rollbackMessage)
        }),
      ).rejects.toMatchObject({ name: "TransactionRollbackError", message: rollbackMessage })
      Assert.isDefined(observed)
      const capturedInput = observed

      const verifyAssertCapturedInputState1Phase4CapturedInput = capturedInput
      const verifyAssertCapturedInputState1Phase4 = (): void => {
        const assertCapturedInputState1 = (): void => {
          expect(verifyAssertCapturedInputState1Phase4CapturedInput.ruleset.id).toBe(PostgresColonizeTickZeroPriorityRuleset.id)
          expect(verifyAssertCapturedInputState1Phase4CapturedInput.planets[target.id]?.ownerPlayerId).toBeNull()
          expect(verifyAssertCapturedInputState1Phase4CapturedInput.players[alicePlayerId]?.resources[ResourceType.INFLUENCE]).toBe(95)
          expect(verifyAssertCapturedInputState1Phase4CapturedInput.players[bobPlayerId]?.resources[ResourceType.INFLUENCE]).toBe(98)
          expect(verifyAssertCapturedInputState1Phase4CapturedInput.fleets[stagedAlice.id]).toMatchObject({
            ownerPlayerId: alicePlayerId,
            originPlanetId: target.id,
            strength: 35,
          })
          expect(verifyAssertCapturedInputState1Phase4CapturedInput.fleets[stagedAlice.id]?.movement).toBeUndefined()
          expect(verifyAssertCapturedInputState1Phase4CapturedInput.fleets[stagedBob.id]).toMatchObject({
            ownerPlayerId: bobPlayerId,
            originPlanetId: homeB.id,
            strength: builtStrength,
          })
          expect(verifyAssertCapturedInputState1Phase4CapturedInput.fleets[stagedBob.id]?.movement).toBeUndefined()
          expect(verifyAssertCapturedInputState1Phase4CapturedInput.submittedActions.map(({ id }) => id).toSorted()).toStrictEqual(
            [aliceColonizeActionId, bobColonizeActionId].toSorted(),
          )
        }
        assertCapturedInputState1()
      }
      verifyAssertCapturedInputState1Phase4()

      const replay = replayWorkerInput(capturedInput)
      expect(replay.resolved.planets[target.id]?.ownerPlayerId).toBe(alicePlayerId)
      expect(replay.resolved.fleets[stagedAlice.id]).toMatchObject({
        ownerPlayerId: alicePlayerId,
        originPlanetId: target.id,
        strength: 15,
      })
      const bobArrivals = Object.values(replay.resolved.fleets).filter(({ strength }) => strength === movingStrength)
      expect(bobArrivals).toHaveLength(1)
      const bobArrival = bobArrivals[0]
      Assert.isDefined(bobArrival)
      expect(bobArrival).toMatchObject({
        ownerPlayerId: bobPlayerId,
        originPlanetId: target.id,
        strength: movingStrength,
        arrivedAtTick: 10,
      })
      expect(bobArrival.movement).toBeUndefined()
      const replayAliceOutcomes = replay.actionOutcomes.find(({ actionId }) => actionId === aliceColonizeActionId)
      const replayBobOutcomes = replay.actionOutcomes.find(({ actionId }) => actionId === bobColonizeActionId)
      Assert.isDefined(replayAliceOutcomes)
      Assert.isDefined(replayBobOutcomes)
      expect(replayAliceOutcomes.outcomes).toContainEqual(
        expect.objectContaining({ type: "RESOLVED", result: expect.stringContaining("colonized Planet") }),
      )
      expect(replayBobOutcomes.outcomes).toContainEqual(expect.objectContaining({ type: "PREVENTED", reason: "Planet is already claimed" }))
      expect(replay.rngState).toStrictEqual(capturedInput.rngState)

      expect(await turnProcessor.processNextDueTurn()).toBe("processed")
      views = await readViews()
      expect(views.map(({ turn }) => turn)).toStrictEqual([priorityTurn + 1, priorityTurn + 1])
      for (const view of views) {
        expect(findPlanetOwner(view, target.id)).toBe(alicePlayerId)
        expect(view.resources[ResourceType.COLONY]).toStrictEqual({ total: 0, uncommitted: 0 })
      }
      const persistedAlice = findStationaryFleetAt(views[0], alicePlayerId, target.id)
      const persistedBob = findStationaryFleetAt(views[1], bobPlayerId, target.id)
      Assert.isDefined(persistedAlice)
      Assert.isDefined(persistedBob)

      const verifyPersistedAlicePhase5 = (): void => {
        expect(persistedAlice).toMatchObject({ id: stagedAlice.id, strength: 15 })
        expect(persistedBob).toMatchObject({ id: bobArrival.id, strength: movingStrength })
        const bobHomeFleets = views[1].fleets.filter(({ originPlanetId }) => originPlanetId === homeB.id)
        const assertScenarioState2 = (): void => {
          expect(
            bobHomeFleets
              .map(({ ownerPlayerId, movement, strength }) => ({ ownerPlayerId, movement, strength }))
              .toSorted((first, second) => first.strength - second.strength),
          ).toStrictEqual(
            bobHomeRemainderStrengths.map((strength) => ({
              ownerPlayerId: bobPlayerId,
              movement: undefined,
              strength,
            })),
          )
          expect(views[0].resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 70, uncommitted: 70 })
          expect(views[1].resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 73, uncommitted: 73 })
          expect(views[0].resources[ResourceType.METAL]).toStrictEqual({ total: 99, uncommitted: 99 })
          expect(views[1].resources[ResourceType.METAL]).toStrictEqual({ total: 99, uncommitted: 99 })
          expect(views[0].resources[ResourceType.FUEL]).toStrictEqual({ total: 95, uncommitted: 95 })
          expect(views[1].resources[ResourceType.FUEL]).toStrictEqual({ total: 100, uncommitted: 100 })
          expect(views[0].actions.find(({ id }) => id === aliceColonizeActionId)).toMatchObject({
            selectedTargets: null,
            isInProgress: false,
          })
          expect(views[1].actions.find(({ id }) => id === bobColonizeActionId)).toMatchObject({
            selectedTargets: null,
            isInProgress: false,
          })
        }
        assertScenarioState2()
      }
      verifyPersistedAlicePhase5()

      const savedTurns = await server.database.select().from(turnsTable).where(eq(turnsTable.gameId, gameId))
      const savedNextTurn = savedTurns.find(({ turn }) => turn === priorityTurn + 1)
      Assert.isDefined(savedNextTurn)

      const verifyPersistedNextRngStatePhase6CapturedInput = capturedInput
      const verifyPersistedNextRngStatePhase6 = (): void => {
        const persistedNextRngState = { generatorState: savedNextTurn.rngGeneratorState, spareNormal: savedNextTurn.rngSpareNormal }
        expect(persistedNextRngState).toStrictEqual(verifyPersistedNextRngStatePhase6CapturedInput.rngState)
        expect(persistedNextRngState).toStrictEqual(replay.rngState)

        Logger.get().info("[C3-07 public tick-zero priority receipt]", {
          gameId,
          seed: 147,
          movingStrength,
          homes: [homeA, homeB].map(({ id, name, coordinates }) => ({ id, name, coordinates })),
          target: { id: target.id, name: target.name, coordinates: target.coordinates, x: target.x, y: target.y },
          routeDistances: { aliceStage: distances[0], bobColonize: distances[1] },
          stagedForces: { aliceAtTarget: stagedAlice.strength, bobBeforeDeparture: stagedBob.strength },
          attempts: {
            alice: { actionId: aliceColonizeActionId, selectedStrength: 35, tick: 0 },
            bob: { actionId: bobColonizeActionId, selectedStrength: movingStrength, speed: 5, tick: 10 },
          },
          replay: {
            owner: replay.resolved.planets[target.id]?.ownerPlayerId,
            outcomes: replay.actionOutcomes,
            nextRngState: replay.rngState,
          },
          persisted: {
            owner: findPlanetOwner(views[0], target.id),
            aliceForce: persistedAlice.strength,
            bobForce: persistedBob.strength,
            influence: views.map(({ resources }) => resources[ResourceType.INFLUENCE].total),
            colony: views.map(({ resources }) => resources[ResourceType.COLONY].total),
            nextRngState: persistedNextRngState,
          },
        })
      }
      verifyPersistedNextRngStatePhase6()
    },
  )
})
