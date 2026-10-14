import type { GameId } from "shared/domain/games/GameId.ts"
import { ResourceType } from "shared/domain/resources/ResourceType.ts"
import type { FleetId } from "shared/domain/world/fleets/FleetId.ts"
import type { PlanetId } from "shared/domain/world/planets/PlanetId.ts"
import { expect } from "vitest"
import { createSubmittedActionTargetsDtoStub } from "#api/gameplay/SubmittedActionTargetsDto.stub.ts"
import type { PlayerView, Action, Fleet, Planet } from "#api/types.ts"
import type { AuthenticatedApiClient } from "#tests/ApiClient.ts"

export async function assertRedirectedTargets({
  source,
  redirectPlanet,
  alice,
  gameId,
  firstReload,
  freeComposedAction,
  customAction,
  occupiedComposedAction,
  journey,
  occupiedJourney,
  validTargets,
}: AssertRedirectedTargetsInput): Promise<void> {
  const redirectedTargets = { originForce: source.id, landingSite: redirectPlanet.planet.id }

  const proveFreeInstanceSelectionAndCancel = async (selectedTargets: Record<string, string>, units: number): Promise<void> => {
    expect(await alice.client.gameplay.getPlayerView.query({ gameId })).toStrictEqual(firstReload)
    await alice.client.gameplay.updateActionSubmission.mutate({
      gameId,
      turn: firstReload.turn,
      submittedActionTargets: createSubmittedActionTargetsDtoStub({
        actionId: freeComposedAction.id,
        selectedTargets,
        selectedInputs: { units },
      }),
    })
    const freeSelectionView = await alice.client.gameplay.getPlayerView.query({ gameId })
    expect(freeSelectionView.actions.find(({ id }) => id === freeComposedAction.id)).toMatchObject({
      selectedTargets,
      selectedInputs: { units },
      isInProgress: false,
    })
    expect(freeSelectionView.actions.find(({ id }) => id === customAction.id)).toStrictEqual(occupiedComposedAction)
    expect(freeSelectionView.fleets.find(({ id }) => id === journey.id)).toStrictEqual(occupiedJourney)
    expect(freeSelectionView.resources[ResourceType.INFLUENCE]).toStrictEqual({
      total: firstReload.resources[ResourceType.INFLUENCE].total,
      uncommitted: firstReload.resources[ResourceType.INFLUENCE].uncommitted - 7,
    })
    expect(freeSelectionView.resources[ResourceType.FUEL]).toStrictEqual({
      total: firstReload.resources[ResourceType.FUEL].total,
      uncommitted: firstReload.resources[ResourceType.FUEL].uncommitted - 2,
    })
    await alice.client.gameplay.updateActionSubmission.mutate({
      gameId,
      turn: firstReload.turn,
      submittedActionTargets: { actionId: freeComposedAction.id, selectedTargets: null, selectedInputs: null },
    })
    expect(await alice.client.gameplay.getPlayerView.query({ gameId })).toStrictEqual(firstReload)
  }

  await proveFreeInstanceSelectionAndCancel(validTargets, 1)
  await proveFreeInstanceSelectionAndCancel(redirectedTargets, 1)
  await proveFreeInstanceSelectionAndCancel(validTargets, 19)

  const rejectOccupiedAttemptWithoutMutation = async (
    submittedActionTargets: ReturnType<typeof createSubmittedActionTargetsDtoStub>,
    expectedMessage: string,
  ): Promise<void> => {
    expect(await alice.client.gameplay.getPlayerView.query({ gameId })).toStrictEqual(firstReload)
    const updatePromise = alice.client.gameplay.updateActionSubmission.mutate({
      gameId,
      turn: firstReload.turn,
      submittedActionTargets,
    })
    await expect(updatePromise).rejects.toThrow(expectedMessage)
    await expect(updatePromise).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } })
    const unchangedView = await alice.client.gameplay.getPlayerView.query({ gameId })
    expect(unchangedView).toStrictEqual(firstReload)
    expect(unchangedView.actions.find(({ id }) => id === customAction.id)).toStrictEqual(occupiedComposedAction)
    expect(unchangedView.resources).toStrictEqual(firstReload.resources)
    expect(unchangedView.fleets.find(({ id }) => id === journey.id)).toStrictEqual(occupiedJourney)
  }
  const occupiedMessage = "An Action cannot be changed or cancelled while it is in progress."
  await rejectOccupiedAttemptWithoutMutation(
    createSubmittedActionTargetsDtoStub({
      actionId: customAction.id,
      selectedTargets: validTargets,
      selectedInputs: { units: 1 },
    }),
    occupiedMessage,
  )
  await rejectOccupiedAttemptWithoutMutation(
    createSubmittedActionTargetsDtoStub({
      actionId: customAction.id,
      selectedTargets: validTargets,
      selectedInputs: { units: 19 },
    }),
    occupiedMessage,
  )
  await rejectOccupiedAttemptWithoutMutation(
    createSubmittedActionTargetsDtoStub({
      actionId: customAction.id,
      selectedTargets: redirectedTargets,
      selectedInputs: { units: 1 },
    }),
    occupiedMessage,
  )
  await rejectOccupiedAttemptWithoutMutation(
    { actionId: customAction.id, selectedTargets: null, selectedInputs: null },
    "An Action cannot be changed or cancelled while it is in progress.",
  )
}

