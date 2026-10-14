import { Assert } from "@guillaume-docquier/tools-ts"
import { compareOrdinalStrings } from "shared/domain/compareOrdinalStrings.ts"
import type { GameId } from "shared/domain/games/GameId.ts"
import type { PlayerId } from "shared/domain/players/PlayerId.ts"
import { BuildFleetStandard } from "shared/testing/test-ruleset/action-definitions/build-fleet.ts"
import { expect } from "vitest"
import type { Planet, Fleet, PlayerView } from "#api/types.ts"
import type { ControlledClock } from "#lib/ControlledClock.ts"
import type { Database } from "#lib/db/createDb.ts"
import type { AuthenticatedApiClient } from "#tests/ApiClient.ts"
import type { reverseWorkerInputEnumeration } from "#tests/fleet-concurrency/gameplay.ts"
import type {
  replayObservedTurn as CapturedreplayObservedTurn,
  mulberry32FirstDraw as Capturedmulberry32FirstDraw,
  mulberry32DrawSequence as Capturedmulberry32DrawSequence,
} from "#tests/fleet-worker/TurnProcessor.scenarios.ts"
import type { TurnProcessor } from "#turn-processing/TurnProcessor.ts"
import type { TurnsRepository } from "#turn-processing/turns.repository.ts"
import {
  processPublicTurn,
  observeTurnAndRollback,
  ownerFleetForces,
  ownerPublicForces,
  getActionToSubmintegrationTest,
  logWorkerObservation,
} from "../fleet-worker/TurnProcessor.scenarios.ts"

export async function assertHomes(input: AssertHomesInput): Promise<void> {
  const homes = [input.homeA, input.homeB] as const
  const homeDistances = homes.map((home) => Math.hypot(home.x - input.target.x, home.y - input.target.y))

  assertScenarioState({ ...input, homes, homeDistances })

  // Arrange: produce A30/B20 only through public Build submissions and actual worker turns.
  for (let buildRound = 0; buildRound < 3; buildRound += 1) {
    const views = await Promise.all(
      input.clients.map(async ({ client }) => await client.gameplay.getPlayerView.query({ gameId: input.gameId })),
    )
    for (let ownerIndex = 0; ownerIndex < input.clients.length; ownerIndex += 1) {
      const buildCount = ownerIndex === 0 ? 3 : 2
      if (buildRound < buildCount) {
        const client = input.clients[ownerIndex]
        const view = views[ownerIndex]
        const home = homes[ownerIndex]
        Assert.isDefined(client)
        Assert.isDefined(view)
        Assert.isDefined(home)
        await client.client.gameplay.updateActionSubmission.mutate({
          gameId: input.gameId,
          turn: view.turn,
          submittedActionTargets: getActionToSubmintegrationTest(view, BuildFleetStandard.id, { planet: home.id }),
        })
      }
    }
    const view = views[0]
    Assert.isDefined(view)
    await processPublicTurn({ ...input, turn: view.turn })
  }
}

export type AssertHomesInput = {
  homeA: Planet
  homeB: Planet
  target: Planet
  playerIds: readonly [PlayerId, PlayerId]
  clients: readonly [AuthenticatedApiClient, AuthenticatedApiClient]
  gameId: GameId
  turnProcessor: TurnProcessor
}

export function assertScenarioState(input: AssertScenarioStateInput): void {
  expect({
    target: { id: input.target.id, name: input.target.name, coordinates: input.target.coordinates, x: input.target.x, y: input.target.y },
    homes: input.homes.map((home, index) => ({
      playerId: input.playerIds[index],
      id: home.id,
      name: home.name,
      coordinates: home.coordinates,
      x: home.x,
      y: home.y,
      distance: input.homeDistances[index],
    })),
  }).toStrictEqual({
    target: {
      id: "57c1b320-c267-5c9b-a5a5-1b5a02823714",
      name: "planet 552840",
      coordinates: "45:83:40",
      x: 53.24122006799319,
      y: 48.68601626316641,
    },
    homes: [
      {
        playerId: "00000000-0000-4000-8000-000000000001",
        id: "57c1b320-c267-5c9b-a5a5-1b5a02823714",
        name: "planet 552840",
        coordinates: "45:83:40",
        x: 53.24122006799319,
        y: 48.68601626316641,
        distance: 0,
      },
      {
        playerId: "00000000-0000-4000-8000-000000000002",
        id: "ec56a9af-3995-521c-822d-84685a96fdc6",
        name: "planet 819299",
        coordinates: "44:98:05",
        x: 48.987456457561635,
        y: 49.880579392930315,
        distance: 4.418312565270031,
      },
    ],
  })
}

