import { Assert, branded, Result } from "@guillaume-docquier/tools-ts"
import { describe, expect, it } from "vitest"
import type { FleetId } from "#lib/db/fleets/FleetId.ts"
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
import { OwnedBySubmittingPlayerConstraint } from "#lib/rules-engine/ruleset-model/target-constraints/implementations/OwnedBySubmittingPlayerConstraint.ts"
import { createTurnStateStub } from "#lib/rules-engine/turn-resolution/TurnState.stub.ts"

describe("validateTargets", () => {
  it("should accept any known PLANET target and reject unknown targets", () => {
    // Arrange
    const playerId = branded<PlayerId>("player-id")

    const ownedPlanetId = branded<PlanetId>(1)
    const unknownPlanetId = branded<PlanetId>(2)

    const actionDefinition = createActionDefinitionStub({
      targets: { planet: { type: TargetType.PLANET, constraints: [] } },
      mechanics: [FleetBuildMechanic.create({ planetTag: "planet", strength: 1 })],
    })
    const ruleset = createRulesetStub({
      actionDefinitions: { [actionDefinition.id]: actionDefinition },
    })
    const submittedActions = [ownedPlanetId, unknownPlanetId].map((planetId) =>
      createSubmittedActionStub({
        actionDefinitionId: actionDefinition.id,
        playerId,
        selectedTargets: { planet: String(planetId) },
      }),
    )

    const unknownPlanetAction = submittedActions[1]
    Assert.isDefined(unknownPlanetAction)

    const turnState = createTurnStateStub({
      submittedActions,
      players: {
        [playerId]: { id: playerId, resources: createResourcesStub() },
      },
      planets: {
        [ownedPlanetId]: { id: ownedPlanetId, ownerPlayerId: playerId, x: 0, y: 0 },
      },
    })

    // Act
    const result = validateTargets(submittedActions, ruleset, turnState)

    // Assert
    expect(result).toStrictEqual<typeof result>(
      Result.Success([
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
        targetPlayer: { type: TargetType.PLAYER, constraints: [] },
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
        planet: { type: TargetType.PLANET, constraints: [] },
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

  it("should evaluate ownership constraints against owned, unclaimed, and opponent planets", () => {
    // Arrange
    const playerId = branded<PlayerId>("player-id")
    const opponentPlayerId = branded<PlayerId>("opponent-player-id")
    const ownedPlanetId = branded<PlanetId>(1)
    const unclaimedPlanetId = branded<PlanetId>(2)
    const opponentPlanetId = branded<PlanetId>(3)
    const actionDefinition = createActionDefinitionStub({
      targets: {
        planet: {
          type: TargetType.PLANET,
          constraints: [OwnedBySubmittingPlayerConstraint.create()],
        },
      },
    })
    const ruleset = createRulesetStub({ actionDefinitions: { [actionDefinition.id]: actionDefinition } })
    const submittedActions = [ownedPlanetId, unclaimedPlanetId, opponentPlanetId].map((planetId) =>
      createSubmittedActionStub({
        actionDefinitionId: actionDefinition.id,
        playerId,
        selectedTargets: { planet: String(planetId) },
      }),
    )
    const turnState = createTurnStateStub({
      submittedActions,
      players: {
        [playerId]: { id: playerId, resources: createResourcesStub() },
        [opponentPlayerId]: { id: opponentPlayerId, resources: createResourcesStub() },
      },
      planets: {
        [ownedPlanetId]: { id: ownedPlanetId, ownerPlayerId: playerId, x: 0, y: 0 },
        [unclaimedPlanetId]: { id: unclaimedPlanetId, ownerPlayerId: null, x: 1, y: 1 },
        [opponentPlanetId]: { id: opponentPlanetId, ownerPlayerId: opponentPlayerId, x: 2, y: 2 },
      },
    })

    // Act
    const result = validateTargets(submittedActions, ruleset, turnState)

    // Assert
    const unclaimedAction = submittedActions[1]
    const opponentAction = submittedActions[2]
    Assert.isDefined(unclaimedAction)
    Assert.isDefined(opponentAction)
    expect(result).toStrictEqual<typeof result>(
      Result.Success([
        {
          issue: 'Target "planet" is not owned by submitting player "player-id".',
          submittedActionId: unclaimedAction.id,
          actionDefinitionId: actionDefinition.id,
          actionDefinitionName: actionDefinition.name,
        },
        {
          issue: 'Target "planet" is not owned by submitting player "player-id".',
          submittedActionId: opponentAction.id,
          actionDefinitionId: actionDefinition.id,
          actionDefinitionName: actionDefinition.name,
        },
      ]),
    )
  })

  it("should evaluate ownership constraints against owned, opponent, and unknown fleets", () => {
    // Arrange
    const playerId = branded<PlayerId>("player-id")
    const opponentPlayerId = branded<PlayerId>("opponent-player-id")
    const ownedFleetId = branded<FleetId>("owned-fleet-id")
    const opponentFleetId = branded<FleetId>("opponent-fleet-id")
    const unknownFleetId = branded<FleetId>("unknown-fleet-id")
    const actionDefinition = createActionDefinitionStub({
      targets: {
        fleet: {
          type: TargetType.FLEET,
          constraints: [OwnedBySubmittingPlayerConstraint.create()],
        },
      },
    })
    const ruleset = createRulesetStub({ actionDefinitions: { [actionDefinition.id]: actionDefinition } })
    const submittedActions = [ownedFleetId, opponentFleetId, unknownFleetId].map((fleetId) =>
      createSubmittedActionStub({
        actionDefinitionId: actionDefinition.id,
        playerId,
        selectedTargets: { fleet: String(fleetId) },
      }),
    )
    const originPlanetId = branded<PlanetId>(1)
    const turnState = createTurnStateStub({
      submittedActions,
      players: {
        [playerId]: { id: playerId, resources: createResourcesStub() },
        [opponentPlayerId]: { id: opponentPlayerId, resources: createResourcesStub() },
      },
      fleets: {
        [ownedFleetId]: { id: ownedFleetId, playerId, strength: 1, originPlanetId },
        [opponentFleetId]: { id: opponentFleetId, playerId: opponentPlayerId, strength: 1, originPlanetId },
      },
    })

    // Act
    const result = validateTargets(submittedActions, ruleset, turnState)

    // Assert
    const opponentAction = submittedActions[1]
    const unknownAction = submittedActions[2]
    Assert.isDefined(opponentAction)
    Assert.isDefined(unknownAction)
    expect(result).toStrictEqual<typeof result>(
      Result.Success([
        {
          issue: 'Target slot "fleet" references unknown Fleet id "unknown-fleet-id"',
          submittedActionId: unknownAction.id,
          actionDefinitionId: actionDefinition.id,
          actionDefinitionName: actionDefinition.name,
        },
        {
          issue: 'Target "fleet" is not owned by submitting player "player-id".',
          submittedActionId: opponentAction.id,
          actionDefinitionId: actionDefinition.id,
          actionDefinitionName: actionDefinition.name,
        },
      ]),
    )
  })

  it("should accept any known planet when no ownership constraint is configured", () => {
    // Arrange
    const playerId = branded<PlayerId>("player-id")
    const opponentPlayerId = branded<PlayerId>("opponent-player-id")
    const unclaimedPlanetId = branded<PlanetId>(1)
    const opponentPlanetId = branded<PlanetId>(2)
    const actionDefinition = createActionDefinitionStub({
      targets: { planet: { type: TargetType.PLANET, constraints: [] } },
    })
    const ruleset = createRulesetStub({ actionDefinitions: { [actionDefinition.id]: actionDefinition } })
    const submittedActions = [unclaimedPlanetId, opponentPlanetId].map((planetId) =>
      createSubmittedActionStub({
        actionDefinitionId: actionDefinition.id,
        playerId,
        selectedTargets: { planet: String(planetId) },
      }),
    )
    const turnState = createTurnStateStub({
      submittedActions,
      players: {
        [playerId]: { id: playerId, resources: createResourcesStub() },
        [opponentPlayerId]: { id: opponentPlayerId, resources: createResourcesStub() },
      },
      planets: {
        [unclaimedPlanetId]: { id: unclaimedPlanetId, ownerPlayerId: null, x: 0, y: 0 },
        [opponentPlanetId]: { id: opponentPlanetId, ownerPlayerId: opponentPlayerId, x: 1, y: 1 },
      },
    })

    // Act
    const result = validateTargets(submittedActions, ruleset, turnState)

    // Assert
    expect(result).toStrictEqual<typeof result>(Result.Success([]))
  })

  it("should keep PLAYER target validation unchanged", () => {
    // Arrange
    const playerId = branded<PlayerId>("player-id")
    const actionDefinition = createActionDefinitionStub({
      targets: { player: { type: TargetType.PLAYER, constraints: [] } },
    })
    const ruleset = createRulesetStub({ actionDefinitions: { [actionDefinition.id]: actionDefinition } })
    const submittedAction = createSubmittedActionStub({
      actionDefinitionId: actionDefinition.id,
      playerId,
      selectedTargets: { player: String(playerId) },
    })
    const turnState = createTurnStateStub({
      submittedActions: [submittedAction],
      players: {
        [playerId]: { id: playerId, resources: createResourcesStub() },
      },
    })

    // Act
    const result = validateTargets([submittedAction], ruleset, turnState)

    // Assert
    expect(result).toStrictEqual<typeof result>(Result.Success([]))
  })

  it("should report ordinary target issues before evaluating valid target constraints", () => {
    // Arrange
    const playerId = branded<PlayerId>("player-id")
    const opponentPlayerId = branded<PlayerId>("opponent-player-id")
    const opponentPlanetId = branded<PlanetId>(1)
    const unknownPlanetId = branded<PlanetId>(2)
    const ownershipConstraint = OwnedBySubmittingPlayerConstraint.create()
    const actionDefinition = createActionDefinitionStub({
      targets: {
        invalid: { type: TargetType.PLANET, constraints: [ownershipConstraint] },
        valid: { type: TargetType.PLANET, constraints: [ownershipConstraint] },
      },
    })
    const ruleset = createRulesetStub({ actionDefinitions: { [actionDefinition.id]: actionDefinition } })
    const submittedAction = createSubmittedActionStub({
      actionDefinitionId: actionDefinition.id,
      playerId,
      selectedTargets: {
        invalid: String(unknownPlanetId),
        valid: String(opponentPlanetId),
      },
    })
    const turnState = createTurnStateStub({
      submittedActions: [submittedAction],
      players: {
        [playerId]: { id: playerId, resources: createResourcesStub() },
        [opponentPlayerId]: { id: opponentPlayerId, resources: createResourcesStub() },
      },
      planets: {
        [opponentPlanetId]: { id: opponentPlanetId, ownerPlayerId: opponentPlayerId, x: 0, y: 0 },
      },
    })

    // Act
    const result = validateTargets([submittedAction], ruleset, turnState)

    // Assert
    expect(result).toStrictEqual<typeof result>(
      Result.Success([
        {
          issue: 'Target slot "invalid" references unknown Planet id "2"',
          submittedActionId: submittedAction.id,
          actionDefinitionId: actionDefinition.id,
          actionDefinitionName: actionDefinition.name,
        },
        {
          issue: 'Target "valid" is not owned by submitting player "player-id".',
          submittedActionId: submittedAction.id,
          actionDefinitionId: actionDefinition.id,
          actionDefinitionName: actionDefinition.name,
        },
      ]),
    )
  })

  it("should evaluate mechanic constraints before additive action constraints and preserve duplicates", () => {
    // Arrange
    const playerId = branded<PlayerId>("player-id")
    const opponentPlayerId = branded<PlayerId>("opponent-player-id")
    const planetId = branded<PlanetId>(1)
    const ownershipConstraint = OwnedBySubmittingPlayerConstraint.create()
    const fleetBuild = FleetBuildMechanic.create({ planetTag: "planet", strength: 1 })
    const constrainedFleetBuild = {
      ...fleetBuild,
      targets: {
        planet: {
          ...fleetBuild.targets.planet,
          constraints: [ownershipConstraint, ownershipConstraint],
        },
      },
    }
    const actionDefinition = createActionDefinitionStub({
      targets: {
        planet: {
          type: TargetType.PLANET,
          constraints: [ownershipConstraint],
        },
      },
      mechanics: [constrainedFleetBuild],
    })
    const ruleset = createRulesetStub({ actionDefinitions: { [actionDefinition.id]: actionDefinition } })
    const submittedAction = createSubmittedActionStub({
      actionDefinitionId: actionDefinition.id,
      playerId,
      selectedTargets: { planet: String(planetId) },
    })
    const turnState = createTurnStateStub({
      submittedActions: [submittedAction],
      players: {
        [playerId]: { id: playerId, resources: createResourcesStub() },
        [opponentPlayerId]: { id: opponentPlayerId, resources: createResourcesStub() },
      },
      planets: {
        [planetId]: { id: planetId, ownerPlayerId: opponentPlayerId, x: 0, y: 0 },
      },
    })

    // Act
    const result = validateTargets([submittedAction], ruleset, turnState)

    // Assert
    expect(result).toStrictEqual<typeof result>(
      Result.Success([
        {
          issue: 'Target "planet" is not owned by submitting player "player-id".',
          submittedActionId: submittedAction.id,
          actionDefinitionId: actionDefinition.id,
          actionDefinitionName: actionDefinition.name,
        },
        {
          issue: 'Target "planet" is not owned by submitting player "player-id".',
          submittedActionId: submittedAction.id,
          actionDefinitionId: actionDefinition.id,
          actionDefinitionName: actionDefinition.name,
        },
        {
          issue: 'Target "planet" is not owned by submitting player "player-id".',
          submittedActionId: submittedAction.id,
          actionDefinitionId: actionDefinition.id,
          actionDefinitionName: actionDefinition.name,
        },
      ]),
    )
  })

  it("should propagate target constraint evaluator failures", () => {
    // Arrange
    const playerId = branded<PlayerId>("player-id")
    const actionDefinition = createActionDefinitionStub({
      targets: {
        player: {
          type: TargetType.PLAYER,
          constraints: [OwnedBySubmittingPlayerConstraint.create()],
        },
      },
    })
    const ruleset = createRulesetStub({ actionDefinitions: { [actionDefinition.id]: actionDefinition } })
    const submittedAction = createSubmittedActionStub({
      actionDefinitionId: actionDefinition.id,
      playerId,
      selectedTargets: { player: String(playerId) },
    })
    const turnState = createTurnStateStub({
      submittedActions: [submittedAction],
      players: {
        [playerId]: { id: playerId, resources: createResourcesStub() },
      },
    })

    // Act
    const result = validateTargets([submittedAction], ruleset, turnState)

    // Assert
    expect(result).toStrictEqual<typeof result>(
      Result.Failure({
        type: "SUBMITTED_ACTION_VALIDATION_ERROR",
        submittedActionId: submittedAction.id,
        actionDefinitionId: actionDefinition.id,
        targetTag: "player",
        message: `Could not evaluate target constraint "OWNED_BY_SUBMITTING_PLAYER" for target slot "player" on submitted action "${submittedAction.id}": Target constraint "OWNED_BY_SUBMITTING_PLAYER" does not support target type "PLAYER".`,
        cause: {
          type: "TARGET_CONSTRAINT_EVALUATION_ERROR",
          constraintType: "OWNED_BY_SUBMITTING_PLAYER",
          targetType: "PLAYER",
          message: 'Target constraint "OWNED_BY_SUBMITTING_PLAYER" does not support target type "PLAYER".',
        },
      }),
    )
  })
})
