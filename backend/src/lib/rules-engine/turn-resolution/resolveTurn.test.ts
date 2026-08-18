import { Assert, Result } from "@guillaume-docquier/tools-ts"
import { describe, expect, it } from "vitest"
import { createSeededRng } from "#lib/createSeededRng.ts"
import { createActionSubmissionStub } from "#lib/rules-engine/action-submission/ActionSubmission.stub.ts"
import { ResourceType } from "#lib/rules-engine/ruleset-model/mechanics/ResourceType.ts"
import { resolveTurn } from "#lib/rules-engine/turn-resolution/resolveTurn.ts"
import { createTurnStateStub } from "#lib/rules-engine/turn-resolution/TurnState.stub.ts"
import { MakeMoreMoney } from "#lib/rulesets/standard/action-definitions/make-more-money.ts"
import { WinTheGame } from "#lib/rulesets/standard/action-definitions/win-the-game.ts"
import { StandardRuleset } from "#lib/rulesets/standard/StandardRuleset.ts"

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
    const result = resolveTurn(turnState, StandardRuleset, createSeededRng())

    // Assert
    expect(result).toEqual<typeof result>(
      Result.Failure({
        _tag: "INVALID_SUBMISSIONS",
        issues: [
          {
            actionSubmissionId: actionSubmission.id,
            actionDefinitionId,
            // oxlint-disable-next-line typescript/no-non-null-assertion -- It's there
            actionDefinitionName: StandardRuleset.actionDefinitions[actionSubmission.actionDefinitionId]!.name,
            issue: "Missing 1 MONEY",
          },
        ],
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
    const result = resolveTurn(turnState, StandardRuleset, createSeededRng())
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

  it("should resolve Action Submissions from multiple players", () => {
    // Arrange
    const firstPlayerId = "first-player-id"
    const secondPlayerId = "second-player-id"
    const firstPlayerActionSubmission = createActionSubmissionStub({
      actionDefinitionId: MakeMoreMoney.id,
      targets: { self: firstPlayerId },
    })
    const secondPlayerActionSubmission = createActionSubmissionStub({
      actionDefinitionId: WinTheGame.id,
      targets: { self: secondPlayerId },
    })
    const turnState = createTurnStateStub({
      players: {
        [firstPlayerId]: {
          id: firstPlayerId,
          resources: { [ResourceType.MONEY]: 2 },
          actionSubmissions: [firstPlayerActionSubmission],
        },
        [secondPlayerId]: {
          id: secondPlayerId,
          resources: { [ResourceType.MONEY]: 10 },
          actionSubmissions: [secondPlayerActionSubmission],
        },
      },
    })

    // Act
    const result = resolveTurn(turnState, StandardRuleset, createSeededRng())

    // Assert
    expect(result).toEqual<typeof result>(
      Result.Success({
        players: {
          [firstPlayerId]: {
            actionSubmissions: [firstPlayerActionSubmission],
            id: firstPlayerId,
            resources: {
              MONEY: 5,
            },
          },
          [secondPlayerId]: {
            actionSubmissions: [secondPlayerActionSubmission],
            id: secondPlayerId,
            resources: {
              MONEY: 0,
            },
          },
        },
        winnerPlayerId: secondPlayerId,
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
    const result = resolveTurn(turnState, StandardRuleset, createSeededRng())

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
