import { Assert } from "@guillaume-docquier/tools-ts"
import { compareOrdinalStrings } from "shared/domain/compareOrdinalStrings.ts"
import { createGameConfigurationStub } from "shared/domain/games/GameConfiguration.stub.ts"
import type { GameId } from "shared/domain/games/GameId.ts"
import { ResourceType } from "shared/domain/resources/ResourceType.ts"
import { SeedOutpostTest } from "shared/testing/test-ruleset/action-definitions/colonize.ts"
import { describe, expect } from "vitest"
import { createApiStub } from "#api/createApi.stub.ts"
import { createSubmittedActionTargetsDtoStub } from "#api/gameplay/SubmittedActionTargetsDto.stub.ts"
import type { Planet, PlayerView, Action, Fleet } from "#api/types.ts"
import { ControlledClock } from "#lib/ControlledClock.ts"
import type { AuthenticatedApiClient } from "#tests/ApiClient.ts"
import { ApiServer } from "#tests/ApiServer.ts"
import { integrationTest } from "#tests/vitest.integration.fixture.ts"
import { createTurnProcessorStub } from "#turn-processing/TurnProcessor.stub.ts"
import type { TurnProcessor } from "#turn-processing/TurnProcessor.ts"
import type { TurnsRepository } from "#turn-processing/turns.repository.ts"
import {
  processNextRouterTurn,
  PublicSeedOutpostBuildSixty,
  PublicSeedOutpostApiRuleset,
} from "../../tests/fleet-gameplay/gameplay.router.ts"

describe("Seed Outpost API boundary", () => {
  integrationTest("should reserve two public Seed Outpost instances and persist exact-threshold colonizations", async ({ db }) => {
    // Arrange: use public content, repositories, API routes, and the production worker.
    const clock = new ControlledClock()
    const apiServices = await createApiStub({ db, clock })
    Assert.isSuccess(await apiServices.rulesetsRepository.upsertRuleset(PublicSeedOutpostApiRuleset))
    using apiServer = new ApiServer(apiServices)
    const player = await apiServer.createClient({ authenticated: true })
    const { createdGameId } = await player.client.games.create.mutate({
      configuration: createGameConfigurationStub({
        rulesetId: PublicSeedOutpostApiRuleset.id,
        nbSeats: 1,
        mapGenerationSeed: 1234,
        turnIntervalSeconds: 10,
      }),
    })
    await player.client.games.startGame.mutate({ gameId: createdGameId })
    const { turnProcessor, turnsRepository } = await createTurnProcessorStub({ db, clock })
    let view = await player.client.gameplay.getPlayerView.query({ gameId: createdGameId })
    const planets = view.galaxy.systems.flatMap(({ planets: systemPlanets }) => systemPlanets)
    const home = planets.find(({ ownerPlayerId }) => ownerPlayerId === view.player.id)
    Assert.isDefined(home)
    const routeCandidates = planets
      .filter(({ id, ownerPlayerId }) => id !== home.id && ownerPlayerId === null)
      .map((site) => ({ site, distance: Math.hypot(home.x - site.x, home.y - site.y) }))
      .toSorted((first, second) => {
        const distanceOrder = first.distance - second.distance
        return distanceOrder === 0 ? compareOrdinalStrings(first.site.coordinates, second.site.coordinates) : distanceOrder
      })
    const sites = routeCandidates.filter(({ distance }) => distance > 2 && distance <= 3).slice(0, 2)
    expect(sites.map(({ site, distance }) => ({ coordinates: site.coordinates, x: site.x, y: site.y, distance }))).toStrictEqual([
      { coordinates: "45:79:30", x: 59.794915548941574, y: 47.76114389615654, distance: 2.3005120328043422 },
      { coordinates: "45:79:25", x: 59.79537121117998, y: 47.76141021536587, distance: 2.300565677262062 },
    ])
    expect(sites).toHaveLength(2)
    const firstSite = sites[0]
    const secondSite = sites[1]
    Assert.isDefined(firstSite)
    Assert.isDefined(secondSite)
    expect(sites.every(({ site }) => site.ownerPlayerId === null)).toBe(true)

    const build = view.actions.find(({ actionDefinitionId }) => actionDefinitionId === PublicSeedOutpostBuildSixty.id)
    Assert.isDefined(build)
    await player.client.gameplay.updateActionSubmission.mutate({
      gameId: createdGameId,
      turn: view.turn,
      submittedActionTargets: createSubmittedActionTargetsDtoStub({
        actionId: build.id,
        selectedTargets: { planet: home.id },
        selectedInputs: {},
      }),
    })
    await processNextRouterTurn({ clock, turnProcessor, turnsRepository })
    view = await player.client.gameplay.getPlayerView.query({ gameId: createdGameId })
    const source = view.fleets.find(({ originPlanetId, movement }) => originPlanetId === home.id && movement === undefined)
    Assert.isDefined(source)
    expect(source.strength).toBe(60)

    const firstOutpost = view.actions.find(({ id }) => id === "TEST_SEED_OUTPOST_API_1")
    const secondOutpost = view.actions.find(({ id }) => id === "TEST_SEED_OUTPOST_API_2")
    Assert.isDefined(firstOutpost)
    Assert.isDefined(secondOutpost)
    expect([firstOutpost.actionDefinitionId, secondOutpost.actionDefinitionId]).toStrictEqual([SeedOutpostTest.id, SeedOutpostTest.id])

    const outOfRangeSite = planets.find(({ coordinates }) => coordinates === "54:18:10")
    Assert.isDefined(outOfRangeSite)

    await assertOutOfRange({ home, outOfRangeSite, player, createdGameId, view, firstOutpost, source, firstSite, secondOutpost })

    await assertCancelled({
      player,
      createdGameId,
      firstOutpost,
      source,
      firstSite,
      secondOutpost,
      secondSite,
      clock,
      turnProcessor,
      turnsRepository,
    })

    const updatedVerifyDeparted = await assertDeparted({
      player,
      createdGameId,
      source,
      sites,
      firstSite,
      secondSite,
      firstOutpost,
      secondOutpost,
      clock,
      turnProcessor,
      turnsRepository,
      view,
    })
    view = updatedVerifyDeparted.view
  })
})

