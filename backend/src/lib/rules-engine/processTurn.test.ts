import { describe, expect, it } from "vitest"
import { createActionSubmissionStub } from "#lib/rules-engine/actions/ActionSubmission.stub.ts"
import { ResourceType } from "#lib/rules-engine/mechanics/ResourceType.ts"
import { processTurn } from "#lib/rules-engine/processTurn.ts"
import { createTurnStateStub } from "#lib/rules-engine/TurnState.stub.ts"
import { MakeMoreMoney } from "#lib/ruleset/action-definitions/make-more-money.ts"
import { WinTheGame } from "#lib/ruleset/action-definitions/win-the-game.ts"
import { Ruleset } from "#lib/ruleset/Ruleset.ts"

describe("processTurn", () => {
  const playerId = "player-id"

  it.each([
    { actionDefinitionId: MakeMoreMoney.id, money: 1 },
    { actionDefinitionId: WinTheGame.id, money: 9 },
  ])("should not resolve $actionDefinitionId when the player does not have enough money", ({ actionDefinitionId, money }) => {
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
    const result = processTurn(turnState, Ruleset)

    // Assert
    expect(result.players[playerId]?.resources).toEqual({ [ResourceType.MONEY]: money })
    expect(result.winnerPlayerId).toBeUndefined()
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
    const result = processTurn(turnState, Ruleset)

    // Assert
    expect(result.players[playerId]?.resources).toEqual({ [ResourceType.MONEY]: 5 })
    expect(result.winnerPlayerId).toBeUndefined()
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
    const result = processTurn(turnState, Ruleset)

    // Assert
    expect(result.players[playerId]?.resources).toEqual({ [ResourceType.MONEY]: 0 })
    expect(result.winnerPlayerId).toBe(playerId)
  })
})
