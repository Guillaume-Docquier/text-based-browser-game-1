import { branded, Result } from "@guillaume-docquier/tools-ts"
import { describe, expect, it } from "vitest"
import { createSeededRng } from "#lib/createSeededRng.ts"
import { type PlayerId } from "#lib/db/players/PlayerId.ts"
import { createSubmittedActionStub } from "#lib/rules-engine/action-submission/Action.stub.ts"
import { createResourcesStub } from "#lib/rules-engine/ruleset-model/mechanics/Resources.stub.ts"
import { ResourceType } from "#lib/rules-engine/ruleset-model/mechanics/ResourceType.ts"
import { EffectOutcome } from "#lib/rules-engine/turn-resolution/effects/EffectOutcome.ts"
import { resolveTurn } from "#lib/rules-engine/turn-resolution/resolveTurn.ts"
import { ResolveTurnError } from "#lib/rules-engine/turn-resolution/ResolveTurnError.ts"
import { createTurnStateStub } from "#lib/rules-engine/turn-resolution/TurnState.stub.ts"
import { GainInfluence } from "#lib/rulesets/standard/action-definitions/gain-influence.ts"
import { WinTheGame } from "#lib/rulesets/standard/action-definitions/win-the-game.ts"
import { TestRuleset } from "#lib/rulesets/test/TestRuleset.ts"

