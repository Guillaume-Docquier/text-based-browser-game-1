import { Assert, branded, Result } from "@guillaume-docquier/tools-ts"
import { describe, expect, it } from "vitest"
import type { PlanetId } from "#lib/db/planets/PlanetId.ts"
import type { PlayerId } from "#lib/db/players/PlayerId.ts"
import { createSubmittedActionStub } from "#lib/rules-engine/action-submission/Action.stub.ts"
import { validateTargets } from "#lib/rules-engine/action-submission/validation/validators/validateTargets.ts"
import { createActionDefinitionStub } from "#lib/rules-engine/ruleset-model/actions/ActionDefinition.stub.ts"
import { FleetBuildMechanic } from "#lib/rules-engine/ruleset-model/mechanics/implementations/FleetBuildMechanic.ts"
import { createResourcesStub } from "#lib/rules-engine/ruleset-model/mechanics/Resources.stub.ts"
import { ResourceType } from "#lib/rules-engine/ruleset-model/mechanics/ResourceType.ts"
import { TargetType } from "#lib/rules-engine/ruleset-model/mechanics/TargetType.ts"
import { createRulesetStub } from "#lib/rules-engine/ruleset-model/Ruleset.stub.ts"
import { createTurnStateStub } from "#lib/rules-engine/turn-resolution/TurnState.stub.ts"

