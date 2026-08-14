import { describe, expect, it } from "vitest"
import type { ActionDefinition } from "#lib/rules-engine/actions/ActionDefinition.ts"
import { createActionSubmissionStub } from "#lib/rules-engine/actions/ActionSubmission.stub.ts"
import { ActionTier } from "#lib/rules-engine/actions/ActionTier.ts"
import { ActionType } from "#lib/rules-engine/actions/ActionType.ts"
import { CostMechanic } from "#lib/rules-engine/mechanics/implementations/CostMechanic.ts"
import { IncomeMechanic } from "#lib/rules-engine/mechanics/implementations/IncomeMechanic.ts"
import { MechanicTargetType } from "#lib/rules-engine/mechanics/MechanicTargetType.ts"
import { MechanicType } from "#lib/rules-engine/mechanics/MechanicType.ts"
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
    expect(result.state.players[playerId]?.resources).toEqual({ [ResourceType.MONEY]: money })
    expect(result.state.winnerPlayerId).toBeUndefined()
    expect(result.effectOutcomes).toEqual([
      {
        effectId: "action-submission-id:COST:0",
        effectType: MechanicType.COST,
        status: "FAILED",
        reason: "INSUFFICIENT_RESOURCES",
      },
      {
        effectId: "action-submission-id:MECHANIC:0",
        effectType: actionDefinitionId === MakeMoreMoney.id ? MechanicType.INCOME : MechanicType.VICTORY,
        status: "PREVENTED",
        reason: "COST_PAYMENT_FAILED",
      },
    ])
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
    expect(result.state.players[playerId]?.resources).toEqual({ [ResourceType.MONEY]: 5 })
    expect(result.state.winnerPlayerId).toBeUndefined()
    expect(result.effectOutcomes.map(({ effectType, status }) => ({ effectType, status }))).toEqual([
      { effectType: MechanicType.COST, status: "SUCCEEDED" },
      { effectType: MechanicType.INCOME, status: "SUCCEEDED" },
    ])
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
    expect(result.state.players[playerId]?.resources).toEqual({ [ResourceType.MONEY]: 0 })
    expect(result.state.winnerPlayerId).toBe(playerId)
    expect(result.effectOutcomes.map(({ effectType, status }) => ({ effectType, status }))).toEqual([
      { effectType: MechanicType.COST, status: "SUCCEEDED" },
      { effectType: MechanicType.VICTORY, status: "SUCCEEDED" },
    ])
  })

  it("should resolve a Mechanic target role through the Action target slot", () => {
    const beneficiaryId = "beneficiary-id"
    const targetedIncome: ActionDefinition = {
      id: "TARGETED_INCOME",
      name: "Targeted Income",
      type: ActionType.DIRECTIVE,
      tier: ActionTier.STANDARD,
      targets: {
        self: "",
        beneficiary: "",
      },
      costs: [
        CostMechanic.create({
          quantity: 2,
          resourceType: ResourceType.MONEY,
        }),
      ],
      mechanics: [
        IncomeMechanic.create({
          quantity: 5,
          resourceType: ResourceType.MONEY,
          player: {
            tag: "beneficiary",
            type: MechanicTargetType.PLAYER,
          },
        }),
      ],
    }
    const actionSubmission = createActionSubmissionStub({
      actionDefinitionId: targetedIncome.id,
      targets: {
        self: beneficiaryId,
        beneficiary: beneficiaryId,
      },
    })
    const turnState = createTurnStateStub({
      players: {
        [playerId]: {
          id: playerId,
          resources: { [ResourceType.MONEY]: 2 },
          actionSubmissions: [actionSubmission],
        },
        [beneficiaryId]: {
          id: beneficiaryId,
          resources: { [ResourceType.MONEY]: 0 },
          actionSubmissions: [],
        },
      },
    })

    const result = processTurn(turnState, {
      actionDefinitions: {
        [targetedIncome.id]: targetedIncome,
      },
    })

    expect(result.state.players[playerId]?.resources).toEqual({ [ResourceType.MONEY]: 0 })
    expect(result.state.players[beneficiaryId]?.resources).toEqual({ [ResourceType.MONEY]: 5 })
  })

  it("should pay all of a player's Action costs atomically", () => {
    const firstSubmission = createActionSubmissionStub({
      id: "action-a",
      actionDefinitionId: MakeMoreMoney.id,
      targets: { self: playerId },
    })
    const secondSubmission = createActionSubmissionStub({
      id: "action-b",
      actionDefinitionId: MakeMoreMoney.id,
      targets: { self: playerId },
    })
    const turnState = createTurnStateStub({
      players: {
        [playerId]: {
          id: playerId,
          resources: { [ResourceType.MONEY]: 3 },
          actionSubmissions: [secondSubmission, firstSubmission],
        },
      },
    })

    const result = processTurn(turnState, Ruleset)

    expect(result.state.players[playerId]?.resources).toEqual({ [ResourceType.MONEY]: 3 })
    expect(result.effectOutcomes.map(({ effectType, status }) => ({ effectType, status }))).toEqual([
      { effectType: MechanicType.COST, status: "FAILED" },
      { effectType: MechanicType.COST, status: "FAILED" },
      { effectType: MechanicType.INCOME, status: "PREVENTED" },
      { effectType: MechanicType.INCOME, status: "PREVENTED" },
    ])
  })

  it("should use stable Effect ordering instead of player insertion order", () => {
    const firstPlayerId = "first-player"
    const secondPlayerId = "second-player"
    const turnState = createTurnStateStub({
      players: {
        [secondPlayerId]: {
          id: secondPlayerId,
          resources: { [ResourceType.MONEY]: 10 },
          actionSubmissions: [
            createActionSubmissionStub({
              id: "submission-z",
              actionDefinitionId: WinTheGame.id,
              targets: { self: secondPlayerId },
            }),
          ],
        },
        [firstPlayerId]: {
          id: firstPlayerId,
          resources: { [ResourceType.MONEY]: 10 },
          actionSubmissions: [
            createActionSubmissionStub({
              id: "submission-a",
              actionDefinitionId: WinTheGame.id,
              targets: { self: firstPlayerId },
            }),
          ],
        },
      },
    })

    const result = processTurn(turnState, Ruleset)

    expect(result.state.winnerPlayerId).toBe(firstPlayerId)
    expect(
      result.effectOutcomes
        .filter(({ effectType }) => effectType === MechanicType.VICTORY)
        .map(({ effectId, status }) => ({ effectId, status })),
    ).toEqual([
      { effectId: "submission-a:MECHANIC:0", status: "SUCCEEDED" },
      { effectId: "submission-z:MECHANIC:0", status: "PREVENTED" },
    ])
  })

  it("should report an unknown Action Definition without crashing Turn Resolution", () => {
    const turnState = createTurnStateStub({
      players: {
        [playerId]: {
          id: playerId,
          resources: { [ResourceType.MONEY]: 10 },
          actionSubmissions: [
            createActionSubmissionStub({
              id: "unknown-action",
              actionDefinitionId: "UNKNOWN",
              targets: { self: playerId },
            }),
          ],
        },
      },
    })

    const result = processTurn(turnState, Ruleset)

    expect(result.invalidActionSubmissions).toEqual([
      {
        actionSubmissionId: "unknown-action",
        playerId,
        reason: "UNKNOWN_ACTION_DEFINITION",
      },
    ])
    expect(result.effectOutcomes).toEqual([])
  })
})
