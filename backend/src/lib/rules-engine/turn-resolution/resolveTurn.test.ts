import { Assert, Result } from "@guillaume-docquier/tools-ts"
import { describe, expect, it } from "vitest"
import { createSeededRng } from "#lib/createSeededRng.ts"
import { createActionSubmissionStub } from "#lib/rules-engine/action-submission/ActionSubmission.stub.ts"
import { ResourceType } from "#lib/rules-engine/ruleset/mechanics/ResourceType.ts"
import { resolveTurn } from "#lib/rules-engine/turn-resolution/resolveTurn.ts"
import { createTurnStateStub } from "#lib/rules-engine/turn-resolution/TurnState.stub.ts"
import { MakeMoreMoney } from "#lib/ruleset/v1/action-definitions/make-more-money.ts"
import { WinTheGame } from "#lib/ruleset/v1/action-definitions/win-the-game.ts"
import { RulesetV1 } from "#lib/ruleset/v1/RulesetV1.ts"

describe("resolveTurn", () => {
  const playerId = "player-id"

  it.each([
    { actionDefinitionId: MakeMoreMoney.id, money: 1 },
    { actionDefinitionId: WinTheGame.id, money: 9 },
  ])("should not resolve the turn when the player does not have enough money for $actionDefinitionId", ({ actionDefinitionId, money }) => {
    // Arrange
    const actionSubmission = createActionSubmissionStub({
      actionDefinitionId,
      targets: { self: playerId },
    })
    const turnState = createTurnStateStub({
      players: {
        [playerId]: {
          id: playerId,
          resources: { [ResourceType.MONEY]: money },
          actionSubmissions: [actionSubmission],
        },
      },
    })

    // Act
    const result = resolveTurn(turnState, RulesetV1, createSeededRng())

    // Assert
    expect(result).toEqual<typeof result>(
      Result.Failure({
        _tag: "INVALID_SUBMISSIONS",
        issues: [{ issue: expect.stringContaining(actionDefinitionId) }],
      }),
    )
  })

  it("should make more money when the player has enough money", () => {
    // Arrange
    const actionSubmission = createActionSubmissionStub({
      actionDefinitionId: MakeMoreMoney.id,
      targets: { self: playerId },
    })
    const turnState = createTurnStateStub({
      players: {
        [playerId]: {
          id: playerId,
          resources: { [ResourceType.MONEY]: 2 },
          actionSubmissions: [actionSubmission],
        },
      },
    })

    // Act
    const result = resolveTurn(turnState, RulesetV1, createSeededRng())
    Assert.isSuccess(result)

    // Assert
    expect(result).toEqual<typeof result>(
      Result.Success({
        players: {
          [playerId]: {
            actionSubmissions: [actionSubmission],
            id: playerId,
            resources: {
              MONEY: 5,
            },
          },
        },
        winnerPlayerId: undefined,
      }),
    )
  })

  it("should win the game when the player has enough money", () => {
    // Arrange
    const actionSubmission = createActionSubmissionStub({
      actionDefinitionId: WinTheGame.id,
      targets: { self: playerId },
    })
    const turnState = createTurnStateStub({
      players: {
        [playerId]: {
          id: playerId,
          resources: { [ResourceType.MONEY]: 10 },
          actionSubmissions: [actionSubmission],
        },
      },
    })

    // Act
    const result = resolveTurn(turnState, RulesetV1, createSeededRng())

    // Assert
    expect(result).toEqual<typeof result>(
      Result.Success({
        players: {
          [playerId]: {
            actionSubmissions: [actionSubmission],
            id: playerId,
            resources: {
              MONEY: 0,
            },
          },
        },
        winnerPlayerId: playerId,
      }),
    )
  })
})
