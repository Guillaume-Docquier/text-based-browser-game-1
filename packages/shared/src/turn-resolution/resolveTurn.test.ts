import { type RngState, Assert, indexBy, branded, Result } from "@guillaume-docquier/tools-ts"
import { NonNegativeNumberSchema, PositiveNumberSchema, typedParse } from "@guillaume-docquier/tools-ts/schemas"
import { v4 } from "uuid"
import { describe, expect, it } from "vitest"
import { type PlayerId, PlayerIdSchema } from "#shared/domain/players/PlayerId.ts"
import { createResourcesStub } from "#shared/domain/resources/Resources.stub.ts"
import { ResourceType } from "#shared/domain/resources/ResourceType.ts"
import type { ActionDefinitionId } from "#shared/domain/ruleset/action-definitions/ActionDefinitionId.ts"
import type { InputTag } from "#shared/domain/ruleset/action-definitions/InputTag.ts"
import { PositiveIntegerSchema } from "#shared/domain/ruleset/action-definitions/PositiveInteger.ts"
import { createSubmittedActionStub } from "#shared/domain/turns/actions/Action.stub.ts"
import { EffectOutcome } from "#shared/domain/turns/actions/EffectOutcome.ts"
import { createFleetStub } from "#shared/domain/world/fleets/Fleet.stub.ts"
import { FleetSchema } from "#shared/domain/world/fleets/Fleet.ts"
import type { FleetId } from "#shared/domain/world/fleets/FleetId.ts"
import { FleetNameSchema } from "#shared/domain/world/fleets/FleetName.ts"
import { createPlanetStub } from "#shared/domain/world/planets/Planet.stub.ts"
import type { PlanetId } from "#shared/domain/world/planets/PlanetId.ts"
import { PlanetNameSchema } from "#shared/domain/world/planets/PlanetName.ts"
import { createSeededRng } from "#shared/testing/createSeededRng.ts"
import { FleetActionSelectionParity } from "#shared/testing/FleetActionSelectionParity.ts"
import { AttackMoveTest } from "#shared/testing/test-ruleset/action-definitions/attack-move.ts"
import { BuildFleetStandard } from "#shared/testing/test-ruleset/action-definitions/build-fleet.ts"
import { GainInfluence } from "#shared/testing/test-ruleset/action-definitions/gain-influence.ts"
import { MoveFleetImproved, MoveFleetStandard } from "#shared/testing/test-ruleset/action-definitions/move-fleet.ts"
import { WinTheGame } from "#shared/testing/test-ruleset/action-definitions/win-the-game.ts"
import { TestRuleset } from "#shared/testing/test-ruleset/TestRuleset.ts"
import { resolveTurn } from "#shared/turn-resolution/resolveTurn.ts"
import { ResolveTurnError } from "#shared/turn-resolution/ResolveTurnError.ts"
import { createTurnStateStub } from "#shared/turn-resolution/TurnState.stub.ts"

