import { branded, Logger, Time, UnitOfTime } from "@guillaume-docquier/tools-ts"
import { describe, expect, it } from "vitest"
import type { Clock } from "#lib/Clock.ts"
import { ControlledClock } from "#lib/ControlledClock.ts"
import { createDbMock } from "#lib/db/createDb.mock.ts"
import { createCreateTransaction } from "#lib/db/createDb.ts"
import type { GameId } from "#lib/db/games/GameId.ts"
import type { PlayerId } from "#lib/db/players/PlayerId.ts"
import { indexById } from "#lib/indexById.ts"
import { createSubmittedActionStub } from "#lib/rules-engine/action-submission/Action.stub.ts"
import { createActionDefinitionStub } from "#lib/rules-engine/ruleset-model/actions/ActionDefinition.stub.ts"
import { createResourcesStub } from "#lib/rules-engine/ruleset-model/mechanics/Resources.stub.ts"
import { TargetType } from "#lib/rules-engine/ruleset-model/mechanics/TargetType.ts"
import { createRulesetStub } from "#lib/rules-engine/ruleset-model/Ruleset.stub.ts"
import { OwnedBySubmittingPlayerConstraint } from "#lib/rules-engine/ruleset-model/target-constraints/implementations/OwnedBySubmittingPlayerConstraint.ts"
import { TurnProcessor } from "#turn-processing/TurnProcessor.ts"
import { TurnsRepositoryMock } from "#turn-processing/turns.repository.mock.ts"
import type { TurnToProcessModel } from "#turn-processing/turns.repository.ts"

describe("TurnProcessor validation failures", () => {
  it("should leave a failed validation attempt unsaved and retryable", async () => {
    // Arrange
    const db = await createDbMock()
    const logger = Logger.get()
    const clock: Clock = new ControlledClock()
    const gameId = branded<GameId>(1)
    const playerId = branded<PlayerId>("player-id")
    const actionDefinition = createActionDefinitionStub({
      targets: {
        player: {
          type: TargetType.PLAYER,
          constraints: [OwnedBySubmittingPlayerConstraint.create()],
        },
      },
    })
    const submittedAction = createSubmittedActionStub({
      actionDefinitionId: actionDefinition.id,
      playerId,
      selectedTargets: { player: String(playerId) },
    })
    const turnToProcess: TurnToProcessModel = {
      gameId,
      turn: 1,
      closedAt: clock.now(),
      turnInterval: Time.create(10, UnitOfTime.SECONDS),
      rngState: { generatorState: 1, spareNormal: null },
      submittedActions: [submittedAction],
      players: indexById([{ id: playerId, resources: createResourcesStub() }]),
      planets: {},
      fleets: {},
      ruleset: createRulesetStub({ actionDefinitions: { [actionDefinition.id]: actionDefinition } }),
    }
    const turnsRepository = new TurnsRepositoryMock({ db, logger, turnToProcess })
    const turnProcessor = new TurnProcessor({
      logger,
      turnsRepository,
      clock,
      createTransaction: createCreateTransaction(db),
    })

    // Act
    const result = await turnProcessor.processNextDueTurn()

    // Assert
    expect(result).toBe("failed")
    expect(turnsRepository.saveCalls).toBe(0)
    expect(turnsRepository.resetCalls).toBe(1)
  })
})