describe("resolveTurn", () => {
  const playerId = branded<PlayerId>("player-id")

  it("should not resolve the turn when the player cannot afford an Action", () => {
    // Arrange
    const submittedAction = createSubmittedActionStub({
      actionDefinitionId: WinTheGame.id,
      targets: { self: playerId },
    })
    const turnState = createTurnStateStub({
      submittedActions: [submittedAction],
      players: {
        [playerId]: {
          id: playerId,
          resources: createResourcesStub({
            [ResourceType.INFLUENCE]: 3,
            [ResourceType.METAL]: 2,
            [ResourceType.FUEL]: 1,
          }),
        },
      },
    })

    // Act
    const result = resolveTurn(turnState, TestRuleset, createSeededRng())

    // Assert
    expect(result).toStrictEqual<typeof result>(
      Result.Failure(
        ResolveTurnError.InvalidSubmissions({
          issues: [
            {
              submittedActionId: submittedAction.id,
              actionDefinitionId: WinTheGame.id,
              // oxlint-disable-next-line typescript/no-non-null-assertion -- It's there
              actionDefinitionName: TestRuleset.actionDefinitions[submittedAction.actionDefinitionId]!.name,
              issue: "Missing 7 INFLUENCE",
            },
            {
              submittedActionId: submittedAction.id,
              actionDefinitionId: WinTheGame.id,
              actionDefinitionName: WinTheGame.name,
              issue: "Missing 3 METAL",
            },
            {
              submittedActionId: submittedAction.id,
              actionDefinitionId: WinTheGame.id,
              actionDefinitionName: WinTheGame.name,
              issue: "Missing 4 FUEL",
            },
            {
              submittedActionId: submittedAction.id,
              actionDefinitionId: WinTheGame.id,
              actionDefinitionName: WinTheGame.name,
              issue: "Missing 5 ENERGY",
            },
          ],
        }),
      ),
    )
  })

  it("should gain influence", () => {
    // Arrange
    const submittedAction = createSubmittedActionStub({
      actionDefinitionId: GainInfluence.id,
      targets: { self: playerId },
    })
    const turnState = createTurnStateStub({
      submittedActions: [submittedAction],
      players: {
        [playerId]: {
          id: playerId,
          resources: createResourcesStub({
            [ResourceType.INFLUENCE]: 3,
            [ResourceType.METAL]: 2,
            [ResourceType.FUEL]: 1,
          }),
        },
      },
    })

    // Act
    const result = resolveTurn(turnState, TestRuleset, createSeededRng())

    // Assert
    expect(result).toStrictEqual<typeof result>(
      Result.Success({
        players: {
          [playerId]: {
            id: playerId,
            resources: createResourcesStub({
              [ResourceType.INFLUENCE]: 8,
              [ResourceType.METAL]: 2,
              [ResourceType.FUEL]: 1,
            }),
          },
        },
        resolvedActions: [
          {
            submittedAction,
            actionOutcomes: [EffectOutcome.Resolved({ result: `Player "${playerId}" gained 5 INFLUENCE` })],
          },
        ],
        winnerPlayerId: undefined,
      }),
    )
  })

  it("should resolve Action Submissions from multiple players", () => {
    // Arrange
    const firstPlayerId = branded<PlayerId>("first-player-id")
    const secondPlayerId = branded<PlayerId>("second-player-id")
    const firstPlayerSubmittedAction = createSubmittedActionStub({
      actionDefinitionId: GainInfluence.id,
      targets: { self: firstPlayerId },
    })
    const secondPlayerSubmittedAction = createSubmittedActionStub({
      actionDefinitionId: WinTheGame.id,
      targets: { self: secondPlayerId },
    })
    const turnState = createTurnStateStub({
      submittedActions: [firstPlayerSubmittedAction, secondPlayerSubmittedAction],
      players: {
        [firstPlayerId]: {
          id: firstPlayerId,
          resources: createResourcesStub({
            [ResourceType.INFLUENCE]: 3,
            [ResourceType.METAL]: 2,
            [ResourceType.FUEL]: 1,
          }),
        },
        [secondPlayerId]: {
          id: secondPlayerId,
          resources: createResourcesStub({
            [ResourceType.INFLUENCE]: 10,
            [ResourceType.METAL]: 5,
            [ResourceType.FUEL]: 5,
            [ResourceType.ENERGY]: 5,
          }),
        },
      },
    })

    // Act
    const result = resolveTurn(turnState, TestRuleset, createSeededRng())

    // Assert
    expect(result).toStrictEqual<typeof result>(
      Result.Success({
        players: {
          [firstPlayerId]: {
            id: firstPlayerId,
            resources: createResourcesStub({
              [ResourceType.INFLUENCE]: 8,
              [ResourceType.METAL]: 2,
              [ResourceType.FUEL]: 1,
            }),
          },
          [secondPlayerId]: {
            id: secondPlayerId,
            resources: createResourcesStub(),
          },
        },
        resolvedActions: [
          {
            submittedAction: firstPlayerSubmittedAction,
            actionOutcomes: [EffectOutcome.Resolved({ result: `Player "${firstPlayerId}" gained 5 INFLUENCE` })],
          },
          {
            submittedAction: secondPlayerSubmittedAction,
            actionOutcomes: [
              EffectOutcome.Resolved({ result: `Player "${secondPlayerId}" spent 10 INFLUENCE` }),
              EffectOutcome.Resolved({ result: `Player "${secondPlayerId}" spent 5 METAL` }),
              EffectOutcome.Resolved({ result: `Player "${secondPlayerId}" spent 5 ENERGY` }),
              EffectOutcome.Resolved({ result: `Player "${secondPlayerId}" spent 5 FUEL` }),
              EffectOutcome.Resolved({ result: `Player "${secondPlayerId}" wins the game` }),
            ],
          },
        ],
        winnerPlayerId: secondPlayerId,
      }),
    )
  })

  it("should win the game when the player can afford it", () => {
    // Arrange
    const submittedAction = createSubmittedActionStub({
      actionDefinitionId: WinTheGame.id,
      targets: { self: playerId },
    })
    const turnState = createTurnStateStub({
      submittedActions: [submittedAction],
      players: {
        [playerId]: {
          id: playerId,
          resources: createResourcesStub({
            [ResourceType.INFLUENCE]: 10,
            [ResourceType.METAL]: 5,
            [ResourceType.FUEL]: 5,
            [ResourceType.ENERGY]: 5,
          }),
        },
      },
    })

    // Act
    const result = resolveTurn(turnState, TestRuleset, createSeededRng())

    // Assert
    expect(result).toStrictEqual<typeof result>(
      Result.Success({
        players: {
          [playerId]: {
            id: playerId,
            resources: createResourcesStub(),
          },
        },
        resolvedActions: [
          {
            submittedAction,
            actionOutcomes: [
              EffectOutcome.Resolved({ result: `Player "${playerId}" spent 10 INFLUENCE` }),
              EffectOutcome.Resolved({ result: `Player "${playerId}" spent 5 METAL` }),
              EffectOutcome.Resolved({ result: `Player "${playerId}" spent 5 ENERGY` }),
              EffectOutcome.Resolved({ result: `Player "${playerId}" spent 5 FUEL` }),
              EffectOutcome.Resolved({ result: `Player "${playerId}" wins the game` }),
            ],
          },
        ],
        winnerPlayerId: playerId,
      }),
    )
  })
})