async function assertOutOfRange({
  home,
  outOfRangeSite,
  player,
  createdGameId,
  view,
  firstOutpost,
  source,
  firstSite,
  secondOutpost,
}: AssertOutOfRangeInput): Promise<void> {
  const outOfRange = Math.hypot(home.x - outOfRangeSite.x, home.y - outOfRangeSite.y)
  expect(outOfRange).toBeCloseTo(10.129282735155494, 12)

  const beforeInvalidSelections = await player.client.gameplay.getPlayerView.query({ gameId: createdGameId })

  await assertScenarioState({
    player,
    createdGameId,
    view,
    firstOutpost,
    source,
    firstSite,
    secondOutpost,
    outOfRangeSite,
    beforeInvalidSelections,
  })

  await player.client.gameplay.updateActionSubmission.mutate({
    gameId: createdGameId,
    turn: view.turn,
    submittedActionTargets: createSubmittedActionTargetsDtoStub({
      actionId: firstOutpost.id,
      selectedTargets: { force: source.id, site: firstSite.site.id },
      selectedInputs: { quota: 30 },
    }),
  })
  const firstSelected = await player.client.gameplay.getPlayerView.query({ gameId: createdGameId })
  expect(firstSelected.actions.find(({ id }) => id === firstOutpost.id)).toMatchObject({
    selectedTargets: { force: source.id, site: firstSite.site.id },
    selectedInputs: { quota: 30 },
    isInProgress: false,
  })
  expect(firstSelected.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 50, uncommitted: 43 })
  expect(firstSelected.resources[ResourceType.FUEL]).toStrictEqual({ total: 10, uncommitted: 8 })
  await player.client.gameplay.updateActionSubmission.mutate({
    gameId: createdGameId,
    turn: firstSelected.turn,
    submittedActionTargets: createSubmittedActionTargetsDtoStub({
      actionId: firstOutpost.id,
      selectedTargets: { force: source.id, site: firstSite.site.id },
      selectedInputs: { quota: 35 },
    }),
  })
  const replaced = await player.client.gameplay.getPlayerView.query({ gameId: createdGameId })
  expect(replaced.actions.find(({ id }) => id === firstOutpost.id)).toMatchObject({
    selectedTargets: { force: source.id, site: firstSite.site.id },
    selectedInputs: { quota: 35 },
    isInProgress: false,
  })
  expect(replaced.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 50, uncommitted: 43 })
  expect(replaced.resources[ResourceType.FUEL]).toStrictEqual({ total: 10, uncommitted: 8 })
  expect(replaced.actions.find(({ id }) => id === secondOutpost.id)).toMatchObject({ selectedTargets: null, isInProgress: false })

  await player.client.gameplay.updateActionSubmission.mutate({
    gameId: createdGameId,
    turn: replaced.turn,
    submittedActionTargets: createSubmittedActionTargetsDtoStub({
      actionId: firstOutpost.id,
      selectedTargets: null,
      selectedInputs: null,
    }),
  })
}

