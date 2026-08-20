import { Result } from "@guillaume-docquier/tools-ts"
import { describe, expect, it } from "vitest"
import { createSeededRng } from "#lib/createSeededRng.ts"
import { createActionSubmissionStub } from "#lib/rules-engine/action-submission/ActionSubmission.stub.ts"
import { createResourcesStub } from "#lib/rules-engine/ruleset-model/mechanics/Resources.stub.ts"
import { ResourceType } from "#lib/rules-engine/ruleset-model/mechanics/ResourceType.ts"
import { EffectOutcome } from "#lib/rules-engine/turn-resolution/effects/EffectOutcome.ts"
import { resolveTurn } from "#lib/rules-engine/turn-resolution/resolveTurn.ts"
import { ResolveTurnError } from "#lib/rules-engine/turn-resolution/ResolveTurnError.ts"
import { createTurnStateStub } from "#lib/rules-engine/turn-resolution/TurnState.stub.ts"
import { GainInfluence } from "#lib/rulesets/standard/action-definitions/gain-influence.ts"
import { WinTheGame } from "#lib/rulesets/standard/action-definitions/win-the-game.ts"
import { StandardRuleset } from "#lib/rulesets/standard/StandardRuleset.ts"

describe("resolveTurn", () => {
  const playerId = "player-id"

  it("should not resolve the turn when the player cannot afford an Action", () => {
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
          resources: createResourcesStub({
            [ResourceType.INFLUENCE]: 3,
            [ResourceType.METAL]: 2,
            [ResourceType.FUEL]: 1,
          }),
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
              actionDefinitionId: WinTheGame.id,
              // oxlint-disable-next-line typescript/no-non-null-assertion -- It's there
              actionDefinitionName: StandardRuleset.actionDefinitions[actionSubmission.actionDefinitionId]!.name,
              issue: "Missing 7 INFLUENCE",
            },
            {
              actionSubmissionId: actionSubmission.id,
              actionDefinitionId: WinTheGame.id,
              actionDefinitionName: WinTheGame.name,
              issue: "Missing 3 METAL",
            },
            {
              actionSubmissionId: actionSubmission.id,
              actionDefinitionId: WinTheGame.id,
              actionDefinitionName: WinTheGame.name,
              issue: "Missing 4 FUEL",
            },
            {
              actionSubmissionId: actionSubmission.id,
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
    const actionSubmission = createActionSubmissionStub({
      actionDefinitionId: GainInfluence.id,
      targets: { self: playerId },
    })
    const turnState = createTurnStateStub({
      actionSubmissions: [actionSubmission],
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
    const result = resolveTurn(turnState, StandardRuleset, createSeededRng())

    // Assert
    expect(result).toEqual<typeof result>(
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
            actionSubmission,
            actionOutcomes: [EffectOutcome.Resolved({ result: `Player "${playerId}" gained 5 INFLUENCE` })],
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
      actionDefinitionId: GainInfluence.id,
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
    const result = resolveTurn(turnState, StandardRuleset, createSeededRng())

    // Assert
    expect(result).toEqual<typeof result>(
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
            actionSubmission: firstPlayerActionSubmission,
            actionOutcomes: [EffectOutcome.Resolved({ result: `Player "${firstPlayerId}" gained 5 INFLUENCE` })],
          },
          {
            actionSubmission: secondPlayerActionSubmission,
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
    const actionSubmission = createActionSubmissionStub({
      actionDefinitionId: WinTheGame.id,
      targets: { self: playerId },
    })
    const turnState = createTurnStateStub({
      actionSubmissions: [actionSubmission],
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
    const result = resolveTurn(turnState, StandardRuleset, createSeededRng())

    // Assert
    expect(result).toEqual<typeof result>(
      Result.Success({
        players: {
          [playerId]: {
            id: playerId,
            resources: createResourcesStub(),
          },
        },
        resolvedActions: [
          {
            actionSubmission,
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
