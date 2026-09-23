import { branded, Result } from "@guillaume-docquier/tools-ts"
import { describe, expect, it } from "vitest"
import type { FleetId } from "#lib/db/fleets/FleetId.ts"
import type { PlanetId } from "#lib/db/planets/PlanetId.ts"
import type { PlayerId } from "#lib/db/players/PlayerId.ts"
import { indexById } from "#lib/indexById.ts"
import { createSubmittedActionStub } from "#lib/rules-engine/action-submission/Action.stub.ts"
import { validateTargets } from "#lib/rules-engine/action-submission/validation/validators/validateTargets.ts"
import { createActionDefinitionStub } from "#lib/rules-engine/ruleset-model/actions/ActionDefinition.stub.ts"
import { FleetBuildMechanic } from "#lib/rules-engine/ruleset-model/mechanics/implementations/FleetBuildMechanic.ts"
import { createResourcesStub } from "#lib/rules-engine/ruleset-model/mechanics/Resources.stub.ts"
import { ResourceType } from "#lib/rules-engine/ruleset-model/mechanics/ResourceType.ts"
import { TargetType } from "#lib/rules-engine/ruleset-model/mechanics/TargetType.ts"
import { createRulesetStub } from "#lib/rules-engine/ruleset-model/Ruleset.stub.ts"
import { OwnedBySubmittingPlayerConstraint } from "#lib/rules-engine/ruleset-model/target-constraints/implementations/OwnedBySubmittingPlayerTargetConstraint.ts"
import { createTurnStateStub } from "#lib/rules-engine/turn-resolution/TurnState.stub.ts"

