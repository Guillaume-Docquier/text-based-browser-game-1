import { indexBy, Result } from "@guillaume-docquier/tools-ts"
import { typedParse } from "@guillaume-docquier/tools-ts/schemas"
import { describe, expect, it } from "vitest"
import { validateSubmittedActions } from "#shared/action-submission/validation/validateSubmittedActions.ts"
import { PlayerIdSchema } from "#shared/domain/players/PlayerId.ts"
import { createResourcesStub } from "#shared/domain/resources/Resources.stub.ts"
import { ResourceType } from "#shared/domain/resources/ResourceType.ts"
import { createRulesetStub } from "#shared/domain/ruleset/Ruleset.stub.ts"
import { createSubmittedActionStub } from "#shared/domain/turns/actions/Action.stub.ts"
import { createFleetStub } from "#shared/domain/world/fleets/Fleet.stub.ts"
import { FleetMovementSchema } from "#shared/domain/world/fleets/Fleet.ts"
import { createPlanetStub } from "#shared/domain/world/planets/Planet.stub.ts"
import { PlanetIdSchema } from "#shared/domain/world/planets/PlanetId.ts"
import { createSeededRng } from "#shared/testing/createSeededRng.ts"
import { BuildFleetStandard } from "#shared/testing/test-ruleset/action-definitions/build-fleet.ts"
import { GainInfluence } from "#shared/testing/test-ruleset/action-definitions/gain-influence.ts"
import { MoveFleetStandard } from "#shared/testing/test-ruleset/action-definitions/move-fleet.ts"
import { TestRuleset } from "#shared/testing/test-ruleset/TestRuleset.ts"
import { resolveTurn } from "#shared/turn-resolution/resolveTurn.ts"
import { ResolveTurnError } from "#shared/turn-resolution/ResolveTurnError.ts"
import { createTurnStateStub } from "#shared/turn-resolution/TurnState.stub.ts"