async function assertScenarioState({
  player,
  createdGameId,
  view,
  firstOutpost,
  source,
  firstSite,
  secondOutpost,
  outOfRangeSite,
  beforeInvalidSelections,
}: AssertScenarioStateInput): Promise<void> {
  await expect(
    player.client.gameplay.updateActionSubmission.mutate({
      gameId: createdGameId,
      turn: view.turn,
      submittedActionTargets: createSubmittedActionTargetsDtoStub({
        actionId: firstOutpost.id,
        selectedTargets: { force: source.id, site: firstSite.site.id },
        selectedInputs: { quota: 29 },
      }),
    }),
  ).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } })
  await expect(
    player.client.gameplay.updateActionSubmission.mutate({
      gameId: createdGameId,
      turn: view.turn,
      submittedActionTargets: createSubmittedActionTargetsDtoStub({
        actionId: secondOutpost.id,
        selectedTargets: { force: source.id, site: outOfRangeSite.id },
        selectedInputs: { quota: 30 },
      }),
    }),
  ).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } })
  expect(await player.client.gameplay.getPlayerView.query({ gameId: createdGameId })).toStrictEqual(beforeInvalidSelections)
}

async function assertCancelled({
  player,
  createdGameId,
  firstOutpost,
  source,
  firstSite,
  secondOutpost,
  secondSite,
  clock,
  turnProcessor,
  turnsRepository,
}: AssertCancelledInput): Promise<void> {
  const cancelled = await player.client.gameplay.getPlayerView.query({ gameId: createdGameId })
  expect(cancelled.actions.find(({ id }) => id === firstOutpost.id)).toMatchObject({
    selectedTargets: null,
    selectedInputs: null,
    isInProgress: false,
  })
  expect(cancelled.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 50, uncommitted: 50 })
  expect(cancelled.resources[ResourceType.FUEL]).toStrictEqual({ total: 10, uncommitted: 10 })
  expect(cancelled.fleets.find(({ id }) => id === source.id)).toMatchObject({ id: source.id, strength: 60 })

  await player.client.gameplay.updateActionSubmission.mutate({
    gameId: createdGameId,
    turn: cancelled.turn,
    submittedActionTargets: createSubmittedActionTargetsDtoStub({
      actionId: firstOutpost.id,
      selectedTargets: { force: source.id, site: firstSite.site.id },
      selectedInputs: { quota: 30 },
    }),
  })
  const firstReselected = await player.client.gameplay.getPlayerView.query({ gameId: createdGameId })
  await player.client.gameplay.updateActionSubmission.mutate({
    gameId: createdGameId,
    turn: firstReselected.turn,
    submittedActionTargets: createSubmittedActionTargetsDtoStub({
      actionId: secondOutpost.id,
      selectedTargets: { force: source.id, site: secondSite.site.id },
      selectedInputs: { quota: 30 },
    }),
  })
  const selected = await player.client.gameplay.getPlayerView.query({ gameId: createdGameId })

  await assertSelected({ selected, firstOutpost, source, firstSite, secondOutpost, secondSite, player, createdGameId })

  await processNextRouterTurn({ clock, turnProcessor, turnsRepository })
}

