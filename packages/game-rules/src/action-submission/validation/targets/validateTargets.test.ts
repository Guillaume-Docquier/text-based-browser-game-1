import { indexBy, branded, Result } from "@guillaume-docquier/tools-ts"
import { typedParse } from "@guillaume-docquier/tools-ts/schemas"
import { describe, expect, it } from "vitest"
import { createSubmittedActionStub } from "#game-rules/action-submission/Action.stub.ts"
import { validateTargets } from "#game-rules/action-submission/validation/targets/validateTargets.ts"
import type { FleetId } from "#game-rules/models/FleetId.ts"
import { FleetNameSchema } from "#game-rules/models/FleetName.ts"
import type { PlanetId } from "#game-rules/models/PlanetId.ts"
import { PlanetNameSchema } from "#game-rules/models/PlanetName.ts"
import type { PlayerId } from "#game-rules/models/PlayerId.ts"
import { createActionDefinitionStub } from "#game-rules/ruleset/action-definitions/ActionDefinition.stub.ts"
import { FleetBuildEffectDefinition } from "#game-rules/ruleset/effect-definitions/implementations/FleetBuildEffectDefinition.ts"
import { createResourcesStub } from "#game-rules/ruleset/effect-definitions/Resources.stub.ts"
import { ResourceType } from "#game-rules/ruleset/effect-definitions/ResourceType.ts"
import { TargetType } from "#game-rules/ruleset/effect-definitions/TargetType.ts"
import { createRulesetStub } from "#game-rules/ruleset/Ruleset.stub.ts"
import { OwnedBySubmittingPlayerConstraint } from "#game-rules/ruleset/target-definitions/implementations/OwnedBySubmittingPlayerTargetConstraint.ts"
import { createTurnStateStub } from "#game-rules/turn-resolution/TurnState.stub.ts"

