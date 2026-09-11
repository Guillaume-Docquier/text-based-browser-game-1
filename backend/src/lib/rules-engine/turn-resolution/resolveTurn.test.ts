import { branded, Result } from "@guillaume-docquier/tools-ts"
import { describe, expect, it } from "vitest"
import { createSeededRng } from "#lib/createSeededRng.ts"
import type { FleetId } from "#lib/db/fleets/FleetId.ts"
import type { GameId } from "#lib/db/games/GameId.ts"
import type { PlanetId } from "#lib/db/planets/PlanetId.ts"
import type { PlayerId } from "#lib/db/players/PlayerId.ts"
import { indexById } from "#lib/indexById.ts"
import { createSubmittedActionStub } from "#lib/rules-engine/action-submission/Action.stub.ts"
import { createResourcesStub } from "#lib/rules-engine/ruleset-model/mechanics/Resources.stub.ts"
import { ResourceType } from "#lib/rules-engine/ruleset-model/mechanics/ResourceType.ts"
import { EffectOutcome } from "#lib/rules-engine/turn-resolution/effects/EffectOutcome.ts"
import { resolveTurn } from "#lib/rules-engine/turn-resolution/resolveTurn.ts"
import { ResolveTurnError } from "#lib/rules-engine/turn-resolution/ResolveTurnError.ts"
import { createTurnStateStub } from "#lib/rules-engine/turn-resolution/TurnState.stub.ts"
import { BuildFleetStandard } from "#lib/rulesets/standard/action-definitions/build-fleet.ts"
import { GainInfluence } from "#lib/rulesets/standard/action-definitions/gain-influence.ts"
import { WinTheGame } from "#lib/rulesets/standard/action-definitions/win-the-game.ts"
import { TestRuleset } from "#lib/rulesets/test/TestRuleset.ts"