export type AssertScenarioStateInput = {
  target: Planet
  homes: readonly [Planet, Planet]
  playerIds: readonly [PlayerId, PlayerId]
  homeDistances: number[]
}

export type AssertScenarioState2Input = {
  forward: ReturnType<typeof CapturedreplayObservedTurn>
  permuted: ReturnType<typeof CapturedreplayObservedTurn>
}

export async function assertOutcomeB(input: AssertOutcomeBInput): Promise<void> {
  if (input.assertOutcomeBPhase2Value1 < 0.5) {
    expect(input.outcomeB).toStrictEqual({
      type: "RESOLVED",
      result: `Fleet "${input.stationed[1].name}" exchanged 20 Strength with 30 enemy Strength at Planet "${input.target.name}"`,
    })
    expect(input.outcomeA).toStrictEqual({
      type: "RESOLVED",
      result: `Fleet "${input.stationed[0].name}" found no enemy Fleets at Planet "${input.target.name}"`,
    })
  } else {
    expect(input.outcomeA).toStrictEqual({
      type: "RESOLVED",
      result: `Fleet "${input.stationed[0].name}" exchanged 20 Strength with 20 enemy Strength at Planet "${input.target.name}"`,
    })
    expect(input.outcomeB).toStrictEqual({
      type: "PREVENTED",
      reason: `Attacking Fleet "${input.stationed[1].id}" was destroyed before its Assault`,
    })
  }
  expect(input.forward.rngState).toStrictEqual({
    generatorState: input.draw.nextGeneratorState,
    spareNormal: input.assertOutcomeBPhase2Observed.rngState.spareNormal,
  })
  // Assert: the actual worker independently reloads/saves the same tie and public views show its force result.
  expect(await input.turnProcessor.processNextDueTurn()).toBe("processed")
}

export type AssertOutcomeBInput = {
  assertOutcomeBPhase2Value1: number
  outcomeB: Readonly<{ type: "RESOLVED"; result: string }> | Readonly<{ type: "PREVENTED"; reason: string }>
  stationed: readonly [Fleet, Fleet]
  target: Planet
  outcomeA: Readonly<{ type: "RESOLVED"; result: string }> | Readonly<{ type: "PREVENTED"; reason: string }>
  forward: ReturnType<typeof CapturedreplayObservedTurn>
  draw: ReturnType<typeof Capturedmulberry32FirstDraw>
  assertOutcomeBPhase2Observed: ReturnType<typeof reverseWorkerInputEnumeration>
  turnProcessor: TurnProcessor
}

export type AssertOutcomeB2Input = {
  assertOutcomeBPhase5Value1: number
  outcomeB: Readonly<{ type: "RESOLVED"; result: string }> | Readonly<{ type: "PREVENTED"; reason: string }>
  fleetB: Fleet
  target: Planet
  outcomeA: Readonly<{ type: "RESOLVED"; result: string }> | Readonly<{ type: "PREVENTED"; reason: string }>
  fleetA: Fleet
  forward: ReturnType<typeof CapturedreplayObservedTurn>
  playerIds: readonly [PlayerId, PlayerId, PlayerId]
  playerAId: PlayerId
  playerBId: PlayerId
  playerCId: PlayerId
  fleetC: Fleet
  draw: { value: number; nextGeneratorState: number }
  assertOutcomeBPhase5Observed: ReturnType<typeof reverseWorkerInputEnumeration>
  turnProcessor: TurnProcessor
}

