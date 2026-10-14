import { expect } from "vitest"
import { observeTurnAndRollback, ownerPublicForces, logWorkerObservation } from "../fleet-worker/TurnProcessor.scenarios.ts"
import type { AssertEmptyObserved3Input } from "./TurnProcessor.ts"

export async function assertEmptyObserved3(input: AssertEmptyObserved3Input): Promise<void> {
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
    "[I2-06 natural three-owner Assault-only worker observation]",
    JSON.stringify({
      initialRngState: input.assertEmptyObservedPhase8Observed.rngState,
      draws: [{ value: input.assertEmptyObservedPhase8Value1, nextGeneratorState: input.draw.nextGeneratorState }],
      names: [],
      canonicalAssaultKeys: input.stationed
        .slice(0, 2)
        .map((fleet, index) => input.playerIds[index] + "/" + input.assaultActionIds[index] + "/" + fleet.id),
      selectedTieOrder:
        input.assertEmptyObservedPhase8Value1 < 0.5 ? [input.playerIds[1], input.playerIds[0]] : [input.playerIds[0], input.playerIds[1]],
      replayNextState: input.forward.rngState,
      workerNextState: emptyObserved.rngState,
    }),
  )
  expect(await input.turnProcessor.processNextDueTurn()).toBe("processed")
  const afterEmpty = await input.alice.client.gameplay.getPlayerView.query({ gameId: input.gameId })
  expect(ownerPublicForces(afterEmpty.fleets, input.playerIds, input.target.id)).toStrictEqual(input.actualForces)
}