describe("resolveTurn", () => {
  const gameId = branded<GameId>(1)
  const playerId = branded<PlayerId>("player-id")

  it("should not resolve the turn when the player cannot afford an Action", () => {
    // Arrange
    const submittedAction = createSubmittedActionStub({ actionDefinitionId: WinTheGame.id, playerId })
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
    const result = resolveTurn(gameId, turnState, TestRuleset, createSeededRng())

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
    const submittedAction = createSubmittedActionStub({ actionDefinitionId: GainInfluence.id, playerId })
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
    const result = resolveTurn(gameId, turnState, TestRuleset, createSeededRng())

    // Assert
    expect(result).toStrictEqual<typeof result>(
      Result.Success({
        resolvedActions: [
          {
            submittedAction,
            actionOutcomes: [EffectOutcome.Resolved({ result: `Player "${playerId}" gained 5 INFLUENCE` })],
          },
        ],
        players: indexById([
          {
            id: playerId,
            resources: createResourcesStub({
              [ResourceType.INFLUENCE]: 8,
              [ResourceType.METAL]: 2,
              [ResourceType.FUEL]: 1,
            }),
          },
        ]),
        planets: {},
        fleets: {},
        winnerPlayerId: undefined,
      }),
    )
  })

  it("should resolve Action Submissions from multiple players", () => {
    // Arrange
    const firstPlayerId = branded<PlayerId>("first-player-id")
    const secondPlayerId = branded<PlayerId>("second-player-id")
    const firstPlayerSubmittedAction = createSubmittedActionStub({ actionDefinitionId: GainInfluence.id, playerId: firstPlayerId })
    const secondPlayerSubmittedAction = createSubmittedActionStub({ actionDefinitionId: WinTheGame.id, playerId: secondPlayerId })
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
    const result = resolveTurn(gameId, turnState, TestRuleset, createSeededRng())

    // Assert
    expect(result).toStrictEqual<typeof result>(
      Result.Success({
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
        players: indexById([
          {
            id: firstPlayerId,
            resources: createResourcesStub({
              [ResourceType.INFLUENCE]: 8,
              [ResourceType.METAL]: 2,
              [ResourceType.FUEL]: 1,
            }),
          },
          {
            id: secondPlayerId,
            resources: createResourcesStub(),
          },
        ]),
        planets: {},
        fleets: {},
        winnerPlayerId: secondPlayerId,
      }),
    )
  })

  it("should win the game when the player can afford it", () => {
    // Arrange
    const submittedAction = createSubmittedActionStub({ actionDefinitionId: WinTheGame.id, playerId })
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
    const result = resolveTurn(gameId, turnState, TestRuleset, createSeededRng())

    // Assert
    expect(result).toStrictEqual<typeof result>(
      Result.Success({
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
        players: indexById([{ id: playerId, resources: createResourcesStub() }]),
        planets: {},
        fleets: {},
        winnerPlayerId: playerId,
      }),
    )
  })

  it("should create a fleet with a deterministic ID", () => {
    // Arrange
    const planetId = branded<PlanetId>(1)
    const submittedAction = createSubmittedActionStub({
      actionDefinitionId: BuildFleetStandard.id,
      playerId,
      targets: { planet: String(planetId) },
    })
    const turnState = createTurnStateStub({
      submittedActions: [submittedAction],
      players: {
        [playerId]: {
          id: playerId,
          resources: createResourcesStub({
            [ResourceType.INFLUENCE]: 2,
            [ResourceType.METAL]: 1,
          }),
        },
      },
      planets: indexById([{ id: planetId, x: 0, y: 0 }]),
    })

    // Act
    const result = resolveTurn(gameId, turnState, TestRuleset, createSeededRng())

    // Assert
    expect(result).toStrictEqual<typeof result>(
      Result.Success({
        resolvedActions: [
          {
            submittedAction,
            actionOutcomes: [
              EffectOutcome.Resolved({ result: `Player "${playerId}" spent 2 INFLUENCE` }),
              EffectOutcome.Resolved({ result: `Player "${playerId}" spent 1 METAL` }),
              EffectOutcome.Resolved({
                result: `Player "${playerId}" built Fleet "302894c5-2d2e-5801-a07a-23803eb73160" with strength 10 on Planet "${planetId}"`,
              }),
            ],
          },
        ],
        players: indexById([{ id: playerId, resources: createResourcesStub() }]),
        planets: indexById([{ id: planetId, x: 0, y: 0 }]),
        fleets: indexById([
          {
            id: branded<FleetId>("302894c5-2d2e-5801-a07a-23803eb73160"),
            playerId,
            strength: 10,
            originPlanetId: planetId,
          },
        ]),
        winnerPlayerId: undefined,
      }),
    )
  })

  it("should reinforce a friendly fleet without changing its ID", () => {
    // Arrange
    const planetId = branded<PlanetId>(1)
    const fleetId = branded<FleetId>("11111111-1111-4111-8111-111111111111")
    const submittedAction = createSubmittedActionStub({
      actionDefinitionId: BuildFleetStandard.id,
      playerId,
      targets: { planet: String(planetId) },
    })
    const turnState = createTurnStateStub({
      submittedActions: [submittedAction],
      players: {
        [playerId]: {
          id: playerId,
          resources: createResourcesStub({
            [ResourceType.INFLUENCE]: 2,
            [ResourceType.METAL]: 1,
          }),
        },
      },
      planets: indexById([{ id: planetId, x: 0, y: 0 }]),
      fleets: indexById([{ id: fleetId, playerId, strength: 5, originPlanetId: planetId }]),
    })

    // Act
    const result = resolveTurn(gameId, turnState, TestRuleset, createSeededRng())

    // Assert
    expect(result).toStrictEqual<typeof result>(
      Result.Success({
        resolvedActions: [
          {
            submittedAction,
            actionOutcomes: [
              EffectOutcome.Resolved({ result: `Player "${playerId}" spent 2 INFLUENCE` }),
              EffectOutcome.Resolved({ result: `Player "${playerId}" spent 1 METAL` }),
              EffectOutcome.Resolved({
                result: `Player "${playerId}" reinforced Fleet "${fleetId}" by 10 on Planet "${planetId}"`,
              }),
            ],
          },
        ],
        players: indexById([{ id: playerId, resources: createResourcesStub() }]),
        planets: indexById([{ id: planetId, x: 0, y: 0 }]),
        fleets: indexById([{ id: fleetId, playerId, strength: 15, originPlanetId: planetId }]),
        winnerPlayerId: undefined,
      }),
    )
  })

  it("should keep an enemy fleet separate when building on the same planet", () => {
    // Arrange
    const planetId = branded<PlanetId>(1)
    const enemyPlayerId = branded<PlayerId>("enemy-player-id")
    const enemyFleetId = branded<FleetId>("22222222-2222-4222-8222-222222222222")
    const submittedAction = createSubmittedActionStub({
      actionDefinitionId: BuildFleetStandard.id,
      playerId,
      targets: { planet: String(planetId) },
    })
    const turnState = createTurnStateStub({
      submittedActions: [submittedAction],
      players: {
        [playerId]: { id: playerId, resources: createResourcesStub({ [ResourceType.INFLUENCE]: 2, [ResourceType.METAL]: 1 }) },
      },
      planets: indexById([{ id: planetId, x: 0, y: 0 }]),
      fleets: indexById([{ id: enemyFleetId, playerId: enemyPlayerId, strength: 5, originPlanetId: planetId }]),
    })

    // Act
    const result = resolveTurn(gameId, turnState, TestRuleset, createSeededRng())

    // Assert
    expect(result).toStrictEqual<typeof result>(
      Result.Success({
        resolvedActions: [
          {
            submittedAction,
            actionOutcomes: [
              EffectOutcome.Resolved({ result: `Player "${playerId}" spent 2 INFLUENCE` }),
              EffectOutcome.Resolved({ result: `Player "${playerId}" spent 1 METAL` }),
              EffectOutcome.Resolved({
                result: `Player "${playerId}" built Fleet "302894c5-2d2e-5801-a07a-23803eb73160" with strength 10 on Planet "${planetId}"`,
              }),
            ],
          },
        ],
        players: indexById([{ id: playerId, resources: createResourcesStub() }]),
        planets: indexById([{ id: planetId, x: 0, y: 0 }]),
        fleets: indexById([
          { id: enemyFleetId, playerId: enemyPlayerId, strength: 5, originPlanetId: planetId },
          {
            id: branded<FleetId>("302894c5-2d2e-5801-a07a-23803eb73160"),
            playerId,
            strength: 10,
            originPlanetId: planetId,
          },
        ]),
        winnerPlayerId: undefined,
      }),
    )
  })
})