export type AssertOutcomeB3Input = {
  assertOutcomeBPhase7Value1: number
  outcomeB: Readonly<{ type: "RESOLVED"; result: string }> | Readonly<{ type: "PREVENTED"; reason: string }>
  fleetB: Fleet
  target: Planet
  outcomeA: Readonly<{ type: "RESOLVED"; result: string }> | Readonly<{ type: "PREVENTED"; reason: string }>
  fleetA: Fleet
  forward: ReturnType<typeof CapturedreplayObservedTurn>
  playerIds: readonly [PlayerId, PlayerId, PlayerId]
  playerAId: PlayerId
  playerBId: PlayerId
  playerCId: PlayerId
  fleetC: Fleet
  draw: ReturnType<typeof Capturedmulberry32FirstDraw>
  assertOutcomeBPhase7Observed: ReturnType<typeof reverseWorkerInputEnumeration>
  turnProcessor: TurnProcessor
}

export async function assertEmptyObserved(input: AssertEmptyObservedInput): Promise<void> {
  await processPublicTurn({ ...input, turn: input.emptyTurn.turn, process: false })
  const emptyObserved = await observeTurnAndRollback({ ...input, turn: input.emptyTurn.turn })
  expect(emptyObserved.submittedActions).toStrictEqual([])
  expect(emptyObserved.rngState).toStrictEqual(input.forward.rngState)
  logWorkerObservation(
    "[I2-06 natural two-owner worker observation]",
    JSON.stringify({
      initialRngState: input.assertEmptyObservedPhase3Observed.rngState,
      draws: [{ value: input.assertEmptyObservedPhase3Value1, nextGeneratorState: input.draw.nextGeneratorState }],
      names: [],
      canonicalKeys: input.stationed.map((fleet, index) => input.playerIds[index] + "/" + input.actionIds[index] + "/" + fleet.id),
      selectedTieOrder:
        input.assertEmptyObservedPhase3Value1 < 0.5 ? [input.playerIds[1], input.playerIds[0]] : [input.playerIds[0], input.playerIds[1]],
      replayNextState: input.forward.rngState,
      workerNextState: emptyObserved.rngState,
    }),
  )
  expect(await input.turnProcessor.processNextDueTurn()).toBe("processed")
  const afterEmptyViews = await Promise.all(
    input.clients.map(async ({ client }) => await client.gameplay.getPlayerView.query({ gameId: input.gameId })),
  )
  expect(
    afterEmptyViews[0]?.fleets
      .map(({ id, strength, originPlanetId }) => ({ id, strength, originPlanetId }))
      .toSorted((a, b) => compareOrdinalStrings(a.id, b.id)),
  ).toStrictEqual(
    input.afterCombatViews[0]?.fleets
      .map(({ id, strength, originPlanetId }) => ({ id, strength, originPlanetId }))
      .toSorted((a, b) => compareOrdinalStrings(a.id, b.id)),
  )
  for (const view of afterEmptyViews) {
    expect(view.actions.find(({ id }) => id === input.actionIds[0])).toMatchObject({ selectedTargets: null, isInProgress: false })
  }
}

export type AssertEmptyObservedInput = {
  clients: readonly [AuthenticatedApiClient, AuthenticatedApiClient]
  gameId: GameId
  emptyTurn: PlayerView
  turnProcessor: TurnProcessor
  db: Database
  clock: ControlledClock
  turnsRepository: TurnsRepository
  forward: ReturnType<typeof CapturedreplayObservedTurn>
  assertEmptyObservedPhase3Observed: ReturnType<typeof reverseWorkerInputEnumeration>
  assertEmptyObservedPhase3Value1: number
  draw: ReturnType<typeof Capturedmulberry32FirstDraw>
  stationed: readonly [Fleet, Fleet]
  playerIds: readonly [PlayerId, PlayerId]
  actionIds: string[]
  afterCombatViews: PlayerView[]
}

export type AssertEmptyObserved2Input = {
  clients: readonly [AuthenticatedApiClient, AuthenticatedApiClient, AuthenticatedApiClient]
  gameId: number
  emptyTurn: PlayerView
  db: Database
  clock: ControlledClock
  turnsRepository: TurnsRepository
  forward: ReturnType<typeof CapturedreplayObservedTurn>
  assertEmptyObservedPhase6Observed: ReturnType<typeof reverseWorkerInputEnumeration>
  rngSequence: ReturnType<typeof Capturedmulberry32DrawSequence>
  actualWorkerBuildNames: string[]
  expectedBuildNames: string[]
  playerIds: readonly [PlayerId, PlayerId, PlayerId]
  buildActionIds: string[]
  homes: readonly [Planet, Planet, Planet]
  stationed: readonly [Fleet, Fleet, Fleet]
  assaultActionIds: string[]
  assertEmptyObservedPhase6Value1: number
  turnProcessor: TurnProcessor
  alice: AuthenticatedApiClient
  target: Planet
  actualForces: Record<string, undefined | number[]>
}