describe("validateTargets", () => {
  it("should report a target slot required by the Action Definition but missing from the submission", () => {
    // Arrange
    const playerId = branded<PlayerId>("player-id")
    const actionDefinition = createActionDefinitionStub({
      targets: {
        targetPlayer: { targetType: TargetType.PLAYER, constraints: [] },
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
        planet: { targetType: TargetType.PLANET, constraints: [] },
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

  it("should accept fleet and planet targets owned by the submitting player", () => {
    // Arrange
    const playerId = branded<PlayerId>("submitting-player")
    const fleetId = branded<FleetId>("fleet-id")
    const planetId = branded<PlanetId>(1)
    const constraint = OwnedBySubmittingPlayerConstraint.create()
    const actionDefinition = createActionDefinitionStub({
      targets: {
        fleet: { targetType: TargetType.FLEET, constraints: [constraint] },
        planet: { targetType: TargetType.PLANET, constraints: [constraint] },
      },
    })
    const ruleset = createRulesetStub({ actionDefinitions: indexById([actionDefinition]) })
    const submittedAction = createSubmittedActionStub({
      actionDefinitionId: actionDefinition.id,
      playerId,
      selectedTargets: { fleet: fleetId, planet: String(planetId) },
    })
    const turnState = createTurnStateStub({
      fleets: { [fleetId]: { id: fleetId, playerId, strength: 1, originPlanetId: planetId } },
      planets: { [planetId]: { id: planetId, ownerPlayerId: playerId, x: 0, y: 0 } },
    })

    // Act
    const result = validateTargets([submittedAction], ruleset, turnState)

    // Assert
    expect(result).toStrictEqual<typeof result>(Result.Success([]))
  })

  it("should report fleet and planet targets owned by another player", () => {
    // Arrange
    const playerId = branded<PlayerId>("submitting-player")
    const otherPlayerId = branded<PlayerId>("other-player")
    const fleetId = branded<FleetId>("fleet-id")
    const planetId = branded<PlanetId>(1)
    const constraint = OwnedBySubmittingPlayerConstraint.create()
    const actionDefinition = createActionDefinitionStub({
      targets: {
        fleet: { targetType: TargetType.FLEET, constraints: [constraint] },
        planet: { targetType: TargetType.PLANET, constraints: [constraint] },
      },
    })
    const ruleset = createRulesetStub({ actionDefinitions: { [actionDefinition.id]: actionDefinition } })
    const submittedAction = createSubmittedActionStub({
      actionDefinitionId: actionDefinition.id,
      playerId,
      selectedTargets: { fleet: fleetId, planet: String(planetId) },
    })
    const turnState = createTurnStateStub({
      fleets: { [fleetId]: { id: fleetId, playerId: otherPlayerId, strength: 1, originPlanetId: planetId } },
      planets: { [planetId]: { id: planetId, ownerPlayerId: otherPlayerId, x: 0, y: 0 } },
    })

    // Act
    const result = validateTargets([submittedAction], ruleset, turnState)

    // Assert
    expect(result).toStrictEqual<typeof result>(
      Result.Success([
        {
          issue: "Expected target fleet to be owned by the submitting player.",
          submittedActionId: submittedAction.id,
          actionDefinitionId: actionDefinition.id,
          actionDefinitionName: actionDefinition.name,
        },
        {
          issue: "Expected target planet to be owned by the submitting player.",
          submittedActionId: submittedAction.id,
          actionDefinitionId: actionDefinition.id,
          actionDefinitionName: actionDefinition.name,
        },
      ]),
    )
  })

  it("should report an unowned planet target", () => {
    // Arrange
    const playerId = branded<PlayerId>("submitting-player")
    const planetId = branded<PlanetId>(1)
    const actionDefinition = createActionDefinitionStub({
      targets: {
        planet: { targetType: TargetType.PLANET, constraints: [OwnedBySubmittingPlayerConstraint.create()] },
      },
    })
    const ruleset = createRulesetStub({ actionDefinitions: { [actionDefinition.id]: actionDefinition } })
    const submittedAction = createSubmittedActionStub({
      actionDefinitionId: actionDefinition.id,
      playerId,
      selectedTargets: { planet: String(planetId) },
    })
    const turnState = createTurnStateStub({
      planets: { [planetId]: { id: planetId, ownerPlayerId: null, x: 0, y: 0 } },
    })

    // Act
    const result = validateTargets([submittedAction], ruleset, turnState)

    // Assert
    expect(result).toStrictEqual<typeof result>(
      Result.Success([
        {
          issue: "Expected target planet to be owned by the submitting player.",
          submittedActionId: submittedAction.id,
          actionDefinitionId: actionDefinition.id,
          actionDefinitionName: actionDefinition.name,
        },
      ]),
    )
  })

  it("should report a constraint incompatible with a player target", () => {
    // Arrange
    const playerId = branded<PlayerId>("submitting-player")
    const targetPlayerId = branded<PlayerId>("target-player")
    const actionDefinition = createActionDefinitionStub({
      targets: {
        player: { targetType: TargetType.PLAYER, constraints: [OwnedBySubmittingPlayerConstraint.create()] },
      },
    })
    const ruleset = createRulesetStub({ actionDefinitions: { [actionDefinition.id]: actionDefinition } })
    const submittedAction = createSubmittedActionStub({
      actionDefinitionId: actionDefinition.id,
      playerId,
      selectedTargets: { player: targetPlayerId },
    })
    const turnState = createTurnStateStub({
      players: { [targetPlayerId]: { id: targetPlayerId, resources: createResourcesStub() } },
    })

    // Act
    const result = validateTargets([submittedAction], ruleset, turnState)

    // Assert
    expect(result).toStrictEqual<typeof result>(
      Result.Success([
        {
          issue: "A player cannot be owned, this constraint is invalid.",
          submittedActionId: submittedAction.id,
          actionDefinitionId: actionDefinition.id,
          actionDefinitionName: actionDefinition.name,
        },
      ]),
    )
  })

  it.each([
    { targetType: TargetType.FLEET, targetId: "unknown-fleet", issue: 'Target slot "target" references unknown Fleet id "unknown-fleet"' },
    { targetType: TargetType.PLANET, targetId: "123", issue: 'Target slot "target" references unknown Planet id "123"' },
    {
      targetType: TargetType.PLAYER,
      targetId: "unknown-player",
      issue: 'Target slot "target" references unknown Player id "unknown-player"',
    },
  ])("should report an unknown $targetType target before evaluating its constraint", ({ targetType, targetId, issue }) => {
    // Arrange
    const playerId = branded<PlayerId>("submitting-player")
    const actionDefinition = createActionDefinitionStub({
      targets: {
        target: { targetType, constraints: [OwnedBySubmittingPlayerConstraint.create()] },
      },
    })
    const ruleset = createRulesetStub({ actionDefinitions: { [actionDefinition.id]: actionDefinition } })
    const submittedAction = createSubmittedActionStub({
      actionDefinitionId: actionDefinition.id,
      playerId,
      selectedTargets: { target: targetId },
    })
    const turnState = createTurnStateStub()

    // Act
    const result = validateTargets([submittedAction], ruleset, turnState)

    // Assert
    expect(result).toStrictEqual<typeof result>(
      Result.Success([
        {
          issue,
          submittedActionId: submittedAction.id,
          actionDefinitionId: actionDefinition.id,
          actionDefinitionName: actionDefinition.name,
        },
      ]),
    )
  })
})
