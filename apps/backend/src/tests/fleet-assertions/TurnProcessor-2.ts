import { expect } from "vitest"
import { observeTurnAndRollback, ownerPublicForces, logWorkerObservation } from "../fleet-worker/TurnProcessor.scenarios.ts"
import type { AssertEmptyObserved3Input } from "./TurnProcessor.ts"

export async function assertEmptyObserved3({
  clients,
  gameId,
  emptyTurn,
  db,
  clock,
  turnsRepository,
  forward,
  assertEmptyObservedPhase8Observed,
  assertEmptyObservedPhase8Value1,
  draw,
  stationed,
  playerIds,
  assaultActionIds,
  turnProcessor,
  alice,
  target,
  actualForces,
}: AssertEmptyObserved3Input): Promise<void> {
  await Promise.all(
    clients.map(async ({ client }) => await client.gameplay.updateReadiness.mutate({ gameId, turn: emptyTurn.turn, isReady: true })),
  )
  const emptyObserved = await observeTurnAndRollback({ db, clock, turnsRepository, gameId, turn: emptyTurn.turn })
  expect(emptyObserved.submittedActions).toStrictEqual([])
  expect(emptyObserved.rngState).toStrictEqual(forward.rngState)
  logWorkerObservation(
    "[I2-06 natural three-owner Assault-only worker observation]",
    JSON.stringify({
      initialRngState: assertEmptyObservedPhase8Observed.rngState,
      draws: [{ value: assertEmptyObservedPhase8Value1, nextGeneratorState: draw.nextGeneratorState }],
      names: [],
      canonicalAssaultKeys: stationed.slice(0, 2).map((fleet, index) => playerIds[index] + "/" + assaultActionIds[index] + "/" + fleet.id),
      selectedTieOrder: assertEmptyObservedPhase8Value1 < 0.5 ? [playerIds[1], playerIds[0]] : [playerIds[0], playerIds[1]],
      replayNextState: forward.rngState,
      workerNextState: emptyObserved.rngState,
    }),
  )
  expect(await turnProcessor.processNextDueTurn()).toBe("processed")
  const afterEmpty = await alice.client.gameplay.getPlayerView.query({ gameId })
  expect(ownerPublicForces(afterEmpty.fleets, playerIds, target.id)).toStrictEqual(actualForces)
}