export type AssertEmptyObserved3Input = {
  clients: readonly [AuthenticatedApiClient, AuthenticatedApiClient, AuthenticatedApiClient]
  gameId: number
  emptyTurn: PlayerView
  db: Database
  clock: ControlledClock
  turnsRepository: TurnsRepository
  forward: ReturnType<typeof CapturedreplayObservedTurn>
  assertEmptyObservedPhase8Observed: ReturnType<typeof reverseWorkerInputEnumeration>
  assertEmptyObservedPhase8Value1: number
  draw: ReturnType<typeof Capturedmulberry32FirstDraw>
  stationed: readonly [Fleet, Fleet, Fleet]
  playerIds: readonly [PlayerId, PlayerId, PlayerId]
  assaultActionIds: string[]
  turnProcessor: TurnProcessor
  alice: AuthenticatedApiClient
  target: Planet
  actualForces: Record<string, undefined | number[]>
}

export function assertOwnerIndex(input: AssertOwnerIndexInput): void {
  for (let ownerIndex = 0; ownerIndex < input.playerIds.length; ownerIndex += 1) {
    const ownerPlayerId = input.playerIds[ownerIndex]
    const home = input.homes[ownerIndex]
    const expectedName = input.expectedBuildNames[ownerIndex]
    Assert.isDefined(ownerPlayerId)
    Assert.isDefined(home)
    Assert.isDefined(expectedName)
    const builtFleet = Object.values(input.forward.resolved.fleets).find(
      ({ ownerPlayerId: fleetOwner, originPlanetId }) => fleetOwner === ownerPlayerId && originPlanetId === home.id,
    )
    Assert.isDefined(builtFleet)
    expect(builtFleet).toMatchObject({
      name: expectedName,
      ownerPlayerId,
      originPlanetId: home.id,
      strength: 10,
    })
    input.replayBuilds.push({
      id: builtFleet.id,
      name: builtFleet.name,
      ownerPlayerId,
      originPlanetId: home.id,
      strength: builtFleet.strength,
    })
  }

  assertScenarioState2({ ...input })
}

export type AssertOwnerIndexInput = {
  playerIds: readonly [PlayerId, PlayerId, PlayerId]
  homes: readonly [Planet, Planet, Planet]
  expectedBuildNames: string[]
  forward: ReturnType<typeof CapturedreplayObservedTurn>
  replayBuilds: Array<{ id: string; name: string; ownerPlayerId: PlayerId; originPlanetId: string; strength: number }>
  permuted: ReturnType<typeof CapturedreplayObservedTurn>
}

export function assertScenarioState2(input: AssertScenarioState2Input): void {
  expect(
    Object.values(input.forward.resolved.fleets)
      .map(({ id, name, ownerPlayerId, originPlanetId, strength }) => ({
        id,
        name,
        ownerPlayerId,
        originPlanetId,
        strength,
      }))
      .toSorted((left, right) => compareOrdinalStrings(left.id, right.id)),
  ).toStrictEqual(
    Object.values(input.permuted.resolved.fleets)
      .map(({ id, name, ownerPlayerId, originPlanetId, strength }) => ({
        id,
        name,
        ownerPlayerId,
        originPlanetId,
        strength,
      }))
      .toSorted((left, right) => compareOrdinalStrings(left.id, right.id)),
  )
}

