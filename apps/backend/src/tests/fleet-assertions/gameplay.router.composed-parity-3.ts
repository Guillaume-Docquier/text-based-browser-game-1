import type { GameId } from "shared/domain/games/GameId.ts"
import { ResourceType } from "shared/domain/resources/ResourceType.ts"
import type { FleetId } from "shared/domain/world/fleets/FleetId.ts"
import type { PlanetId } from "shared/domain/world/planets/PlanetId.ts"
import { expect } from "vitest"
import { createSubmittedActionTargetsDtoStub } from "#api/gameplay/SubmittedActionTargetsDto.stub.ts"
import type { PlayerView, Action, Fleet, Planet } from "#api/types.ts"
import type { AuthenticatedApiClient } from "#tests/ApiClient.ts"

export async function assertRedirectedTargets(input: AssertRedirectedTargetsInput): Promise<void> {
  const redirectedTargets = { originForce: input.source.id, landingSite: input.redirectPlanet.planet.id }

  const proveFreeInstanceSelectionAndCancel = async (selectedTargets: Record<string, string>, units: number): Promise<void> => {
    expect(await input.alice.client.gameplay.getPlayerView.query({ gameId: input.gameId })).toStrictEqual(input.firstReload)
    await input.alice.client.gameplay.updateActionSubmission.mutate({
      gameId: input.gameId,
      turn: input.firstReload.turn,
      submittedActionTargets: createSubmittedActionTargetsDtoStub({
        actionId: input.freeComposedAction.id,
        selectedTargets,
        selectedInputs: { units },
      }),
    })
    const freeSelectionView = await input.alice.client.gameplay.getPlayerView.query({ gameId: input.gameId })
    expect(freeSelectionView.actions.find(({ id }) => id === input.freeComposedAction.id)).toMatchObject({
      selectedTargets,
      selectedInputs: { units },
      isInProgress: false,
    })
    expect(freeSelectionView.actions.find(({ id }) => id === input.customAction.id)).toStrictEqual(input.occupiedComposedAction)
    expect(freeSelectionView.fleets.find(({ id }) => id === input.journey.id)).toStrictEqual(input.occupiedJourney)
    expect(freeSelectionView.resources[ResourceType.INFLUENCE]).toStrictEqual({
      total: input.firstReload.resources[ResourceType.INFLUENCE].total,
      uncommitted: input.firstReload.resources[ResourceType.INFLUENCE].uncommitted - 7,
    })
    expect(freeSelectionView.resources[ResourceType.FUEL]).toStrictEqual({
      total: input.firstReload.resources[ResourceType.FUEL].total,
      uncommitted: input.firstReload.resources[ResourceType.FUEL].uncommitted - 2,
    })
    await input.alice.client.gameplay.updateActionSubmission.mutate({
      gameId: input.gameId,
      turn: input.firstReload.turn,
      submittedActionTargets: { actionId: input.freeComposedAction.id, selectedTargets: null, selectedInputs: null },
    })
    expect(await input.alice.client.gameplay.getPlayerView.query({ gameId: input.gameId })).toStrictEqual(input.firstReload)
  }

  await proveFreeInstanceSelectionAndCancel(input.validTargets, 1)
  await proveFreeInstanceSelectionAndCancel(redirectedTargets, 1)
  await proveFreeInstanceSelectionAndCancel(input.validTargets, 19)

  const rejectOccupiedAttemptWithoutMutation = async (
    submittedActionTargets: ReturnType<typeof createSubmittedActionTargetsDtoStub>,
    expectedMessage: string,
  ): Promise<void> => {
    expect(await input.alice.client.gameplay.getPlayerView.query({ gameId: input.gameId })).toStrictEqual(input.firstReload)
    const updatePromise = input.alice.client.gameplay.updateActionSubmission.mutate({
      gameId: input.gameId,
      turn: input.firstReload.turn,
      submittedActionTargets,
    })
    await expect(updatePromise).rejects.toThrow(expectedMessage)
    await expect(updatePromise).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } })
    const unchangedView = await input.alice.client.gameplay.getPlayerView.query({ gameId: input.gameId })
    expect(unchangedView).toStrictEqual(input.firstReload)
    expect(unchangedView.actions.find(({ id }) => id === input.customAction.id)).toStrictEqual(input.occupiedComposedAction)
    expect(unchangedView.resources).toStrictEqual(input.firstReload.resources)
    expect(unchangedView.fleets.find(({ id }) => id === input.journey.id)).toStrictEqual(input.occupiedJourney)
  }
  const occupiedMessage = "An Action cannot be changed or cancelled while it is in progress."
  await rejectOccupiedAttemptWithoutMutation(
    createSubmittedActionTargetsDtoStub({
      actionId: input.customAction.id,
      selectedTargets: input.validTargets,
      selectedInputs: { units: 1 },
    }),
    occupiedMessage,
  )
  await rejectOccupiedAttemptWithoutMutation(
    createSubmittedActionTargetsDtoStub({
      actionId: input.customAction.id,
      selectedTargets: input.validTargets,
      selectedInputs: { units: 19 },
    }),
    occupiedMessage,
  )
  await rejectOccupiedAttemptWithoutMutation(
    createSubmittedActionTargetsDtoStub({
      actionId: input.customAction.id,
      selectedTargets: redirectedTargets,
      selectedInputs: { units: 1 },
    }),
    occupiedMessage,
  )
  await rejectOccupiedAttemptWithoutMutation(
    { actionId: input.customAction.id, selectedTargets: null, selectedInputs: null },
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

export async function assertSecondReload(input: AssertSecondReloadInput): Promise<void> {
  await input.processReadyTurn(input.gameId, input.firstReload.turn, [input.alice, input.bob])
  const secondReload = await input.alice.client.gameplay.getPlayerView.query({ gameId: input.gameId })
  expect(secondReload.fleets.find(({ id }) => id === input.journey.id)?.distanceToEnd).toBe(0.418312565270031)
  expect(secondReload.fleets.find(({ id }) => id === input.defender.id)?.strength).toBe(20)
  expect(secondReload.resources[ResourceType.INFLUENCE].total).toBe(80)
  expect(secondReload.resources[ResourceType.FUEL].total).toBe(95)

  await input.processReadyTurn(input.gameId, secondReload.turn, [input.alice, input.bob])
  const arrivalView = await input.alice.client.gameplay.getPlayerView.query({ gameId: input.gameId })

  assertArrivalView({ ...input, arrivalView })
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

export function assertArrivalView(input: AssertArrivalViewInput): void {
  expect(input.arrivalView.fleets.find(({ id }) => id === input.defender.id)).toBeUndefined()
  expect(input.arrivalView.fleets.find(({ id }) => id === input.journey.id)).toStrictEqual({
    id: input.journey.id,
    name: input.journey.name,
    ownerPlayerId: input.aliceView.player.id,
    strength: 10,
    originPlanetId: input.bobHome.id,
  })
  expect(input.arrivalView.fleets.find(({ id }) => id === input.source.id)).toMatchObject({
    id: input.source.id,
    name: input.source.name,
    strength: 19,
    originPlanetId: input.aliceHome.id,
  })
  expect(input.arrivalView.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 80, uncommitted: 80 })
  expect(input.arrivalView.resources[ResourceType.FUEL]).toStrictEqual({ total: 95, uncommitted: 95 })
  expect(input.arrivalView.actions.find(({ id }) => id === input.customAction.id)?.isInProgress).toBe(false)
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
