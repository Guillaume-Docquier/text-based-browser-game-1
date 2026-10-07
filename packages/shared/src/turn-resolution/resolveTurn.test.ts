import { indexBy, branded, Result } from "@guillaume-docquier/tools-ts"
import { typedParse } from "@guillaume-docquier/tools-ts/schemas"
import { v4 } from "uuid"
import { describe, expect, it } from "vitest"
import { PlayerIdSchema } from "#shared/domain/players/PlayerId.ts"
import { createResourcesStub } from "#shared/domain/resources/Resources.stub.ts"
import { ResourceType } from "#shared/domain/resources/ResourceType.ts"
import { createSubmittedActionStub } from "#shared/domain/turns/actions/Action.stub.ts"
import { EffectOutcome } from "#shared/domain/turns/actions/EffectOutcome.ts"
import type { FleetId } from "#shared/domain/world/fleets/FleetId.ts"
import { FleetNameSchema } from "#shared/domain/world/fleets/FleetName.ts"
import type { PlanetId } from "#shared/domain/world/planets/PlanetId.ts"
import { PlanetNameSchema } from "#shared/domain/world/planets/PlanetName.ts"
import { createSeededRng } from "#shared/testing/createSeededRng.ts"
import { BuildFleetStandard } from "#shared/testing/test-ruleset/action-definitions/build-fleet.ts"
import { GainInfluence } from "#shared/testing/test-ruleset/action-definitions/gain-influence.ts"
import { WinTheGame } from "#shared/testing/test-ruleset/action-definitions/win-the-game.ts"
import { TestRuleset } from "#shared/testing/test-ruleset/TestRuleset.ts"
import { resolveTurn } from "#shared/turn-resolution/resolveTurn.ts"
import { ResolveTurnError } from "#shared/turn-resolution/ResolveTurnError.ts"
import { createTurnStateStub } from "#shared/turn-resolution/TurnState.stub.ts"

