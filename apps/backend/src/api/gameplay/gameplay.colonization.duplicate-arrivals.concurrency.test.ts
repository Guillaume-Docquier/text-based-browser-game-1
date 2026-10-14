import { Assert } from "@guillaume-docquier/tools-ts"
import { typedParse } from "@guillaume-docquier/tools-ts/schemas"
import { eq } from "drizzle-orm"
import { GameIdSchema } from "shared/domain/games/GameId.ts"
import { ResourceType } from "shared/domain/resources/ResourceType.ts"
import { ColonizeHereTest } from "shared/testing/test-ruleset/action-definitions/colonize.ts"
import { MoveFleetExceptional, MoveFleetStandard } from "shared/testing/test-ruleset/action-definitions/move-fleet.ts"
import { describe, expect, it } from "vitest"
import { turnsTable } from "#lib/db/schema.ts"
import { ConcurrencyTestApiServer } from "#tests/ConcurrencyTestApiServer.ts"
import {
  stagePublicMergeScenario,
  getPlanets,
  getFleetAt,
  processTurn,
  captureWorkerInput,
  canonicalizeResolvedTurn,
  replayWorkerInputWithState,
} from "../../tests/colonization/gameplay.colonization.scenarios.ts"
import {
  BuildFleet35,
  ColonizeFleetSpeed2,
  ColonizeFleetSpeed4,
  required,
  hasPreventedOrColonized,
  isActionSelected,
  startTogether,
  submitAction,
  readViews,
  createPublicTwoPlayerFixture,
} from "../../tests/colonization/gameplay.colonization.ts"
import { assertLockedView, assertRemainingAtTarget } from "../../tests/fleet-assertions/gameplay.colonization.renamed-content-2.ts"
import {
  assertMergedFriendly,
  assertPersistedNextRngState3,
  assertRaceObservation,
} from "../../tests/fleet-assertions/gameplay.colonization.renamed-content.ts"

