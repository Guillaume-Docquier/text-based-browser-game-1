import { branded, Logger, Result } from "@guillaume-docquier/tools-ts"
import { describe, expect, it } from "vitest"
import { GameplayController } from "#api/gameplay/gameplay.controller.ts"
import { GameplayRepositoryMock } from "#api/gameplay/gameplay.repository.mock.ts"
import type { ActionSubmissionsForUpdate } from "#api/gameplay/gameplay.repository.ts"
import { ControlledClock } from "#lib/ControlledClock.ts"
import type { ActionId } from "#lib/db/actions/ActionId.ts"
import { createDbMock } from "#lib/db/createDb.mock.ts"
import { createCreateTransaction } from "#lib/db/createDb.ts"
import type { GameId } from "#lib/db/games/GameId.ts"
import type { PlayerId } from "#lib/db/players/PlayerId.ts"
import { createSubmittedActionStub } from "#lib/rules-engine/action-submission/Action.stub.ts"
import { createActionDefinitionStub } from "#lib/rules-engine/ruleset-model/actions/ActionDefinition.stub.ts"
import { createResourcesStub } from "#lib/rules-engine/ruleset-model/mechanics/Resources.stub.ts"
import { TargetType } from "#lib/rules-engine/ruleset-model/mechanics/TargetType.ts"
import { createRulesetStub } from "#lib/rules-engine/ruleset-model/Ruleset.stub.ts"
import { OwnedBySubmittingPlayerConstraint } from "#lib/rules-engine/ruleset-model/target-constraints/implementations/OwnedBySubmittingPlayerConstraint.ts"

describe("GameplayController", () => {
  it("should safely reject validation failures without saving the submission", async () => {
    // Arrange
    const db = await createDbMock()
    const logger = Logger.get()
    const playerId = branded<PlayerId>("player-id")
    const gameId = branded<GameId>(1)
    const actionId = branded<ActionId>("action-id")
    const actionDefinition = createActionDefinitionStub({
      targets: {
        player: {
          type: TargetType.PLAYER,
          constraints: [OwnedBySubmittingPlayerConstraint.create()],
        },
      },
    })
    const submittedAction = createSubmittedActionStub({
      id: actionId,
      actionDefinitionId: actionDefinition.id,
      playerId,
      selectedTargets: { player: String(playerId) },
    })
    const actionSubmissionsContext = branded<ActionSubmissionsForUpdate>({
      gameId,
      playerId,
      turn: 1,
      resources: createResourcesStub(),
      actions: [{ ...submittedAction, selectedTargets: null }],
      ruleset: createRulesetStub({ actionDefinitions: { [actionDefinition.id]: actionDefinition } }),
    })
    const clock = new ControlledClock()
    const gameplayRepository = new GameplayRepositoryMock({ db, logger, clock, actionSubmissionsContext })
    const gameplayController = new GameplayController({
      logger,
      clock,
      gameplayRepository,
      createTransaction: createCreateTransaction(db),
    })

    // Act
    const result = await gameplayController.updateActionSubmission({
      gameId,
      playerId,
      turn: 1,
      submittedActionTargets: {
        actionId,
        selectedTargets: submittedAction.selectedTargets,
      },
    })

    // Assert
    expect(result).toStrictEqual<typeof result>(Result.Failure("Could not validate action submission, see logs for more details."))
    expect(gameplayRepository.updateCalls).toBe(0)
  })

  it("should load a selected opponent Player before validating the submission", async () => {
    // Arrange
    const db = await createDbMock()
    const logger = Logger.get()
    const playerId = branded<PlayerId>("player-id")
    const opponentPlayerId = branded<PlayerId>("opponent-player-id")
    const gameId = branded<GameId>(1)
    const actionId = branded<ActionId>("action-id")
    const actionDefinition = createActionDefinitionStub({
      targets: { player: { type: TargetType.PLAYER, constraints: [] } },
    })
    const submittedAction = createSubmittedActionStub({
      id: actionId,
      actionDefinitionId: actionDefinition.id,
      playerId,
      selectedTargets: { player: opponentPlayerId },
    })
    const actionSubmissionsContext = branded<ActionSubmissionsForUpdate>({
      gameId,
      playerId,
      turn: 1,
      resources: createResourcesStub(),
      actions: [{ ...submittedAction, selectedTargets: null }],
      ruleset: createRulesetStub({ actionDefinitions: { [actionDefinition.id]: actionDefinition } }),
    })
    const clock = new ControlledClock()
    const gameplayRepository = new GameplayRepositoryMock({
      db,
      logger,
      clock,
      actionSubmissionsContext,
      targetPlayers: [{ id: opponentPlayerId, resources: createResourcesStub() }],
    })
    const gameplayController = new GameplayController({
      logger,
      clock,
      gameplayRepository,
      createTransaction: createCreateTransaction(db),
    })

    // Act
    const result = await gameplayController.updateActionSubmission({
      gameId,
      playerId,
      turn: 1,
      submittedActionTargets: {
        actionId,
        selectedTargets: submittedAction.selectedTargets,
      },
    })

    // Assert
    expect(result).toStrictEqual(Result.Success(undefined))
    expect(gameplayRepository.updateCalls).toBe(1)
  })
})
