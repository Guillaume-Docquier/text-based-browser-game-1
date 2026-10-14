import { Assert } from "@guillaume-docquier/tools-ts"
import type { PlayerId } from "shared/domain/players/PlayerId.ts"
import type { EffectOutcome } from "shared/domain/turns/actions/EffectOutcome.ts"
import { expect } from "vitest"
import type { Fleet, Action, PlayerView } from "#api/types.ts"
import type { ControlledClock } from "#lib/ControlledClock.ts"
import type { Database } from "#lib/db/createDb.ts"
import type { reverseWorkerInputEnumeration } from "#tests/fleet-concurrency/gameplay.ts"
import type { replayObservedTurn as CapturedreplayObservedTurn } from "#tests/fleet-worker/TurnProcessor.scenarios.ts"
import type { createPublicHomeArrivalFixture as CapturedcreatePublicHomeArrivalFixture } from "#tests/fleet-worker/TurnProcessor.ts"
import { processPublicTurn, observeTurnAndRollback } from "../fleet-worker/TurnProcessor.scenarios.ts"
import { assertOwnerIndex } from "./TurnProcessor.assault-arithmetic-2.ts"

export async function createEmptyObservedSetup(input: CreateEmptyObservedSetupInput): Promise<CreateEmptyObservedSetupResult> {
  expect(input.mergeResults).toHaveLength(1)
  expect(input.attackResults).toHaveLength(1)
  const attackOutcome = input.attackResults[0]
  Assert.isDefined(attackOutcome)
  expect(attackOutcome.result).toContain("exchanged 20 Strength with 20 enemy Strength")
  const ordinaryContinuations = input.forward.resolved.resolvedContinuations.filter(
    ({ originatingSubmission }) =>
      originatingSubmission.playerId === input.playerAId && originatingSubmission.id === input.ordinaryAction.id,
  )
  expect(ordinaryContinuations).toHaveLength(1)
  const ordinaryContinuation = ordinaryContinuations[0]
  Assert.isDefined(ordinaryContinuation)
  expect(
    ordinaryContinuation.actionOutcomes.filter((outcome) => outcome.type === "RESOLVED" && outcome.result.includes(" exchanged ")),
  ).toHaveLength(0)

  // Assert: the real worker saves the original friendly identity at22, preserves source8, removes all children/enemy, and charges once.
  expect(await input.fixture.turnProcessor.processNextDueTurn()).toBe("processed")
  const afterCombat = await Promise.all(
    input.fixture.clients.map(async ({ client }) => await client.gameplay.getPlayerView.query({ gameId: input.fixture.gameId })),
  )

  assertOwnerIndex({ ...input, afterCombat })

  const nextTurn = afterCombat[0]
  Assert.isDefined(nextTurn)
  await processPublicTurn({
    clients: input.fixture.clients,
    gameId: input.fixture.gameId,
    turn: nextTurn.turn,
    turnProcessor: input.fixture.turnProcessor,
    process: false,
  })
  const emptyObserved = await observeTurnAndRollback({
    ...input,
    turnsRepository: input.fixture.turnsRepository,
    gameId: input.fixture.gameId,
    turn: nextTurn.turn,
  })
  return { emptyObserved }
}

export type CreateEmptyObservedSetupInput = {
  mergeResults: EffectOutcome[]
  attackResults: Array<Readonly<{ type: "RESOLVED"; result: string }>>
  forward: ReturnType<typeof CapturedreplayObservedTurn>
  playerAId: PlayerId
  ordinaryAction: Action
  fixture: Awaited<ReturnType<typeof CapturedcreatePublicHomeArrivalFixture>>
  beforeCombatViews: PlayerView[]
  initialFriendly: Fleet
  enemy: Fleet
  attackJourney: Fleet
  ordinaryJourney: Fleet
  attackerSource: Fleet
  attackAction: Action
  buildAction: Action
  db: Database
  clock: ControlledClock
}

export type CreateEmptyObservedSetupResult = { emptyObserved: ReturnType<typeof reverseWorkerInputEnumeration> }