export type AssertRedirectedTargetsInput = {
  source: Fleet
  redirectPlanet: { planet: Planet; distance: number }
  alice: AuthenticatedApiClient
  gameId: GameId
  firstReload: PlayerView
  freeComposedAction: Action
  customAction: Action
  occupiedComposedAction: Action
  journey: Fleet
  occupiedJourney: Fleet
  validTargets: { originForce: FleetId; landingSite: PlanetId }
}

export async function assertSecondReload({
  processReadyTurn,
  gameId,
  firstReload,
  alice,
  bob,
  journey,
  defender,
  aliceView,
  bobHome,
  source,
  aliceHome,
  customAction,
}: AssertSecondReloadInput): Promise<void> {
  await processReadyTurn(gameId, firstReload.turn, [alice, bob])
  const secondReload = await alice.client.gameplay.getPlayerView.query({ gameId })
  expect(secondReload.fleets.find(({ id }) => id === journey.id)?.distanceToEnd).toBe(0.418312565270031)
  expect(secondReload.fleets.find(({ id }) => id === defender.id)?.strength).toBe(20)
  expect(secondReload.resources[ResourceType.INFLUENCE].total).toBe(80)
  expect(secondReload.resources[ResourceType.FUEL].total).toBe(95)

  await processReadyTurn(gameId, secondReload.turn, [alice, bob])
  const arrivalView = await alice.client.gameplay.getPlayerView.query({ gameId })

  assertArrivalView({ arrivalView, defender, journey, aliceView, bobHome, source, aliceHome, customAction })
}

export type AssertSecondReloadInput = {
  processReadyTurn: (gameId: number, turn: number, clients: readonly AuthenticatedApiClient[]) => Promise<void>
  gameId: GameId
  firstReload: PlayerView
  alice: AuthenticatedApiClient
  bob: AuthenticatedApiClient
  journey: Fleet
  defender: Fleet
  aliceView: PlayerView
  bobHome: Planet
  source: Fleet
  aliceHome: Planet
  customAction: Action
}

export function assertArrivalView({
  arrivalView,
  defender,
  journey,
  aliceView,
  bobHome,
  source,
  aliceHome,
  customAction,
}: AssertArrivalViewInput): void {
  expect(arrivalView.fleets.find(({ id }) => id === defender.id)).toBeUndefined()
  expect(arrivalView.fleets.find(({ id }) => id === journey.id)).toStrictEqual({
    id: journey.id,
    name: journey.name,
    ownerPlayerId: aliceView.player.id,
    strength: 10,
    originPlanetId: bobHome.id,
  })
  expect(arrivalView.fleets.find(({ id }) => id === source.id)).toMatchObject({
    id: source.id,
    name: source.name,
    strength: 19,
    originPlanetId: aliceHome.id,
  })
  expect(arrivalView.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 80, uncommitted: 80 })
  expect(arrivalView.resources[ResourceType.FUEL]).toStrictEqual({ total: 95, uncommitted: 95 })
  expect(arrivalView.actions.find(({ id }) => id === customAction.id)?.isInProgress).toBe(false)
}

export type AssertArrivalViewInput = {
  arrivalView: PlayerView
  defender: Fleet
  journey: Fleet
  aliceView: PlayerView
  bobHome: Planet
  source: Fleet
  aliceHome: Planet
  customAction: Action
}