describe("resolveTurn", () => {
  const playerId = typedParse(PlayerIdSchema, "00000000-0000-4000-8000-000000000001")

  it("should reject unsafe loaded Fleet combat state before cost mutation or RNG use", () => {
    const defenderPlayerId = typedParse(PlayerIdSchema, "00000000-0000-4000-8000-000000000002")
    const secondDefenderPlayerId = typedParse(PlayerIdSchema, "00000000-0000-4000-8000-000000000003")
    const origin = createPlanetStub({ id: "unsafe-combat-origin", ownerPlayerId: playerId, x: 0, y: 0 })
    const target = createPlanetStub({ id: "unsafe-combat-target", ownerPlayerId: defenderPlayerId, x: 1, y: 0 })
    const createState = (defenders: Array<ReturnType<typeof createFleetStub>>): ReturnType<typeof createTurnStateStub> => {
      const attacker = createFleetStub({
        id: "unsafe-combat-attacker",
        ownerPlayerId: playerId,
        originPlanetId: origin.id,
        strength: 30,
      })
      const submission = createSubmittedActionStub({
        id: AttackMoveTest.id + "_1",
        playerId,
        actionDefinitionId: AttackMoveTest.id,
        selectedTargets: { fleet: attacker.id, planet: target.id },
        selectedInputs: { strength: 30 },
      })
      return createTurnStateStub({
        submittedActions: [submission],
        players: indexBy(
          "id",
          [playerId, defenderPlayerId, secondDefenderPlayerId].map((id) => ({
            id,
            resources: createResourcesStub({
              [ResourceType.INFLUENCE]: 10,
              [ResourceType.FUEL]: 10,
            }),
          })),
        ),
        planets: indexBy("id", [origin, target]),
        fleets: indexBy("id", [attacker, ...defenders]),
      })
    }

    const createOverflowStateSetupPhase1Result = createOverflowStateSetup({ defenderPlayerId, target, createState, secondDefenderPlayerId })
    const { overflowState, overflowStateBefore, overflowRng, overflowRngBefore } = createOverflowStateSetupPhase1Result

    expect(resolveTurn(overflowState, TestRuleset, overflowRng)).toStrictEqual(
      Result.Failure(
        ResolveTurnError.InvalidTurnState({
          error:
            'Enemy Strength at Planet "unsafe-combat-target" exceeds the safe integer range for Assaults by Player "00000000-0000-4000-8000-000000000001"',
        }),
      ),
    )
    expect(overflowState).toStrictEqual(overflowStateBefore)
    expect(overflowRng.getState()).toStrictEqual(overflowRngBefore)
  })

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

  it("should resolve the independent mixed-definition Fleet allocation parity vector", () => {
    // Arrange
    const origin = createPlanetStub({
      id: "parity-origin",
      ownerPlayerId: playerId,
      x: FleetActionSelectionParity.origin.x,
      y: FleetActionSelectionParity.origin.y,
    })
    const destination = createPlanetStub({
      id: "parity-destination",
      ownerPlayerId: null,
      x: FleetActionSelectionParity.destination.x,
      y: FleetActionSelectionParity.destination.y,
    })
    const sourceFleet = createFleetStub({
      id: "parity-source-fleet",
      ownerPlayerId: playerId,
      originPlanetId: origin.id,
      strength: FleetActionSelectionParity.sourceStrength,
    })
    const standardSubmission = createSubmittedActionStub({
      id: "MOVE_FLEET_STANDARD_1",
      playerId,
      actionDefinitionId: MoveFleetStandard.id,
      selectedTargets: { fleet: sourceFleet.id, planet: destination.id },
      selectedInputs: { strength: FleetActionSelectionParity.standardStrength },
    })
    const improvedSubmission = createSubmittedActionStub({
      id: "MOVE_FLEET_IMPROVED_1",
      playerId,
      actionDefinitionId: MoveFleetImproved.id,
      selectedTargets: { fleet: sourceFleet.id, planet: destination.id },
      selectedInputs: { strength: FleetActionSelectionParity.improvedStrength },
    })
    const turnState = createTurnStateStub({
      submittedActions: [standardSubmission, improvedSubmission],
      players: indexBy("id", [
        {
          id: playerId,
          resources: createResourcesStub({
            [ResourceType.INFLUENCE]: FleetActionSelectionParity.totalResources.INFLUENCE,
            [ResourceType.FUEL]: FleetActionSelectionParity.totalResources.FUEL,
          }),
        },
      ]),
      planets: indexBy("id", [origin, destination]),
      fleets: indexBy("id", [sourceFleet]),
    })

    // Act
    const result = resolveTurn(turnState, TestRuleset, createSeededRng())
    Assert.isSuccess(result)
    const resolved = result.value

    // Assert
    expect(
      resolved.resolvedActions.map(({ submittedAction }) => submittedAction.selectedInputs[branded<InputTag>("strength")]),
    ).toStrictEqual([FleetActionSelectionParity.standardStrength, FleetActionSelectionParity.improvedStrength])
    expect(resolved.players[playerId]?.resources[ResourceType.INFLUENCE]).toBe(0)
    expect(resolved.players[playerId]?.resources[ResourceType.FUEL]).toBe(0)
    expect(Object.values(resolved.fleets).reduce((total, fleet) => total + fleet.strength, 0)).toBe(
      FleetActionSelectionParity.sourceStrength,
    )
  })

  it("should reject an incomplete parity draft through the public resolution entry point", () => {
    // Arrange
    const origin = createPlanetStub({
      id: "parity-partial-origin",
      ownerPlayerId: playerId,
      x: FleetActionSelectionParity.origin.x,
      y: FleetActionSelectionParity.origin.y,
    })
    const sourceFleet = createFleetStub({
      id: "parity-partial-fleet",
      ownerPlayerId: playerId,
      originPlanetId: origin.id,
      strength: FleetActionSelectionParity.sourceStrength,
    })
    const partialSubmission = createSubmittedActionStub({
      id: "MOVE_FLEET_STANDARD_1",
      playerId,
      actionDefinitionId: MoveFleetStandard.id,
      selectedTargets: { fleet: sourceFleet.id },
      selectedInputs: { strength: FleetActionSelectionParity.standardStrength },
    })
    const turnState = createTurnStateStub({
      submittedActions: [partialSubmission],
      players: indexBy("id", [
        {
          id: playerId,
          resources: createResourcesStub({
            [ResourceType.INFLUENCE]: 6,
            [ResourceType.FUEL]: 4,
          }),
        },
      ]),
      planets: indexBy("id", [origin]),
      fleets: indexBy("id", [sourceFleet]),
    })
    const originalTurnState = structuredClone(turnState)

    // Act
    const result = resolveTurn(turnState, TestRuleset, createSeededRng())

    // Assert
    expect(result).toStrictEqual(
      Result.Failure(
        ResolveTurnError.InvalidSubmissions({
          issues: [
            {
              issue: 'Choose a value for the "planet" target',
              submittedActionId: "MOVE_FLEET_STANDARD_1",
              actionDefinitionId: MoveFleetStandard.id,
              actionDefinitionName: "Move Fleet",
            },
          ],
        }),
      ),
    )
    expect(turnState).toStrictEqual(originalTurnState)
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
        resolvedContinuations: [],
        removedFleetIds: [],
        planetOwnershipChanges: [],
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
        resolvedContinuations: [],
        removedFleetIds: [],
        planetOwnershipChanges: [],
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
        resolvedContinuations: [],
        removedFleetIds: [],
        planetOwnershipChanges: [],
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
      fleets: indexBy("id", [
        createFleetStub({ id: fleetId, ownerPlayerId: playerId, name: fleetName, strength: 5, originPlanetId: planetId }),
      ]),
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
        createFleetStub({
          id: enemyFleetId,
          ownerPlayerId: enemyPlayerId,
          name: enemyFleetName,
          strength: 5,
          originPlanetId: planetId,
        }),
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

  it("should reject partial journey data before resolving any turn effects", () => {
    // Arrange
    const origin = createPlanetStub({ id: branded<PlanetId>("origin-planet"), ownerPlayerId: playerId })
    const destination = createPlanetStub({ id: branded<PlanetId>("destination-planet"), x: 4 })
    const fleetId = branded<FleetId>("journey-fleet")
    const movementSubmission = createSubmittedActionStub({
      id: `${MoveFleetStandard.id}_1`,
      playerId,
      actionDefinitionId: MoveFleetStandard.id,
      selectedTargets: { fleet: fleetId, planet: destination.id },
      selectedInputs: { strength: 10 },
    })
    const validJourney = createFleetStub({
      id: fleetId,
      ownerPlayerId: playerId,
      originPlanetId: origin.id,
      strength: 10,
      destinationPlanetId: destination.id,
      distanceToEnd: typedParse(NonNegativeNumberSchema, 4),
      movement: {
        speed: typedParse(PositiveNumberSchema, 1),
        departureTurn: typedParse(PositiveIntegerSchema, 1),
        submission: movementSubmission,
        pendingArrivalEffects: [],
      },
    })
    const partialJourney = { ...validJourney, movement: undefined }
    const turnState = createTurnStateStub({
      players: indexBy("id", [{ id: playerId, resources: createResourcesStub() }]),
      planets: indexBy("id", [origin, destination]),
      fleets: indexBy("id", [partialJourney]),
    })
    const stateBeforeResolution = structuredClone(turnState)

    // Act
    const result = resolveTurn(turnState, TestRuleset, createSeededRng())

    // Assert
    expect(result).toStrictEqual(
      Result.Failure(
        ResolveTurnError.InvalidSubmissions({
          issues: [
            {
              issue: 'Fleet "journey-fleet" has incomplete in-progress movement data',
              submittedActionId: "__VALIDATION_1_00000000-0000-4000-8000-000000000001",
              actionDefinitionId: branded<ActionDefinitionId>("__UNASSOCIATED_VALIDATION__"),
              actionDefinitionName: undefined,
            },
          ],
        }),
      ),
    )
    expect(turnState).toStrictEqual(stateBeforeResolution)
  })

  it("should reject a partial journey when its owner and the turn have no known player", () => {
    // Arrange
    const missingPlayerId = typedParse(PlayerIdSchema, "00000000-0000-4000-8000-000000000099")
    const origin = createPlanetStub({ id: branded<PlanetId>("origin-planet"), ownerPlayerId: missingPlayerId })
    const destination = createPlanetStub({ id: branded<PlanetId>("destination-planet"), x: 5 })
    const malformedFleet = {
      ...createFleetStub({
        id: branded<FleetId>("malformed-journey-fleet"),
        ownerPlayerId: missingPlayerId,
        originPlanetId: origin.id,
        strength: 10,
      }),
      destinationPlanetId: destination.id,
      distanceToEnd: typedParse(NonNegativeNumberSchema, 5),
    }
    const turnState = createTurnStateStub({
      turn: 2,
      players: {},
      submittedActions: [],
      planets: indexBy("id", [origin, destination]),
      fleets: indexBy("id", [malformedFleet]),
    })
    const stateBeforeResolution = structuredClone(turnState)

    // Act
    const result = resolveTurn(turnState, TestRuleset, createSeededRng())

    // Assert
    expect(result).toStrictEqual(
      Result.Failure(
        ResolveTurnError.InvalidSubmissions({
          issues: [
            {
              issue: 'Fleet "malformed-journey-fleet" has incomplete in-progress movement data',
              submittedActionId: `__VALIDATION_2_${missingPlayerId}`,
              actionDefinitionId: branded<ActionDefinitionId>("__UNASSOCIATED_VALIDATION__"),
              actionDefinitionName: undefined,
            },
          ],
        }),
      ),
    )
    expect(turnState).toStrictEqual(stateBeforeResolution)
  })

  it("should reject duplicate journey occupancy before resolving turn effects", () => {
    // Arrange
    const origin = createPlanetStub({ id: branded<PlanetId>("origin-planet"), ownerPlayerId: playerId })
    const destination = createPlanetStub({ id: branded<PlanetId>("destination-planet"), x: 4 })
    const firstFleetId = branded<FleetId>("first-journey-fleet")
    const secondFleetId = branded<FleetId>("second-journey-fleet")
    const movementSubmission = createSubmittedActionStub({
      id: `${MoveFleetStandard.id}_1`,
      playerId,
      actionDefinitionId: MoveFleetStandard.id,
      selectedTargets: { fleet: firstFleetId, planet: destination.id },
      selectedInputs: { strength: 10 },
    })
    const createJourney = (id: FleetId): ReturnType<typeof createFleetStub> =>
      createFleetStub({
        id,
        ownerPlayerId: playerId,
        originPlanetId: origin.id,
        strength: 10,
        destinationPlanetId: destination.id,
        distanceToEnd: typedParse(NonNegativeNumberSchema, 4),
        movement: {
          speed: typedParse(PositiveNumberSchema, 1),
          departureTurn: typedParse(PositiveIntegerSchema, 1),
          submission: movementSubmission,
          pendingArrivalEffects: [],
        },
      })
    const turnState = createTurnStateStub({
      players: indexBy("id", [{ id: playerId, resources: createResourcesStub() }]),
      planets: indexBy("id", [origin, destination]),
      fleets: indexBy("id", [createJourney(firstFleetId), createJourney(secondFleetId)]),
    })
    const stateBeforeResolution = structuredClone(turnState)

    // Act
    const result = resolveTurn(turnState, TestRuleset, createSeededRng())

    // Assert
    expect(result).toStrictEqual(
      Result.Failure(
        ResolveTurnError.InvalidSubmissions({
          issues: [
            {
              issue: `More than one in-transit Fleet occupies Action instance "${MoveFleetStandard.id}_1"`,
              submittedActionId: `${MoveFleetStandard.id}_1`,
              actionDefinitionId: MoveFleetStandard.id,
              actionDefinitionName: MoveFleetStandard.name,
            },
          ],
        }),
      ),
    )
    expect(turnState).toStrictEqual(stateBeforeResolution)
  })
})

function createOverflowStateSetup({
  defenderPlayerId,
  target,
  createState,
  secondDefenderPlayerId,
}: CreateOverflowStateSetupInput): CreateOverflowStateSetupResult {
  const fractionalDefender = createFleetStub({
    id: "unsafe-combat-fractional-defender",
    ownerPlayerId: defenderPlayerId,
    originPlanetId: target.id,
    strength: 2,
  })
  Object.assign(fractionalDefender, { strength: 1.5 })
  expect(FleetSchema.safeParse(fractionalDefender).success).toBe(false)
  const fractionalState = createState([fractionalDefender])
  const fractionalStateBefore = structuredClone(fractionalState)
  const fractionalRng = createSeededRng(1234)
  const fractionalRngBefore = fractionalRng.getState()

  expect(resolveTurn(fractionalState, TestRuleset, fractionalRng)).toStrictEqual(
    Result.Failure(ResolveTurnError.InvalidTurnState({ error: 'Fleet "unsafe-combat-fractional-defender" has an unsafe Strength value' })),
  )
  expect(fractionalState).toStrictEqual(fractionalStateBefore)
  expect(fractionalRng.getState()).toStrictEqual(fractionalRngBefore)

  const maximumDefender = createFleetStub({
    id: "safe-maximum-defender",
    ownerPlayerId: defenderPlayerId,
    originPlanetId: target.id,
    strength: Number.MAX_SAFE_INTEGER,
  })
  expect(FleetSchema.safeParse(maximumDefender).success).toBe(true)
  const safeBoundaryState = createState([maximumDefender])
  const safeBoundary = resolveTurn(safeBoundaryState, TestRuleset, createSeededRng(1234))
  Assert.isSuccess(safeBoundary)
  expect(safeBoundary.value.fleets[maximumDefender.id]?.strength).toBe(Number.MAX_SAFE_INTEGER - 30)

  const overflowMaximumDefender = createFleetStub({
    id: "overflow-maximum-defender",
    ownerPlayerId: defenderPlayerId,
    originPlanetId: target.id,
    strength: Number.MAX_SAFE_INTEGER,
  })
  const overflowOtherDefender = createFleetStub({
    id: "overflow-other-defender",
    ownerPlayerId: secondDefenderPlayerId,
    originPlanetId: target.id,
    strength: 1,
  })
  expect(FleetSchema.safeParse(overflowMaximumDefender).success).toBe(true)
  expect(FleetSchema.safeParse(overflowOtherDefender).success).toBe(true)
  const overflowState = createState([overflowMaximumDefender, overflowOtherDefender])
  const overflowStateBefore = structuredClone(overflowState)
  const overflowRng = createSeededRng(1234)
  const overflowRngBefore = overflowRng.getState()
  return { overflowState, overflowStateBefore, overflowRng, overflowRngBefore }
}

type CreateOverflowStateSetupInput = {
  defenderPlayerId: PlayerId
  target: ReturnType<typeof createPlanetStub>
  createState: (defenders: Array<ReturnType<typeof createFleetStub>>) => ReturnType<typeof createTurnStateStub>
  secondDefenderPlayerId: PlayerId
}

type CreateOverflowStateSetupResult = {
  overflowState: ReturnType<typeof createTurnStateStub>
  overflowStateBefore: ReturnType<typeof createTurnStateStub>
  overflowRng: ReturnType<typeof createSeededRng>
  overflowRngBefore: RngState<unknown>
}