async function assertSelected({
  selected,
  firstOutpost,
  source,
  firstSite,
  secondOutpost,
  secondSite,
  player,
  createdGameId,
}: AssertSelectedInput): Promise<void> {
  expect(selected.actions.find(({ id }) => id === firstOutpost.id)).toMatchObject({
    selectedTargets: { force: source.id, site: firstSite.site.id },
    selectedInputs: { quota: 30 },
    isInProgress: false,
  })
  expect(selected.actions.find(({ id }) => id === secondOutpost.id)).toMatchObject({
    selectedTargets: { force: source.id, site: secondSite.site.id },
    selectedInputs: { quota: 30 },
    isInProgress: false,
  })
  expect(selected.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 50, uncommitted: 36 })
  expect(selected.resources[ResourceType.FUEL]).toStrictEqual({ total: 10, uncommitted: 6 })
  expect(selected.fleets.find(({ id }) => id === source.id)).toMatchObject({ id: source.id, strength: 60 })
  await expect(
    player.client.gameplay.updateActionSubmission.mutate({
      gameId: createdGameId,
      turn: selected.turn,
      submittedActionTargets: createSubmittedActionTargetsDtoStub({
        actionId: firstOutpost.id,
        selectedTargets: { force: source.id, site: firstSite.site.id },
        selectedInputs: { quota: 31 },
      }),
    }),
  ).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } })
  expect(await player.client.gameplay.getPlayerView.query({ gameId: createdGameId })).toStrictEqual(selected)
}

