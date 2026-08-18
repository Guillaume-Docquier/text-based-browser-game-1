import { Assert, Result } from "@guillaume-docquier/tools-ts"
import { describe, expect, it } from "vitest"
import { createSeededRng } from "#lib/createSeededRng.ts"
import { createActionSubmissionStub } from "#lib/rules-engine/action-submission/ActionSubmission.stub.ts"
import { ResourceType } from "#lib/rules-engine/ruleset-model/mechanics/ResourceType.ts"
import { EffectOutcome } from "#lib/rules-engine/turn-resolution/effects/EffectOutcome.ts"
import { resolveTurn } from "#lib/rules-engine/turn-resolution/resolveTurn.ts"
import { ResolveTurnError } from "#lib/rules-engine/turn-resolution/ResolveTurnError.ts"
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
      actionSubmissions: [actionSubmission],
      players: {
        [playerId]: {
          id: playerId,
          resources: { [ResourceType.MONEY]: money },
        },
      },
    })

    // Act
    const result = resolveTurn(turnState, StandardRuleset, createSeededRng())

    // Assert
    expect(result).toEqual<typeof result>(
      Result.Failure(
        ResolveTurnError.InvalidSubmissions({
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
      ),
    )
  })

  it("should make more money when the player has enough money", () => {
    // Arrange
    const actionSubmission = createActionSubmissionStub({
      actionDefinitionId: MakeMoreMoney.id,
      targets: { self: playerId },
    })
    const turnState = createTurnStateStub({
      actionSubmissions: [actionSubmission],
      players: {
        [playerId]: {
          id: playerId,
          resources: { [ResourceType.MONEY]: 2 },
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
            id: playerId,
            resources: {
              MONEY: 5,
            },
          },
        },
        resolvedActions: [
          {
            actionSubmission,
            actionOutcomes: [
              EffectOutcome.Resolved({ result: `Player "${playerId}" spent 2 MONEY` }),
              EffectOutcome.Resolved({ result: `Player "${playerId}" gained 5 MONEY` }),
            ],
          },
        ],
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
      actionSubmissions: [firstPlayerActionSubmission, secondPlayerActionSubmission],
      players: {
        [firstPlayerId]: {
          id: firstPlayerId,
          resources: { [ResourceType.MONEY]: 2 },
        },
        [secondPlayerId]: {
          id: secondPlayerId,
          resources: { [ResourceType.MONEY]: 10 },
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
            id: firstPlayerId,
            resources: {
              MONEY: 5,
            },
          },
          [secondPlayerId]: {
            id: secondPlayerId,
            resources: {
              MONEY: 0,
            },
          },
        },
        resolvedActions: [
          {
            actionSubmission: firstPlayerActionSubmission,
            actionOutcomes: [
              EffectOutcome.Resolved({ result: `Player "${firstPlayerId}" spent 2 MONEY` }),
              EffectOutcome.Resolved({ result: `Player "${firstPlayerId}" gained 5 MONEY` }),
            ],
          },
          {
            actionSubmission: secondPlayerActionSubmission,
            actionOutcomes: [
              EffectOutcome.Resolved({ result: `Player "${secondPlayerId}" spent 10 MONEY` }),
              EffectOutcome.Resolved({ result: `Player "${secondPlayerId}" wins the game` }),
            ],
          },
        ],
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
      actionSubmissions: [actionSubmission],
      players: {
        [playerId]: {
          id: playerId,
          resources: { [ResourceType.MONEY]: 10 },
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
            id: playerId,
            resources: {
              MONEY: 0,
            },
          },
        },
        resolvedActions: [
          {
            actionSubmission,
            actionOutcomes: [
              EffectOutcome.Resolved({ result: `Player "${playerId}" spent 10 MONEY` }),
              EffectOutcome.Resolved({ result: `Player "${playerId}" wins the game` }),
            ],
          },
        ],
        winnerPlayerId: playerId,
      }),
    )
  })
})