describe("public Colonization worker companions", () => {
  it("should resolve duplicate public colonization arrivals once after merging and preserve order invariance", async () => {
    await using server = await ConcurrencyTestApiServer.create()
    const fixture = await createPublicTwoPlayerFixture(server)
    const { alice, clients, gameId, clock, turnProcessor, turnsRepository, homeA, target } = fixture
    const staged = await stagePublicMergeScenario(server, fixture)
    let views = staged.views
    const { stagedFriendly, aliceSource } = staged

    const speed4ActionId = await submitAction({
      client: alice.client,
      gameId,
      view: required(views[0]),
      actionDefinitionId: ColonizeFleetSpeed4.id,
      selectedTargets: { fleet: aliceSource.id, planet: target.id },
      selectedInputs: { strength: 20 },
    })
    const speed2ActionId = await submitAction({
      client: alice.client,
      gameId,
      view: required(views[0]),
      actionDefinitionId: ColonizeFleetSpeed2.id,
      selectedTargets: { fleet: aliceSource.id, planet: target.id },
      selectedInputs: { strength: 20 },
    })
    const selectedViews = await readViews(clients, gameId)
    expect(required(selectedViews[0]).resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 493, uncommitted: 443 })
    expect(required(selectedViews[0]).resources[ResourceType.FUEL]).toStrictEqual({ total: 95, uncommitted: 95 })
    expect(getFleetAt(required(selectedViews[0]), required(selectedViews[0]).player.id, homeA.id, 50).id).toBe(aliceSource.id)

    const finalTurnInput = await captureWorkerInput({
      server,
      clock,
      turnsRepository,
      gameId,
      turn: required(selectedViews[0]).turn,
    })
    const finalReplay = replayWorkerInputWithState(finalTurnInput)
    const reversedReplay = replayWorkerInputWithState(finalTurnInput, true)
    Assert.isSuccess(finalReplay.resolved)
    Assert.isSuccess(reversedReplay.resolved)
    expect(canonicalizeResolvedTurn(reversedReplay.resolved.value)).toStrictEqual(canonicalizeResolvedTurn(finalReplay.resolved.value))
    expect(reversedReplay.nextRngState).toStrictEqual(finalReplay.nextRngState)
    expect(finalReplay.nextRngState).toStrictEqual(finalTurnInput.rngState)
    const publicReplay = finalReplay.resolved.value
    const firstOutcome = required(publicReplay.resolvedActions.find(({ submittedAction }) => submittedAction.id === speed4ActionId))
    const secondOutcome = required(publicReplay.resolvedActions.find(({ submittedAction }) => submittedAction.id === speed2ActionId))
    expect(firstOutcome?.actionOutcomes.at(-1)).toMatchObject({
      type: "RESOLVED",
      result: expect.stringContaining(' colonized Planet "planet 649967" with 20 Strength'),
    })
    expect(secondOutcome.actionOutcomes.at(-1)).toMatchObject({ type: "PREVENTED", reason: "Planet is already claimed" })
    for (const actionOutcomes of [firstOutcome.actionOutcomes, secondOutcome.actionOutcomes]) {
      expect(actionOutcomes.filter((outcome) => hasPreventedOrColonized(outcome))).toHaveLength(1)
    }
    const mergedFriendly = publicReplay.fleets[stagedFriendly.id]
    Assert.isDefined(mergedFriendly)

    const updatedVerifyMergedFriendly = await assertMergedFriendly({
      mergedFriendly,
      stagedFriendly,
      selectedViews,
      target,
      publicReplay,
      aliceSource,
      homeA,
      turnProcessor,
      views,
      clients,
      gameId,
      speed4ActionId,
      speed2ActionId,
    })
    views = updatedVerifyMergedFriendly.views

    const savedTurns = await server.database
      .select()
      .from(turnsTable)
      .where(eq(turnsTable.gameId, typedParse(GameIdSchema, gameId)))
    const savedNextTurn = savedTurns.find(({ turn }) => turn === required(selectedViews[0]).turn + 1)
    Assert.isDefined(savedNextTurn)

    assertPersistedNextRngState3({
      savedNextTurn,
      finalTurnInput,
      gameId,
      views,
      homeA,
      target,
      stagedFriendly,
      speed4ActionId,
      speed2ActionId,
      mergedFriendly,
      finalReplay,
      reversedReplay,
    })
  })

  it("should serialize aggregate Move and stationary Colonize reservations against PostgreSQL and Turn closure", async () => {
    await using server = await ConcurrencyTestApiServer.create()
    const fixture = await createPublicTwoPlayerFixture(server)
    const { alice, bob, gameId, clock, turnProcessor, turnsRepository, homeA, target } = fixture
    const buildView = required(fixture.views[0])
    await submitAction({
      client: alice.client,
      gameId,
      view: buildView,
      actionDefinitionId: BuildFleet35.id,
      selectedTargets: { planet: homeA.id },
      selectedInputs: {},
    })
    const builtView = await processTurn({
      clock,
      turnsRepository,
      turnProcessor,
      client: alice.client,
      gameId,
      turn: buildView.turn,
    })
    const homeFleet = getFleetAt(builtView, builtView.player.id, homeA.id, 35)
    const moveToTargetId = await submitAction({
      client: alice.client,
      gameId,
      view: builtView,
      actionDefinitionId: MoveFleetExceptional.id,
      selectedTargets: { fleet: homeFleet.id, planet: target.id },
      selectedInputs: { strength: 35 },
    })
    const arrivedView = await processTurn({
      clock,
      turnsRepository,
      turnProcessor,
      client: alice.client,
      gameId,
      turn: builtView.turn,
    })
    const stationary = getFleetAt(arrivedView, arrivedView.player.id, target.id, 35)
    expect(getPlanets(arrivedView).find(({ id }) => id === target.id)?.ownerPlayerId).toBeNull()
    expect(arrivedView.actions.find(({ id }) => id === moveToTargetId)).toMatchObject({ selectedTargets: null, isInProgress: false })
    const moveAction = arrivedView.actions.find(({ actionDefinitionId }) => actionDefinitionId === MoveFleetStandard.id)
    const colonizeAction = arrivedView.actions.find(({ actionDefinitionId }) => actionDefinitionId === ColonizeHereTest.id)
    Assert.isDefined(moveAction)
    Assert.isDefined(colonizeAction)

    const raceGate = startTogether(2)
    const race = await Promise.allSettled([
      (async (): Promise<void> => {
        await raceGate()
        await alice.client.gameplay.updateActionSubmission.mutate({
          gameId,
          turn: arrivedView.turn,
          submittedActionTargets: {
            actionId: moveAction.id,
            selectedTargets: { fleet: stationary.id, planet: homeA.id },
            selectedInputs: { strength: 16 },
          },
        })
      })(),
      (async (): Promise<void> => {
        await raceGate()
        await alice.client.gameplay.updateActionSubmission.mutate({
          gameId,
          turn: arrivedView.turn,
          submittedActionTargets: {
            actionId: colonizeAction.id,
            selectedTargets: { fleet: stationary.id, planet: target.id },
            selectedInputs: {},
          },
        })
      })(),
    ])
    expect(race.filter(({ status }) => status === "fulfilled")).toHaveLength(1)
    expect(race.filter(({ status }) => status === "rejected")).toHaveLength(1)

    let selectedView = await alice.client.gameplay.getPlayerView.query({ gameId })
    const selectedMove = selectedView.actions.find(({ id }) => id === moveAction.id)
    const selectedColonize = selectedView.actions.find(({ id }) => id === colonizeAction.id)
    Assert.isDefined(selectedMove)
    Assert.isDefined(selectedColonize)
    const winningAction = required(selectedView.actions.find(isActionSelected))
    const beforeClosure = {
      influence: selectedView.resources[ResourceType.INFLUENCE],
      fuel: selectedView.resources[ResourceType.FUEL],
    }

    const updatedVerifyRaceObservation = await assertRaceObservation({
      selectedMove,
      selectedColonize,
      beforeClosure,
      winningAction,
      stationary,
      homeA,
      arrivedView,
      moveAction,
      target,
      colonizeAction,
      alice,
      gameId,
      bob,
      selectedView,
    })
    selectedView = updatedVerifyRaceObservation.selectedView

    const closureColonize = selectedView.actions.find(({ id }) => id === colonizeAction.id)
    Assert.isDefined(closureColonize)
    expect(selectedView.resources[ResourceType.INFLUENCE].uncommitted).toBe(selectedView.resources[ResourceType.INFLUENCE].total)
    expect(selectedView.resources[ResourceType.FUEL].uncommitted).toBe(selectedView.resources[ResourceType.FUEL].total)

    const closureGate = startTogether(3)
    const closureRace = await Promise.allSettled([
      (async (): Promise<void> => {
        await closureGate()
        await alice.client.gameplay.updateActionSubmission.mutate({
          gameId,
          turn: selectedView.turn,
          submittedActionTargets: {
            actionId: closureColonize.id,
            selectedTargets: { fleet: stationary.id, planet: target.id },
            selectedInputs: {},
          },
        })
      })(),
      (async (): Promise<void> => {
        await closureGate()
        await alice.client.gameplay.updateReadiness.mutate({ gameId, turn: selectedView.turn, isReady: true })
      })(),
      (async (): Promise<void> => {
        await closureGate()
        await bob.client.gameplay.updateReadiness.mutate({ gameId, turn: selectedView.turn, isReady: true })
      })(),
    ])
    expect(closureRace[1]?.status).toBe("fulfilled")
    expect(closureRace[2]?.status).toBe("fulfilled")
    const closureSubmissionStatus = required(closureRace[0]).status

    await assertLockedView({ alice, gameId, closureColonize, closureSubmissionStatus, selectedView, stationary, target, turnProcessor })

    let completedView = await alice.client.gameplay.getPlayerView.query({ gameId })
    await expect
      .poll(async () => (await alice.client.gameplay.getPlayerView.query({ gameId })).turn, { timeout: 20_000, interval: 25 })
      .toBe(selectedView.turn + 1)
    completedView = await alice.client.gameplay.getPlayerView.query({ gameId })
    const claimedPlanet = getPlanets(completedView).find(({ id }) => id === target.id)
    Assert.isDefined(claimedPlanet)

    assertRemainingAtTarget({
      completedView,
      target,
      closureSubmissionStatus,
      claimedPlanet,
      selectedView,
      closureColonize,
      gameId,
      stationary,
      race,
      beforeClosure,
      closureRace,
    })
  })
})