export async function assertOutcomeB2(input: AssertOutcomeB2Input): Promise<void> {
  if (input.assertOutcomeBPhase5Value1 < 0.5) {
    expect(input.outcomeB).toStrictEqual({
      type: "RESOLVED",
      result: `Fleet "${input.fleetB.name}" exchanged 20 Strength with 40 enemy Strength at Planet "${input.target.name}"`,
    })
    expect(input.outcomeA).toStrictEqual({
      type: "RESOLVED",
      result: `Fleet "${input.fleetA.name}" exchanged 5 Strength with 5 enemy Strength at Planet "${input.target.name}"`,
    })
    expect(ownerFleetForces(input.forward.resolved, input.playerIds, input.target.id)).toStrictEqual({
      [input.playerAId]: [10],
      [input.playerBId]: [],
      [input.playerCId]: [],
    })
    expect(input.forward.resolved.removedFleetIds.toSorted(compareOrdinalStrings)).toStrictEqual(
      [input.fleetB.id, input.fleetC.id].toSorted(compareOrdinalStrings),
    )
  } else {
    expect(input.outcomeA).toStrictEqual({
      type: "RESOLVED",
      result: `Fleet "${input.fleetA.name}" exchanged 30 Strength with 30 enemy Strength at Planet "${input.target.name}"`,
    })
    expect(input.outcomeB).toStrictEqual({
      type: "PREVENTED",
      reason: `Attacking Fleet "${input.fleetB.id}" was destroyed before its Assault`,
    })
    expect(ownerFleetForces(input.forward.resolved, input.playerIds, input.target.id)).toStrictEqual({
      [input.playerAId]: [],
      [input.playerBId]: [],
      [input.playerCId]: [],
    })
    expect(input.forward.resolved.removedFleetIds.toSorted(compareOrdinalStrings)).toStrictEqual(
      [input.fleetA.id, input.fleetB.id, input.fleetC.id].toSorted(compareOrdinalStrings),
    )
  }
  expect(input.forward.rngState).toStrictEqual({
    generatorState: input.draw.nextGeneratorState,
    spareNormal: input.assertOutcomeBPhase5Observed.rngState.spareNormal,
  })
  // Assert: the actual worker independently reloads/resolves/saves the tied orders; public forces prove the branch.
  expect(await input.turnProcessor.processNextDueTurn()).toBe("processed")
}

export async function assertEmptyObserved2(input: AssertEmptyObserved2Input): Promise<void> {
  await Promise.all(
    input.clients.map(
      async ({ client }) =>
        await client.gameplay.updateReadiness.mutate({ gameId: input.gameId, turn: input.emptyTurn.turn, isReady: true }),
    ),
  )
  const emptyObserved = await observeTurnAndRollback({ ...input, turn: input.emptyTurn.turn })
  expect(emptyObserved.submittedActions).toStrictEqual([])
  expect(emptyObserved.rngState).toStrictEqual(input.forward.rngState)
  logWorkerObservation(
    "[I2-14 natural three-owner Build plus Assault worker observation]",
    JSON.stringify({
      initialRngState: input.assertEmptyObservedPhase6Observed.rngState,
      draws: input.rngSequence.draws,
      names: input.actualWorkerBuildNames,
      derivedBuildNames: input.expectedBuildNames,
      canonicalBuildKeys: input.playerIds.map(
        (playerId, index) => playerId + "/" + input.buildActionIds[index] + "/" + input.homes[index]?.id,
      ),
      canonicalAssaultKeys: input.stationed
        .slice(0, 2)
        .map((fleet, index) => input.playerIds[index] + "/" + input.assaultActionIds[index] + "/" + fleet.id),
      selectedTieOrder:
        input.assertEmptyObservedPhase6Value1 < 0.5 ? [input.playerIds[1], input.playerIds[0]] : [input.playerIds[0], input.playerIds[1]],
      replayNextState: input.forward.rngState,
      workerNextState: emptyObserved.rngState,
    }),
  )
  expect(await input.turnProcessor.processNextDueTurn()).toBe("processed")
  const afterEmpty = await input.alice.client.gameplay.getPlayerView.query({ gameId: input.gameId })
  expect(ownerPublicForces(afterEmpty.fleets, input.playerIds, input.target.id)).toStrictEqual(input.actualForces)
}

export async function assertOutcomeB3(options: AssertOutcomeB3Input): Promise<void> {
  await assertOutcomeB2({
    ...options,
    assertOutcomeBPhase5Value1: options.assertOutcomeBPhase7Value1,
    assertOutcomeBPhase5Observed: options.assertOutcomeBPhase7Observed,
  })
}
