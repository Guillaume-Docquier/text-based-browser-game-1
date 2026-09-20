import { branded, Result } from "@guillaume-docquier/tools-ts"
import { describe, expect, it } from "vitest"
import type { PlayerId } from "#lib/db/players/PlayerId.ts"
import { createSubmittedActionStub } from "#lib/rules-engine/action-submission/Action.stub.ts"
import { validateSubmittedActions } from "#lib/rules-engine/action-submission/validation/validateSubmittedActions.ts"
import { createActionDefinitionStub } from "#lib/rules-engine/ruleset-model/actions/ActionDefinition.stub.ts"
import { ResourceLossMechanic } from "#lib/rules-engine/ruleset-model/mechanics/implementations/ResourceLossMechanic.ts"
import { createResourcesStub } from "#lib/rules-engine/ruleset-model/mechanics/Resources.stub.ts"
import { ResourceType } from "#lib/rules-engine/ruleset-model/mechanics/ResourceType.ts"
import { TargetType } from "#lib/rules-engine/ruleset-model/mechanics/TargetType.ts"
import { createRulesetStub } from "#lib/rules-engine/ruleset-model/Ruleset.stub.ts"
import { OwnedBySubmittingPlayerConstraint } from "#lib/rules-engine/ruleset-model/target-constraints/implementations/OwnedBySubmittingPlayerConstraint.ts"
import { createTurnStateStub } from "#lib/rules-engine/turn-resolution/TurnState.stub.ts"

describe("validateSubmittedActions", () => {
  it("should keep unknown action definitions as ordinary issues and skip dependent validators", () => {
    // Arrange
    const submittedAction = createSubmittedActionStub({ actionDefinitionId: "UNKNOWN_ACTION" })
    const ruleset = createRulesetStub({ actionDefinitions: {} })
    const turnState = createTurnStateStub()

    // Act
    const result = validateSubmittedActions([submittedAction], ruleset, turnState)

    // Assert
    expect(result).toStrictEqual<typeof result>(
      Result.Success([
        {
          issue: "Action definition does not exist in the Ruleset",
          submittedActionId: submittedAction.id,
          actionDefinitionId: submittedAction.actionDefinitionId,
          actionDefinitionName: undefined,
        },
      ]),
    )
  })

  it("should combine ordinary validator issues in definition, target, and cost order", () => {
    // Arrange
    const playerId = branded<PlayerId>("player-id")
    const actionDefinition = createActionDefinitionStub({
      targets: { player: { type: TargetType.PLAYER, constraints: [] } },
      costs: [ResourceLossMechanic.create({ quantity: 1, resourceType: ResourceType.INFLUENCE })],
    })
    const submittedAction = createSubmittedActionStub({
      actionDefinitionId: actionDefinition.id,
      playerId,
      selectedTargets: {},
    })
    const unknownSubmittedAction = createSubmittedActionStub({ actionDefinitionId: "UNKNOWN_ACTION", playerId })
    const ruleset = createRulesetStub({ actionDefinitions: { [actionDefinition.id]: actionDefinition } })
    const turnState = createTurnStateStub({
      submittedActions: [unknownSubmittedAction, submittedAction],
      players: { [playerId]: { id: playerId, resources: createResourcesStub() } },
    })

    // Act
    const result = validateSubmittedActions(turnState.submittedActions, ruleset, turnState)

    // Assert
    expect(result).toStrictEqual<typeof result>(
      Result.Success([
        {
          issue: "Action definition does not exist in the Ruleset",
          submittedActionId: unknownSubmittedAction.id,
          actionDefinitionId: unknownSubmittedAction.actionDefinitionId,
          actionDefinitionName: undefined,
        },
        {
          issue: 'Missing target slot "player"',
          submittedActionId: submittedAction.id,
          actionDefinitionId: submittedAction.actionDefinitionId,
          actionDefinitionName: actionDefinition.name,
        },
        {
          issue: "Missing 1 INFLUENCE",
          submittedActionId: submittedAction.id,
          actionDefinitionId: submittedAction.actionDefinitionId,
          actionDefinitionName: actionDefinition.name,
        },
      ]),
    )
  })

  it("should return target evaluator failures without converting or discarding them", () => {
    // Arrange
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
    const ruleset = createRulesetStub({ actionDefinitions: { [actionDefinition.id]: actionDefinition } })
    const turnState = createTurnStateStub({
      submittedActions: [submittedAction],
      players: { [playerId]: { id: playerId, resources: createResourcesStub() } },
    })

    // Act
    const result = validateSubmittedActions([submittedAction], ruleset, turnState)

    // Assert
    expect(result).toStrictEqual<typeof result>(
      Result.Failure({
        type: "SUBMITTED_ACTION_VALIDATION_ERROR",
        submittedActionId: submittedAction.id,
        actionDefinitionId: actionDefinition.id,
        targetTag: "player",
        message: `Could not evaluate target constraint "OWNED_BY_SUBMITTING_PLAYER" for target slot "player" on submitted action "${submittedAction.id}": Target constraint "OWNED_BY_SUBMITTING_PLAYER" does not support target type "PLAYER".`,
        cause: {
          type: "TARGET_CONSTRAINT_EVALUATION_ERROR",
          constraintType: "OWNED_BY_SUBMITTING_PLAYER",
          targetType: "PLAYER",
          message: 'Target constraint "OWNED_BY_SUBMITTING_PLAYER" does not support target type "PLAYER".',
        },
      }),
    )
  })
})