describe("validateTargets", () => {
  it("should report a target selection missing for a required tag", () => {
    // Arrange
    const playerId = branded<PlayerId>("player-id")
    const actionDefinition = createActionDefinitionStub({
      targets: {
        targetPlayer: { targetType: TargetType.PLAYER, constraints: [] },
      },
    })
    const ruleset = createRulesetStub({ actionDefinitions: indexBy("id", [actionDefinition]) })
    const submittedAction = createSubmittedActionStub({ actionDefinitionId: actionDefinition.id, playerId })
    const turnState = createTurnStateStub({
      submittedActions: [submittedAction],
      players: indexBy("id", [{ id: playerId, resources: createResourcesStub({ [ResourceType.INFLUENCE]: 5 }) }]),
    })

    // Act
    const result = validateTargets([submittedAction], ruleset, turnState)

    // Assert
    expect(result).toStrictEqual<typeof result>(
      Result.Success([
        {
          issue: 'Missing target selection for tag "targetPlayer"',
          submittedActionId: submittedAction.id,
          actionDefinitionId: submittedAction.actionDefinitionId,
          actionDefinitionName: actionDefinition.name,
        },
      ]),
    )
  })

  it("should report unexpected target tags", () => {
    // Arrange
    const playerId = branded<PlayerId>("player-id")
    const actionDefinition = createActionDefinitionStub()
    const ruleset = createRulesetStub({ actionDefinitions: indexBy("id", [actionDefinition]) })
    const submittedAction = createSubmittedActionStub({
      actionDefinitionId: actionDefinition.id,
      playerId,
      selectedTargets: {
        fleet: "unexpected-fleet-id",
      },
    })
    const turnState = createTurnStateStub({
      submittedActions: [submittedAction],
      players: indexBy("id", [{ id: playerId, resources: createResourcesStub({ [ResourceType.INFLUENCE]: 5 }) }]),
    })

    // Act
    const result = validateTargets([submittedAction], ruleset, turnState)

    // Assert
    expect(result).toStrictEqual<typeof result>(
      Result.Success([
        {
          issue: 'Unexpected target tag "fleet"',
          submittedActionId: submittedAction.id,
          actionDefinitionId: submittedAction.actionDefinitionId,
          actionDefinitionName: actionDefinition.name,
        },
      ]),
    )
  })

  it("should report empty target selections", () => {
    // Arrange
    const playerId = branded<PlayerId>("player-id")
    const actionDefinition = createActionDefinitionStub({
      targets: {
        planet: { targetType: TargetType.PLANET, constraints: [] },
      },
      effects: [FleetBuildEffectDefinition.create({ planetTag: "planet", strength: 1 })],
    })
    const ruleset = createRulesetStub({ actionDefinitions: indexBy("id", [actionDefinition]) })
    const submittedAction = createSubmittedActionStub({
      actionDefinitionId: actionDefinition.id,
      playerId,
      selectedTargets: {
        planet: "",
      },
    })
    const turnState = createTurnStateStub({
      submittedActions: [submittedAction],
      players: indexBy("id", [{ id: playerId, resources: createResourcesStub() }]),
    })

    // Act
    const result = validateTargets([submittedAction], ruleset, turnState)

    // Assert
    expect(result).toStrictEqual<typeof result>(
      Result.Success([
        {
          issue: 'Target selection for tag "planet" must be a PLANET id',
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
    const planetId = branded<PlanetId>("planet-id")
    const constraint = OwnedBySubmittingPlayerConstraint.create()
    const actionDefinition = createActionDefinitionStub({
      targets: {
        fleet: { targetType: TargetType.FLEET, constraints: [constraint] },
        planet: { targetType: TargetType.PLANET, constraints: [constraint] },
      },
    })
    const ruleset = createRulesetStub({ actionDefinitions: indexBy("id", [actionDefinition]) })
    const submittedAction = createSubmittedActionStub({
      actionDefinitionId: actionDefinition.id,
      playerId,
      selectedTargets: { fleet: fleetId, planet: planetId },
    })
    const turnState = createTurnStateStub({
      fleets: indexBy("id", [
        { id: fleetId, ownerPlayerId: playerId, name: typedParse(FleetNameSchema, "Test Fleet"), strength: 1, originPlanetId: planetId },
      ]),
      planets: indexBy("id", [{ id: planetId, name: typedParse(PlanetNameSchema, "planet-1"), ownerPlayerId: playerId, x: 0, y: 0 }]),
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
    const planetId = branded<PlanetId>("planet-id")
    const constraint = OwnedBySubmittingPlayerConstraint.create()
    const actionDefinition = createActionDefinitionStub({
      targets: {
        fleet: { targetType: TargetType.FLEET, constraints: [constraint] },
        planet: { targetType: TargetType.PLANET, constraints: [constraint] },
      },
    })
    const ruleset = createRulesetStub({ actionDefinitions: indexBy("id", [actionDefinition]) })
    const submittedAction = createSubmittedActionStub({
      actionDefinitionId: actionDefinition.id,
      playerId,
      selectedTargets: { fleet: fleetId, planet: planetId },
    })
    const turnState = createTurnStateStub({
      fleets: indexBy("id", [
        {
          id: fleetId,
          ownerPlayerId: otherPlayerId,
          name: typedParse(FleetNameSchema, "Test Fleet"),
          strength: 1,
          originPlanetId: planetId,
        },
      ]),
      planets: indexBy("id", [{ id: planetId, name: typedParse(PlanetNameSchema, "planet-1"), ownerPlayerId: otherPlayerId, x: 0, y: 0 }]),
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
    const planetId = branded<PlanetId>("planet-id")
    const actionDefinition = createActionDefinitionStub({
      targets: {
        planet: { targetType: TargetType.PLANET, constraints: [OwnedBySubmittingPlayerConstraint.create()] },
      },
    })
    const ruleset = createRulesetStub({ actionDefinitions: indexBy("id", [actionDefinition]) })
    const submittedAction = createSubmittedActionStub({
      actionDefinitionId: actionDefinition.id,
      playerId,
      selectedTargets: { planet: planetId },
    })
    const turnState = createTurnStateStub({
      planets: indexBy("id", [{ id: planetId, name: typedParse(PlanetNameSchema, "planet-1"), ownerPlayerId: null, x: 0, y: 0 }]),
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

  it.each([
    {
      targetType: TargetType.FLEET,
      targetId: "unknown-fleet",
      issue: 'Target selected for tag "target" references unknown FLEET id "unknown-fleet"',
    },
    { targetType: TargetType.PLANET, targetId: "123", issue: 'Target selected for tag "target" references unknown PLANET id "123"' },
  ])("should report an unknown $targetType target before evaluating its constraint", ({ targetType, targetId, issue }) => {
    // Arrange
    const playerId = branded<PlayerId>("submitting-player")
    const actionDefinition = createActionDefinitionStub({
      targets: {
        target: { targetType, constraints: [OwnedBySubmittingPlayerConstraint.create()] },
      },
    })
    const ruleset = createRulesetStub({ actionDefinitions: indexBy("id", [actionDefinition]) })
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