describe("validateSubmittedActions", () => {
  it("should discard validator failures", () => {
    // Arrange
    const submittedAction = createSubmittedActionStub({ actionDefinitionId: "UNKNOWN_ACTION" })
    const ruleset = createRulesetStub({ actionDefinitions: {} })
    const turnState = createTurnStateStub()

    // Act
    const issues = validateSubmittedActions([submittedAction], ruleset, turnState)

    // Assert
    expect(issues).toStrictEqual<typeof issues>([
      {
        issue: "Action definition does not exist in the Ruleset",
        submittedActionId: submittedAction.id,
        actionDefinitionId: submittedAction.actionDefinitionId,
        actionDefinitionName: undefined,
      },
    ])
  })

  it("should preserve the pooled definition when checking a submitted selection", () => {
    // Arrange
    const playerId = typedParse(PlayerIdSchema, "00000000-0000-4000-8000-000000000001")
    const planet = createPlanetStub({
      id: typedParse(PlanetIdSchema, "00000000-0000-4000-8000-000000000002"),
      ownerPlayerId: playerId,
    })
    const submittedAction = createSubmittedActionStub({
      id: `${GainInfluence.id}_1`,
      playerId,
      actionDefinitionId: BuildFleetStandard.id,
      selectedTargets: { planet: planet.id },
      selectedInputs: {},
    })
    const turnState = createTurnStateStub({
      submittedActions: [submittedAction],
      players: indexBy("id", [
        {
          id: playerId,
          resources: createResourcesStub({
            [ResourceType.INFLUENCE]: 20,
            [ResourceType.METAL]: 20,
          }),
        },
      ]),
      planets: indexBy("id", [planet]),
    })

    // Act
    const issues = validateSubmittedActions([submittedAction], TestRuleset, turnState)
    const result = resolveTurn(turnState, TestRuleset, createSeededRng())

    // Assert
    const expectedIssues = [
      {
        issue: `Action instance "${submittedAction.id}" is bound to "${GainInfluence.id}", not "${BuildFleetStandard.id}"`,
        submittedActionId: submittedAction.id,
        actionDefinitionId: BuildFleetStandard.id,
        actionDefinitionName: BuildFleetStandard.name,
      },
      {
        issue: 'Target tag "planet" is not defined by this Action',
        submittedActionId: submittedAction.id,
        actionDefinitionId: BuildFleetStandard.id,
        actionDefinitionName: BuildFleetStandard.name,
      },
    ]
    expect(issues).toStrictEqual(expectedIssues)
    expect(result).toStrictEqual(Result.Failure(ResolveTurnError.InvalidSubmissions({ issues: expectedIssues })))
  })

  it.each(["constructor", "toString"])("should reject inherited input name %s", (inputTag) => {
    // Arrange
    const playerId = typedParse(PlayerIdSchema, "00000000-0000-4000-8000-000000000011")
    const submittedAction = createSubmittedActionStub({
      id: "GAIN_INFLUENCE_1",
      playerId,
      actionDefinitionId: GainInfluence.id,
      selectedTargets: {},
      selectedInputs: Object.fromEntries([[inputTag, 1]]),
    })
    const turnState = createTurnStateStub({
      submittedActions: [submittedAction],
      players: indexBy("id", [{ id: playerId, resources: createResourcesStub({ [ResourceType.INFLUENCE]: 5 }) }]),
    })

    // Act
    const issues = validateSubmittedActions([submittedAction], TestRuleset, turnState)

    // Assert
    expect(issues).toContainEqual(
      expect.objectContaining({
        submittedActionId: submittedAction.id,
        issue: 'Input tag "' + inputTag + '" is not defined by this Action',
      }),
    )
  })

  it("should report a known action submitted by a player absent from the turn", () => {
    // Arrange
    const submittedAction = createSubmittedActionStub({
      id: `${GainInfluence.id}_1`,
      actionDefinitionId: GainInfluence.id,
      playerId: "00000000-0000-4000-8000-000000000099",
    })
    const turnState = createTurnStateStub({ submittedActions: [submittedAction] })

    // Act
    const issues = validateSubmittedActions([submittedAction], TestRuleset, turnState)

    // Assert
    expect(issues).toContainEqual(
      expect.objectContaining({
        submittedActionId: submittedAction.id,
        issue: expect.stringContaining("does not exist in this turn"),
      }),
    )
  })

  it("should reject a continuation whose owner is absent from the turn before mutating the fleet", () => {
    // Arrange
    const missingPlayerId = typedParse(PlayerIdSchema, "00000000-0000-4000-8000-000000000099")
    const origin = createPlanetStub({
      id: typedParse(PlanetIdSchema, "00000000-0000-4000-8000-000000000010"),
      x: 0,
      y: 0,
    })
    const destination = createPlanetStub({
      id: typedParse(PlanetIdSchema, "00000000-0000-4000-8000-000000000011"),
      x: 3,
      y: 4,
    })
    const movementSubmission = createSubmittedActionStub({
      id: `${MoveFleetStandard.id}_1`,
      playerId: missingPlayerId,
      actionDefinitionId: MoveFleetStandard.id,
      selectedTargets: { fleet: "fleet-missing-owner", planet: destination.id },
      selectedInputs: { strength: 5 },
    })
    const fleet = createFleetStub({
      id: "fleet-missing-owner",
      ownerPlayerId: missingPlayerId,
      originPlanetId: origin.id,
      destinationPlanetId: destination.id,
      distanceToEnd: 5,
      movement: typedParse(FleetMovementSchema, { speed: 0.1, departureTurn: 2, submission: movementSubmission }),
      strength: 5,
    })
    const turnState = createTurnStateStub({
      turn: 2,
      submittedActions: [],
      players: {},
      planets: indexBy("id", [origin, destination]),
      fleets: indexBy("id", [fleet]),
    })
    const originalState = structuredClone(turnState)

    // Act
    const issues = validateSubmittedActions([], TestRuleset, turnState)
    const result = resolveTurn(turnState, TestRuleset, createSeededRng())

    // Assert
    const expectedIssues = [
      {
        issue: `Submitting player "${missingPlayerId}" does not exist in this turn`,
        submittedActionId: movementSubmission.id,
        actionDefinitionId: MoveFleetStandard.id,
        actionDefinitionName: MoveFleetStandard.name,
      },
    ]
    expect(issues).toStrictEqual(expectedIssues)
    expect(result).toStrictEqual(Result.Failure(ResolveTurnError.InvalidSubmissions({ issues: expectedIssues })))
    expect(turnState).toStrictEqual(originalState)
  })
})