describe("validateTargets", () => {
  it("should only accept a PLANET_OWNED target owned by the submitting player", () => {
    // Arrange
    const playerId = branded<PlayerId>("player-id")
    const opponentId = branded<PlayerId>("opponent-id")

    const ownedPlanetId = branded<PlanetId>(1)
    const unclaimedPlanetId = branded<PlanetId>(2)
    const opponentPlanetId = branded<PlanetId>(3)
    const unknownPlanetId = branded<PlanetId>(4)

    const actionDefinition = createActionDefinitionStub({
      targets: { planet: TargetType.PLANET_OWNED },
      mechanics: [FleetBuildMechanic.create({ planetTag: "planet", strength: 1 })],
    })
    const ruleset = createRulesetStub({
      actionDefinitions: { [actionDefinition.id]: actionDefinition },
    })
    const submittedActions = [ownedPlanetId, unclaimedPlanetId, opponentPlanetId, unknownPlanetId].map((planetId) =>
      createSubmittedActionStub({
        actionDefinitionId: actionDefinition.id,
        playerId,
        selectedTargets: { planet: String(planetId) },
      }),
    )

    const unclaimedPlanetAction = submittedActions[1]
    Assert.isDefined(unclaimedPlanetAction)

    const opponentPlanetAction = submittedActions[2]
    Assert.isDefined(opponentPlanetAction)

    const unknownPlanetAction = submittedActions[3]
    Assert.isDefined(unknownPlanetAction)

    const turnState = createTurnStateStub({
      submittedActions,
      players: {
        [playerId]: { id: playerId, resources: createResourcesStub() },
        [opponentId]: { id: opponentId, resources: createResourcesStub() },
      },
      planets: {
        [ownedPlanetId]: { id: ownedPlanetId, ownerPlayerId: playerId, x: 0, y: 0 },
        [unclaimedPlanetId]: { id: unclaimedPlanetId, ownerPlayerId: null, x: 0, y: 0 },
        [opponentPlanetId]: { id: opponentPlanetId, ownerPlayerId: opponentId, x: 0, y: 0 },
      },
    })

    // Act
    const result = validateTargets(submittedActions, ruleset, turnState)

    // Assert
    expect(result).toStrictEqual<typeof result>(
      Result.Success([
        {
          issue: `Target slot "planet" references Planet id "${unclaimedPlanetId}" that is not owned by Player "${playerId}"`,
          submittedActionId: unclaimedPlanetAction.id,
          actionDefinitionId: actionDefinition.id,
          actionDefinitionName: actionDefinition.name,
        },
        {
          issue: `Target slot "planet" references Planet id "${opponentPlanetId}" that is not owned by Player "${playerId}"`,
          submittedActionId: opponentPlanetAction.id,
          actionDefinitionId: actionDefinition.id,
          actionDefinitionName: actionDefinition.name,
        },
        {
          issue: `Target slot "planet" references unknown Planet id "${unknownPlanetId}"`,
          submittedActionId: unknownPlanetAction.id,
          actionDefinitionId: actionDefinition.id,
          actionDefinitionName: actionDefinition.name,
        },
      ]),
    )
  })

  it("should report a target slot required by the Action Definition but missing from the submission", () => {
    // Arrange
    const playerId = branded<PlayerId>("player-id")
    const actionDefinition = createActionDefinitionStub({
      targets: {
        targetPlayer: TargetType.PLAYER,
      },
    })
    const ruleset = createRulesetStub({
      actionDefinitions: {
        [actionDefinition.id]: actionDefinition,
      },
    })
    const submittedAction = createSubmittedActionStub({ actionDefinitionId: actionDefinition.id, playerId })
    const turnState = createTurnStateStub({
      submittedActions: [submittedAction],
      players: {
        [playerId]: {
          id: playerId,
          resources: createResourcesStub({ [ResourceType.INFLUENCE]: 5 }),
        },
      },
    })

    // Act
    const result = validateTargets([submittedAction], ruleset, turnState)

    // Assert
    expect(result).toStrictEqual<typeof result>(
      Result.Success([
        {
          issue: 'Missing target slot "targetPlayer"',
          submittedActionId: submittedAction.id,
          actionDefinitionId: submittedAction.actionDefinitionId,
          actionDefinitionName: actionDefinition.name,
        },
      ]),
    )
  })

  it("should report unexpected target slots", () => {
    // Arrange
    const playerId = branded<PlayerId>("player-id")
    const actionDefinition = createActionDefinitionStub()
    const ruleset = createRulesetStub({ actionDefinitions: { [actionDefinition.id]: actionDefinition } })
    const submittedAction = createSubmittedActionStub({
      actionDefinitionId: actionDefinition.id,
      playerId,
      selectedTargets: {
        fleet: "unexpected-fleet-slot",
      },
    })
    const turnState = createTurnStateStub({
      submittedActions: [submittedAction],
      players: {
        [playerId]: {
          id: playerId,
          resources: createResourcesStub({ [ResourceType.INFLUENCE]: 5 }),
        },
      },
    })

    // Act
    const result = validateTargets([submittedAction], ruleset, turnState)

    // Assert
    expect(result).toStrictEqual<typeof result>(
      Result.Success([
        {
          issue: 'Unexpected target slot "fleet"',
          submittedActionId: submittedAction.id,
          actionDefinitionId: submittedAction.actionDefinitionId,
          actionDefinitionName: actionDefinition.name,
        },
      ]),
    )
  })

  it("should report empty target slots", () => {
    // Arrange
    const playerId = branded<PlayerId>("player-id")
    const actionDefinition = createActionDefinitionStub({
      targets: {
        planet: TargetType.PLANET,
      },
      mechanics: [FleetBuildMechanic.create({ planetTag: "planet", strength: 1 })],
    })
    const ruleset = createRulesetStub({
      actionDefinitions: {
        [actionDefinition.id]: actionDefinition,
      },
    })
    const submittedAction = createSubmittedActionStub({
      actionDefinitionId: actionDefinition.id,
      playerId,
      selectedTargets: {
        planet: "",
      },
    })
    const turnState = createTurnStateStub({
      submittedActions: [submittedAction],
      players: {
        [playerId]: {
          id: playerId,
          resources: createResourcesStub(),
        },
      },
    })

    // Act
    const result = validateTargets([submittedAction], ruleset, turnState)

    // Assert
    expect(result).toStrictEqual<typeof result>(
      Result.Success([
        {
          issue: 'Target slot "planet" must be set to a PLANET id',
          submittedActionId: submittedAction.id,
          actionDefinitionId: submittedAction.actionDefinitionId,
          actionDefinitionName: actionDefinition.name,
        },
      ]),
    )
  })
})
