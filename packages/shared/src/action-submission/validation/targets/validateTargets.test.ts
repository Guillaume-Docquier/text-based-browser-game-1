import { indexBy, branded, Result } from "@guillaume-docquier/tools-ts"
import { typedParse } from "@guillaume-docquier/tools-ts/schemas"
import { v4 } from "uuid"
import { describe, expect, it } from "vitest"
import { validateTargets } from "#shared/action-submission/validation/targets/validateTargets.ts"
import { PlayerIdSchema } from "#shared/domain/players/PlayerId.ts"
import { createResourcesStub } from "#shared/domain/resources/Resources.stub.ts"
import { ResourceType } from "#shared/domain/resources/ResourceType.ts"
import { createActionDefinitionStub } from "#shared/domain/ruleset/action-definitions/ActionDefinition.stub.ts"
import { FleetBuildEffectDefinition } from "#shared/domain/ruleset/effect-definitions/FleetBuildEffectDefinition.ts"
import { createRulesetStub } from "#shared/domain/ruleset/Ruleset.stub.ts"
import { FleetOwnedBySubmittingPlayerConstraint } from "#shared/domain/ruleset/target-definitions/fleet/FleetOwnedBySubmittingPlayerConstraint.ts"
import { PlanetOwnedBySubmittingPlayerConstraint } from "#shared/domain/ruleset/target-definitions/planet/PlanetOwnedBySubmittingPlayerConstraint.ts"
import { TargetType } from "#shared/domain/ruleset/target-definitions/TargetType.ts"
import { createSubmittedActionStub } from "#shared/domain/turns/actions/Action.stub.ts"
import type { FleetId } from "#shared/domain/world/fleets/FleetId.ts"
import { FleetNameSchema } from "#shared/domain/world/fleets/FleetName.ts"
import type { PlanetId } from "#shared/domain/world/planets/PlanetId.ts"
import { PlanetNameSchema } from "#shared/domain/world/planets/PlanetName.ts"
import { createTurnStateStub } from "#shared/turn-resolution/TurnState.stub.ts"