describe("resolveTurn", () => {
  const playerId = typedParse(PlayerIdSchema, "00000000-0000-4000-8000-000000000001")

  it("should not resolve the turn when the player cannot afford an Action", () => {
    // Arrange
    const submittedAction = createSubmittedActionStub({ actionDefinitionId: WinTheGame.id, playerId })
    const turnState = createTurnStateStub({
      submittedActions: [submittedAction],
      players: indexBy("id", [
        {
          id: playerId,
          resources: createResourcesStub({
            [ResourceType.INFLUENCE]: 3,
            [ResourceType.METAL]: 2,
            [ResourceType.FUEL]: 1,
          }),
        },
      ]),
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
    const submittedAction = createSubmittedActionStub({ actionDefinitionId: GainInfluence.id, playerId })
    const turnState = createTurnStateStub({
      submittedActions: [submittedAction],
      players: indexBy("id", [
        {
          id: playerId,
          resources: createResourcesStub({
            [ResourceType.INFLUENCE]: 3,
            [ResourceType.METAL]: 2,
            [ResourceType.FUEL]: 1,
          }),
        },
      ]),
    })

    // Act
    const result = resolveTurn(turnState, TestRuleset, createSeededRng())

    // Assert
    expect(result).toStrictEqual<typeof result>(
      Result.Success({
        gameId: turnState.gameId,
        turn: turnState.turn,
        resolvedActions: [
          {
            submittedAction,
            actionOutcomes: [EffectOutcome.Resolved({ result: `Player "${playerId}" gained 5 INFLUENCE` })],
          },
        ],
        players: indexBy("id", [
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
    const firstPlayerId = typedParse(PlayerIdSchema, "00000000-0000-4000-8000-000000000002")
    const secondPlayerId = typedParse(PlayerIdSchema, "00000000-0000-4000-8000-000000000003")
    const firstPlayerSubmittedAction = createSubmittedActionStub({ actionDefinitionId: GainInfluence.id, playerId: firstPlayerId })
    const secondPlayerSubmittedAction = createSubmittedActionStub({ actionDefinitionId: WinTheGame.id, playerId: secondPlayerId })
    const turnState = createTurnStateStub({
      submittedActions: [firstPlayerSubmittedAction, secondPlayerSubmittedAction],
      players: indexBy("id", [
        {
          id: firstPlayerId,
          resources: createResourcesStub({
            [ResourceType.INFLUENCE]: 3,
            [ResourceType.METAL]: 2,
            [ResourceType.FUEL]: 1,
          }),
        },
        {
          id: secondPlayerId,
          resources: createResourcesStub({
            [ResourceType.INFLUENCE]: 10,
            [ResourceType.METAL]: 5,
            [ResourceType.FUEL]: 5,
            [ResourceType.ENERGY]: 5,
          }),
        },
      ]),
    })

    // Act
    const result = resolveTurn(turnState, TestRuleset, createSeededRng())

    // Assert
    expect(result).toStrictEqual<typeof result>(
      Result.Success({
        gameId: turnState.gameId,
        turn: turnState.turn,
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
        players: indexBy("id", [
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
      players: indexBy("id", [
        {
          id: playerId,
          resources: createResourcesStub({
            [ResourceType.INFLUENCE]: 10,
            [ResourceType.METAL]: 5,
            [ResourceType.FUEL]: 5,
            [ResourceType.ENERGY]: 5,
          }),
        },
      ]),
    })

    // Act
    const result = resolveTurn(turnState, TestRuleset, createSeededRng())

    // Assert
    expect(result).toStrictEqual<typeof result>(
      Result.Success({
        gameId: turnState.gameId,
        turn: turnState.turn,
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
        players: indexBy("id", [{ id: playerId, resources: createResourcesStub() }]),
        planets: {},
        fleets: {},
        winnerPlayerId: playerId,
      }),
    )
  })

  it("should create a fleet with a unique and deterministic id", () => {
    // Arrange
    const planetId = branded<PlanetId>("planet-id")
    const submittedAction = createSubmittedActionStub({
      actionDefinitionId: BuildFleetStandard.id,
      playerId,
      selectedTargets: { planet: String(planetId) },
    })
    const turnState = createTurnStateStub({
      turn: 1,
      submittedActions: [submittedAction],
      players: indexBy("id", [
        {
          id: playerId,
          resources: createResourcesStub({
            [ResourceType.INFLUENCE]: 2,
            [ResourceType.METAL]: 1,
          }),
        },
      ]),
      planets: indexBy("id", [{ id: planetId, name: typedParse(PlanetNameSchema, "planet-1"), ownerPlayerId: playerId, x: 0, y: 0 }]),
    })

    // Act
    const result = resolveTurn(turnState, TestRuleset, createSeededRng())

    // Assert
    const expectedFleetId = branded<FleetId>("6647af23-a98d-5258-a3c3-b95dac3ead9e")
    expect(result).toStrictEqual<typeof result>(
      Result.Success(
        expect.objectContaining({
          resolvedActions: [
            {
              submittedAction,
              actionOutcomes: expect.arrayContaining([
                EffectOutcome.Resolved({
                  result: `Player "${playerId}" built Fleet "${expectedFleetId}" with strength 10 on Planet "${planetId}"`,
                }),
              ]),
            },
          ],
          fleets: indexBy("id", [
            {
              id: expectedFleetId,
              ownerPlayerId: playerId,
              name: "fleet 74220",
              strength: 10,
              originPlanetId: planetId,
            },
          ]),
        }),
      ),
    )
  })

  it("should reinforce a friendly fleet without changing its id", () => {
    // Arrange
    const planetId = branded<PlanetId>("planet-id")
    const fleetId = branded<FleetId>(v4())
    const fleetName = typedParse(FleetNameSchema, "Existing Fleet")
    const submittedAction = createSubmittedActionStub({
      actionDefinitionId: BuildFleetStandard.id,
      playerId,
      selectedTargets: { planet: String(planetId) },
    })
    const turnState = createTurnStateStub({
      submittedActions: [submittedAction],
      players: indexBy("id", [
        {
          id: playerId,
          resources: createResourcesStub({
            [ResourceType.INFLUENCE]: 2,
            [ResourceType.METAL]: 1,
          }),
        },
      ]),
      planets: indexBy("id", [{ id: planetId, name: typedParse(PlanetNameSchema, "planet-1"), ownerPlayerId: playerId, x: 0, y: 0 }]),
      fleets: indexBy("id", [{ id: fleetId, ownerPlayerId: playerId, name: fleetName, strength: 5, originPlanetId: planetId }]),
    })

    // Act
    const result = resolveTurn(turnState, TestRuleset, createSeededRng())

    // Assert
    expect(result).toStrictEqual<typeof result>(
      Result.Success(
        expect.objectContaining({
          resolvedActions: [
            {
              submittedAction,
              actionOutcomes: expect.arrayContaining([
                EffectOutcome.Resolved({
                  result: `Player "${playerId}" reinforced Fleet "${fleetId}" by 10 on Planet "${planetId}"`,
                }),
              ]),
            },
          ],
          fleets: indexBy("id", [
            {
              id: fleetId,
              ownerPlayerId: playerId,
              name: fleetName,
              strength: 15,
              originPlanetId: planetId,
            },
          ]),
        }),
      ),
    )
  })

  it("should keep an enemy fleet separate when building on the same planet", () => {
    // Arrange
    const planetId = branded<PlanetId>("planet-id")
    const enemyPlayerId = typedParse(PlayerIdSchema, v4())
    const enemyFleetId = branded<FleetId>(v4())
    const enemyFleetName = typedParse(FleetNameSchema, "Enemy Fleet")
    const submittedAction = createSubmittedActionStub({
      actionDefinitionId: BuildFleetStandard.id,
      playerId,
      selectedTargets: { planet: String(planetId) },
    })
    const turnState = createTurnStateStub({
      submittedActions: [submittedAction],
      players: indexBy("id", [
        { id: playerId, resources: createResourcesStub({ [ResourceType.INFLUENCE]: 2, [ResourceType.METAL]: 1 }) },
        { id: enemyPlayerId, resources: createResourcesStub({ [ResourceType.INFLUENCE]: 2, [ResourceType.METAL]: 1 }) },
      ]),
      planets: indexBy("id", [{ id: planetId, name: typedParse(PlanetNameSchema, "planet-1"), ownerPlayerId: playerId, x: 0, y: 0 }]),
      fleets: indexBy("id", [
        { id: enemyFleetId, ownerPlayerId: enemyPlayerId, name: enemyFleetName, strength: 5, originPlanetId: planetId },
      ]),
    })

    // Act
    const result = resolveTurn(turnState, TestRuleset, createSeededRng())

    // Assert
    const expectedFleetId = branded<FleetId>("6647af23-a98d-5258-a3c3-b95dac3ead9e")
    expect(result).toStrictEqual<typeof result>(
      Result.Success(
        expect.objectContaining({
          resolvedActions: [
            {
              submittedAction,
              actionOutcomes: expect.arrayContaining([
                EffectOutcome.Resolved({
                  result: `Player "${playerId}" built Fleet "${expectedFleetId}" with strength 10 on Planet "${planetId}"`,
                }),
              ]),
            },
          ],
          fleets: indexBy("id", [
            { id: enemyFleetId, ownerPlayerId: enemyPlayerId, name: enemyFleetName, strength: 5, originPlanetId: planetId },
            { id: expectedFleetId, ownerPlayerId: playerId, name: "fleet 74220", strength: 10, originPlanetId: planetId },
          ]),
        }),
      ),
    )
  })
})