async function assertDeparted({
  player,
  createdGameId,
  source,
  sites,
  firstSite,
  secondSite,
  firstOutpost,
  secondOutpost,
  clock,
  turnProcessor,
  turnsRepository,
  view,
}: AssertDepartedInput): Promise<AssertDepartedResult> {
  const departed = await player.client.gameplay.getPlayerView.query({ gameId: createdGameId })
  expect(departed.fleets.find(({ id }) => id === source.id)).toBeUndefined()
  const departedJourneys = departed.fleets
    .filter(({ destinationPlanetId }) => sites.some(({ site }) => site.id === destinationPlanetId))
    .map(({ destinationPlanetId, strength, distanceToEnd, movement }) => ({
      destinationPlanetId,
      strength,
      distanceToEnd,
      speed: movement?.speed,
    }))
    .toSorted((first, second) => (first.distanceToEnd ?? 0) - (second.distanceToEnd ?? 0))
  expect(departedJourneys).toStrictEqual([
    { destinationPlanetId: firstSite.site.id, strength: 30, distanceToEnd: 0.30051203280434224, speed: 2 },
    { destinationPlanetId: secondSite.site.id, strength: 30, distanceToEnd: 0.3005656772620622, speed: 2 },
  ])
  const departedJourneyIds = departedJourneys.map(
    ({ destinationPlanetId }) => departed.fleets.find(({ destinationPlanetId: targetId }) => targetId === destinationPlanetId)?.id,
  )
  expect(departedJourneyIds).toStrictEqual([expect.any(String), expect.any(String)])
  expect(
    departed.galaxy.systems
      .flatMap(({ planets: systemPlanets }) => systemPlanets)
      .filter(({ id }) => sites.some((entry) => entry.site.id === id))
      .map(({ ownerPlayerId }) => ownerPlayerId),
  ).toStrictEqual([null, null])
  expect(departed.actions.find(({ id }) => id === firstOutpost.id)?.isInProgress).toBe(true)
  expect(departed.actions.find(({ id }) => id === secondOutpost.id)?.isInProgress).toBe(true)
  expect(departed.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 36, uncommitted: 36 })
  expect(departed.resources[ResourceType.FUEL]).toStrictEqual({ total: 6, uncommitted: 6 })
  const beforeLockedEdit = departed
  await expect(
    player.client.gameplay.updateActionSubmission.mutate({
      gameId: createdGameId,
      turn: departed.turn,
      submittedActionTargets: createSubmittedActionTargetsDtoStub({
        actionId: firstOutpost.id,
        selectedTargets: { force: source.id, site: firstSite.site.id },
        selectedInputs: { quota: 30 },
      }),
    }),
  ).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } })
  expect(await player.client.gameplay.getPlayerView.query({ gameId: createdGameId })).toStrictEqual(beforeLockedEdit)

  await processNextRouterTurn({ clock, turnProcessor, turnsRepository })
  view = await player.client.gameplay.getPlayerView.query({ gameId: createdGameId })

  const persistedPlanets = view.galaxy.systems.flatMap(({ planets: systemPlanets }) => systemPlanets)
  for (const { site } of sites) {
    expect(persistedPlanets.find(({ id }) => id === site.id)?.ownerPlayerId).toBe(view.player.id)
    expect(
      view.fleets.some(({ originPlanetId, destinationPlanetId }) => originPlanetId === site.id || destinationPlanetId === site.id),
    ).toBe(false)
  }
  expect(view.fleets.some(({ id }) => departedJourneyIds.includes(id))).toBe(false)
  expect(view.fleets.find(({ id }) => id === source.id)).toBeUndefined()
  expect(view.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 36, uncommitted: 36 })
  expect(view.resources[ResourceType.FUEL]).toStrictEqual({ total: 6, uncommitted: 6 })
  expect(view.resources[ResourceType.COLONY]).toStrictEqual({ total: 0, uncommitted: 0 })
  expect(view.actions.find(({ id }) => id === firstOutpost.id)).toMatchObject({ selectedTargets: null, isInProgress: false })
  expect(view.actions.find(({ id }) => id === secondOutpost.id)).toMatchObject({ selectedTargets: null, isInProgress: false })

  return { view }
}

type AssertOutOfRangeInput = {
  home: Planet
  outOfRangeSite: Planet
  player: AuthenticatedApiClient
  createdGameId: GameId
  view: PlayerView
  firstOutpost: Action
  source: Fleet
  firstSite: { site: Planet; distance: number }
  secondOutpost: Action
}

type AssertScenarioStateInput = {
  player: AuthenticatedApiClient
  createdGameId: GameId
  view: PlayerView
  firstOutpost: Action
  source: Fleet
  firstSite: { site: Planet; distance: number }
  secondOutpost: Action
  outOfRangeSite: Planet
  beforeInvalidSelections: PlayerView
}

type AssertCancelledInput = {
  player: AuthenticatedApiClient
  createdGameId: GameId
  firstOutpost: Action
  source: Fleet
  firstSite: { site: Planet; distance: number }
  secondOutpost: Action
  secondSite: { site: Planet; distance: number }
  clock: ControlledClock
  turnProcessor: TurnProcessor
  turnsRepository: TurnsRepository
}

type AssertSelectedInput = {
  selected: PlayerView
  firstOutpost: Action
  source: Fleet
  firstSite: { site: Planet; distance: number }
  secondOutpost: Action
  secondSite: { site: Planet; distance: number }
  player: AuthenticatedApiClient
  createdGameId: GameId
}

type AssertDepartedInput = {
  player: AuthenticatedApiClient
  createdGameId: GameId
  source: Fleet
  sites: Array<{ site: Planet; distance: number }>
  firstSite: { site: Planet; distance: number }
  secondSite: { site: Planet; distance: number }
  firstOutpost: Action
  secondOutpost: Action
  clock: ControlledClock
  turnProcessor: TurnProcessor
  turnsRepository: TurnsRepository
  view: PlayerView
}

type AssertDepartedResult = { view: PlayerView }