describe("validateTargets", () => {
  it("should report a target selection missing for a required tag", () => {
    // Arrange
    const playerId = typedParse(PlayerIdSchema, v4())
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
    const playerId = typedParse(PlayerIdSchema, v4())
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
    const playerId = typedParse(PlayerIdSchema, v4())
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

  it("should accept a fleet target owned by the submitting player", () => {
    // Arrange
    const playerId = typedParse(PlayerIdSchema, v4())

    const planetId = branded<PlanetId>("planet-id")
    const fleetId = branded<FleetId>("fleet-id")
    const actionDefinition = createActionDefinitionStub({
      targets: {
        fleet: { targetType: TargetType.FLEET, constraints: [FleetOwnedBySubmittingPlayerConstraint.create()] },
      },
    })
    const ruleset = createRulesetStub({ actionDefinitions: indexBy("id", [actionDefinition]) })
    const submittedAction = createSubmittedActionStub({
      actionDefinitionId: actionDefinition.id,
      playerId,
      selectedTargets: { fleet: fleetId },
    })
    const turnState = createTurnStateStub({
      fleets: indexBy("id", [
        { id: fleetId, ownerPlayerId: playerId, name: typedParse(FleetNameSchema, "Test Fleet"), strength: 1, originPlanetId: planetId },
      ]),
    })

    // Act
    const result = validateTargets([submittedAction], ruleset, turnState)

    // Assert
    expect(result).toStrictEqual<typeof result>(Result.Success([]))
  })

  it("should report a fleet target owned by another player", () => {
    // Arrange
    const playerId = typedParse(PlayerIdSchema, v4())
    const otherPlayerId = typedParse(PlayerIdSchema, v4())
    const planetId = branded<PlanetId>("planet-id")
    const fleetId = branded<FleetId>("fleet-id")
    const actionDefinition = createActionDefinitionStub({
      targets: {
        fleet: { targetType: TargetType.FLEET, constraints: [FleetOwnedBySubmittingPlayerConstraint.create()] },
      },
    })
    const ruleset = createRulesetStub({ actionDefinitions: indexBy("id", [actionDefinition]) })
    const submittedAction = createSubmittedActionStub({
      actionDefinitionId: actionDefinition.id,
      playerId,
      selectedTargets: { fleet: fleetId },
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
      ]),
    )
  })

  it("should report an unknown fleet target before evaluating ownership", () => {
    // Arrange
    const playerId = typedParse(PlayerIdSchema, v4())
    const actionDefinition = createActionDefinitionStub({
      targets: {
        target: { targetType: TargetType.FLEET, constraints: [FleetOwnedBySubmittingPlayerConstraint.create()] },
      },
    })
    const ruleset = createRulesetStub({ actionDefinitions: indexBy("id", [actionDefinition]) })
    const submittedAction = createSubmittedActionStub({
      actionDefinitionId: actionDefinition.id,
      playerId,
      selectedTargets: { target: "unknown-fleet" },
    })
    const turnState = createTurnStateStub()

    // Act
    const result = validateTargets([submittedAction], ruleset, turnState)

    // Assert
    expect(result).toStrictEqual<typeof result>(
      Result.Success([
        {
          issue: 'Target selected for tag "target" references unknown FLEET id "unknown-fleet"',
          submittedActionId: submittedAction.id,
          actionDefinitionId: actionDefinition.id,
          actionDefinitionName: actionDefinition.name,
        },
      ]),
    )
  })

  it("should accept a planet target owned by the submitting player", () => {
    // Arrange
    const playerId = typedParse(PlayerIdSchema, v4())

    const planetId = branded<PlanetId>("planet-id")

    const actionDefinition = createActionDefinitionStub({
      targets: {
        planet: { targetType: TargetType.PLANET, constraints: [PlanetOwnedBySubmittingPlayerConstraint.create()] },
      },
    })
    const ruleset = createRulesetStub({ actionDefinitions: indexBy("id", [actionDefinition]) })
    const submittedAction = createSubmittedActionStub({
      actionDefinitionId: actionDefinition.id,
      playerId,
      selectedTargets: { planet: planetId },
    })
    const turnState = createTurnStateStub({
      planets: indexBy("id", [{ id: planetId, name: typedParse(PlanetNameSchema, "planet-1"), ownerPlayerId: playerId, x: 0, y: 0 }]),
    })

    // Act
    const result = validateTargets([submittedAction], ruleset, turnState)

    // Assert
    expect(result).toStrictEqual<typeof result>(Result.Success([]))
  })

  it("should report a planet target owned by another player", () => {
    // Arrange
    const playerId = typedParse(PlayerIdSchema, v4())
    const otherPlayerId = typedParse(PlayerIdSchema, v4())
    const planetId = branded<PlanetId>("planet-id")

    const actionDefinition = createActionDefinitionStub({
      targets: {
        planet: { targetType: TargetType.PLANET, constraints: [PlanetOwnedBySubmittingPlayerConstraint.create()] },
      },
    })
    const ruleset = createRulesetStub({ actionDefinitions: indexBy("id", [actionDefinition]) })
    const submittedAction = createSubmittedActionStub({
      actionDefinitionId: actionDefinition.id,
      playerId,
      selectedTargets: { planet: planetId },
    })
    const turnState = createTurnStateStub({
      planets: indexBy("id", [{ id: planetId, name: typedParse(PlanetNameSchema, "planet-1"), ownerPlayerId: otherPlayerId, x: 0, y: 0 }]),
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

  it("should report an unknown planet target before evaluating ownership", () => {
    // Arrange
    const playerId = typedParse(PlayerIdSchema, v4())
    const actionDefinition = createActionDefinitionStub({
      targets: {
        target: { targetType: TargetType.PLANET, constraints: [PlanetOwnedBySubmittingPlayerConstraint.create()] },
      },
    })
    const ruleset = createRulesetStub({ actionDefinitions: indexBy("id", [actionDefinition]) })
    const submittedAction = createSubmittedActionStub({
      actionDefinitionId: actionDefinition.id,
      playerId,
      selectedTargets: { target: "unknown-planet" },
    })
    const turnState = createTurnStateStub()

    // Act
    const result = validateTargets([submittedAction], ruleset, turnState)

    // Assert
    expect(result).toStrictEqual<typeof result>(
      Result.Success([
        {
          issue: 'Target selected for tag "target" references unknown PLANET id "unknown-planet"',
          submittedActionId: submittedAction.id,
          actionDefinitionId: actionDefinition.id,
          actionDefinitionName: actionDefinition.name,
        },
      ]),
    )
  })

  it("should report an unowned planet target", () => {
    // Arrange
    const playerId = typedParse(PlayerIdSchema, v4())
    const planetId = branded<PlanetId>("planet-id")
    const actionDefinition = createActionDefinitionStub({
      targets: {
        planet: { targetType: TargetType.PLANET, constraints: [PlanetOwnedBySubmittingPlayerConstraint.create()] },
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
})
