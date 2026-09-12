import { branded } from "@guillaume-docquier/tools-ts"
import { describe, expect, it } from "vitest"
import type { PlayerId } from "#lib/db/players/PlayerId.ts"
import { createSubmittedActionStub } from "#lib/rules-engine/action-submission/Action.stub.ts"
import { validateSubmittedActions } from "#lib/rules-engine/action-submission/validation/validateSubmittedActions.ts"
import { createActionDefinitionStub } from "#lib/rules-engine/ruleset-model/actions/ActionDefinition.stub.ts"
import { FleetBuildMechanic } from "#lib/rules-engine/ruleset-model/mechanics/implementations/FleetBuildMechanic.ts"
import { ResourceLossMechanic } from "#lib/rules-engine/ruleset-model/mechanics/implementations/ResourceLossMechanic.ts"
import { createResourcesStub } from "#lib/rules-engine/ruleset-model/mechanics/Resources.stub.ts"
import { ResourceType } from "#lib/rules-engine/ruleset-model/mechanics/ResourceType.ts"
import { TargetType } from "#lib/rules-engine/ruleset-model/mechanics/TargetType.ts"
import { createRulesetStub } from "#lib/rules-engine/ruleset-model/Ruleset.stub.ts"
import { createTurnStateStub } from "#lib/rules-engine/turn-resolution/TurnState.stub.ts"

const actionDefinition = createActionDefinitionStub({
  costs: [ResourceLossMechanic.create({ quantity: 5, resourceType: ResourceType.INFLUENCE })],
})

const ruleset = createRulesetStub({
  actionDefinitions: {
    [actionDefinition.id]: actionDefinition,
  },
  startingResources: createResourcesStub({
    [ResourceType.INFLUENCE]: 3,
    [ResourceType.METAL]: 2,
    [ResourceType.FUEL]: 1,
  }),
})

describe("validateSubmittedActions", () => {
  it("should not mutate the turnState", () => {
    // Arrange
    const playerId = branded<PlayerId>("player-id")
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

    const originalTurnState = structuredClone(turnState)

    // Act
    validateSubmittedActions([submittedAction], ruleset, turnState)

    // Assert
    expect(turnState).toStrictEqual(originalTurnState)
  })

  it("should return no issues for a valid Action Submission", () => {
    // Arrange
    const playerId = branded<PlayerId>("player-id")
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
    const issues = validateSubmittedActions([submittedAction], ruleset, turnState)

    // Assert
    expect(issues).toStrictEqual([])
  })

  it("should collect target and cost issues from the complete validation pipeline", () => {
    // Arrange
    const playerId = branded<PlayerId>("player-id")
    const submittedAction = createSubmittedActionStub({
      actionDefinitionId: actionDefinition.id,
      playerId,
      selectedTargets: {
        fleet: "fleet-id",
      },
    })
    const turnState = createTurnStateStub({
      submittedActions: [submittedAction],
      players: {
        [playerId]: {
          id: playerId,
          resources: createResourcesStub({ [ResourceType.INFLUENCE]: 4 }),
        },
      },
    })

    // Act
    const issues = validateSubmittedActions([submittedAction], ruleset, turnState)

    // Assert
    expect(issues).toStrictEqual<typeof issues>([
      {
        issue: 'Unexpected target slot "fleet"',
        submittedActionId: submittedAction.id,
        actionDefinitionId: submittedAction.actionDefinitionId,
        actionDefinitionName: actionDefinition.name,
      },
      {
        issue: "Missing 1 INFLUENCE",
        submittedActionId: submittedAction.id,
        actionDefinitionId: submittedAction.actionDefinitionId,
        actionDefinitionName: actionDefinition.name,
      },
    ])
  })

  describe("action definition", () => {
    it("should report an Action Definition that does not exist in the Ruleset", () => {
      // Arrange
      const submittedAction = createSubmittedActionStub({ actionDefinitionId: "UNKNOWN_ACTION" })
      const emptyRuleset = createRulesetStub({ actionDefinitions: {} })
      const turnState = createTurnStateStub()

      // Act
      const issues = validateSubmittedActions([submittedAction], emptyRuleset, turnState)

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
  })

  describe("selectedTargets", () => {
    it("should report a target slot required by the Action Definition but missing from the submission", () => {
      // Arrange
      const playerId = branded<PlayerId>("player-id")
      const actionDefinitionWithRequiredTarget = createActionDefinitionStub({
        targets: {
          targetPlayer: TargetType.PLAYER,
        },
      })
      const rulesetWithRequiredTarget = createRulesetStub({
        actionDefinitions: {
          [actionDefinitionWithRequiredTarget.id]: actionDefinitionWithRequiredTarget,
        },
      })
      const submittedAction = createSubmittedActionStub({ actionDefinitionId: actionDefinitionWithRequiredTarget.id, playerId })
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
      const issues = validateSubmittedActions([submittedAction], rulesetWithRequiredTarget, turnState)

      // Assert
      expect(issues).toStrictEqual<typeof issues>([
        {
          issue: 'Missing target slot "targetPlayer"',
          submittedActionId: submittedAction.id,
          actionDefinitionId: submittedAction.actionDefinitionId,
          actionDefinitionName: actionDefinitionWithRequiredTarget.name,
        },
      ])
    })

    it("should report unexpected target slots", () => {
      // Arrange
      const playerId = branded<PlayerId>("player-id")
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
      const issues = validateSubmittedActions([submittedAction], ruleset, turnState)

      // Assert
      expect(issues).toStrictEqual<typeof issues>([
        {
          issue: 'Unexpected target slot "fleet"',
          submittedActionId: submittedAction.id,
          actionDefinitionId: submittedAction.actionDefinitionId,
          actionDefinitionName: actionDefinition.name,
        },
      ])
    })

    it("should report empty target slots", () => {
      // Arrange
      const playerId = branded<PlayerId>("player-id")
      const actionDefinitionWithPlanetTarget = createActionDefinitionStub({
        targets: {
          planet: TargetType.PLANET,
        },
        mechanics: [FleetBuildMechanic.create({ planetTag: "planet", strength: 1 })],
      })
      const rulesetWithPlanetTarget = createRulesetStub({
        actionDefinitions: {
          [actionDefinitionWithPlanetTarget.id]: actionDefinitionWithPlanetTarget,
        },
      })
      const submittedAction = createSubmittedActionStub({
        actionDefinitionId: actionDefinitionWithPlanetTarget.id,
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
      const issues = validateSubmittedActions([submittedAction], rulesetWithPlanetTarget, turnState)

      // Assert
      expect(issues).toStrictEqual<typeof issues>([
        {
          issue: 'Target slot "planet" must be set to a PLANET id',
          submittedActionId: submittedAction.id,
          actionDefinitionId: submittedAction.actionDefinitionId,
          actionDefinitionName: actionDefinitionWithPlanetTarget.name,
        },
      ])
    })
  })

  describe("costs", () => {
    it("should validate each player's costs against their own resources", () => {
      // Arrange
      const firstPlayerId = branded<PlayerId>("first-player-id")
      const secondPlayerId = branded<PlayerId>("second-player-id")
      const firstPlayerSubmittedAction = createSubmittedActionStub({ actionDefinitionId: actionDefinition.id, playerId: firstPlayerId })
      const secondPlayerSubmittedAction = createSubmittedActionStub({ actionDefinitionId: actionDefinition.id, playerId: secondPlayerId })
      const turnState = createTurnStateStub({
        submittedActions: [firstPlayerSubmittedAction, secondPlayerSubmittedAction],
        players: {
          [firstPlayerId]: {
            id: firstPlayerId,
            resources: createResourcesStub({ [ResourceType.INFLUENCE]: 5 }),
          },
          [secondPlayerId]: {
            id: secondPlayerId,
            resources: createResourcesStub({ [ResourceType.INFLUENCE]: 4 }),
          },
        },
      })

      // Act
      const issues = validateSubmittedActions([firstPlayerSubmittedAction, secondPlayerSubmittedAction], ruleset, turnState)

      // Assert
      expect(issues).toStrictEqual<typeof issues>([
        {
          issue: "Missing 1 INFLUENCE",
          submittedActionId: secondPlayerSubmittedAction.id,
          actionDefinitionId: secondPlayerSubmittedAction.actionDefinitionId,
          actionDefinitionName: actionDefinition.name,
        },
      ])
    })

    it("should aggregate costs for the same resource before reporting the shortage", () => {
      // Arrange
      const playerId = branded<PlayerId>("player-id")
      const actionDefinitionWithMultipleCosts = createActionDefinitionStub({
        costs: [
          ResourceLossMechanic.create({ quantity: 5, resourceType: ResourceType.INFLUENCE }),
          ResourceLossMechanic.create({ quantity: 5, resourceType: ResourceType.INFLUENCE }),
        ],
      })
      const rulesetWithMultipleCosts = createRulesetStub({
        actionDefinitions: {
          [actionDefinitionWithMultipleCosts.id]: actionDefinitionWithMultipleCosts,
        },
      })
      const submittedAction = createSubmittedActionStub({ actionDefinitionId: actionDefinitionWithMultipleCosts.id, playerId })
      const turnState = createTurnStateStub({
        submittedActions: [submittedAction],
        players: {
          [playerId]: {
            id: playerId,
            resources: createResourcesStub({ [ResourceType.INFLUENCE]: 7 }),
          },
        },
      })

      // Act
      const issues = validateSubmittedActions([submittedAction], rulesetWithMultipleCosts, turnState)

      // Assert
      expect(issues).toStrictEqual<typeof issues>([
        {
          issue: "Missing 3 INFLUENCE",
          submittedActionId: submittedAction.id,
          actionDefinitionId: submittedAction.actionDefinitionId,
          actionDefinitionName: actionDefinitionWithMultipleCosts.name,
        },
      ])
    })

    it("should return issues when the sum of the action costs can't be paid", () => {
      // Arrange
      const playerId = branded<PlayerId>("player-id")
      const actionDefinitionWithMultipleCosts = createActionDefinitionStub({
        costs: [
          ResourceLossMechanic.create({ quantity: 5, resourceType: ResourceType.INFLUENCE }),
          ResourceLossMechanic.create({ quantity: 5, resourceType: ResourceType.INFLUENCE }),
        ],
      })
      const rulesetWithMultipleCosts = createRulesetStub({
        actionDefinitions: {
          [actionDefinitionWithMultipleCosts.id]: actionDefinitionWithMultipleCosts,
        },
      })
      const submittedAction1 = createSubmittedActionStub({ actionDefinitionId: actionDefinitionWithMultipleCosts.id, playerId })
      const submittedAction2 = createSubmittedActionStub({ actionDefinitionId: actionDefinitionWithMultipleCosts.id, playerId })
      const turnState = createTurnStateStub({
        submittedActions: [submittedAction1, submittedAction2],
        players: {
          [playerId]: {
            id: playerId,
            resources: createResourcesStub({ [ResourceType.INFLUENCE]: 14 }),
          },
        },
      })

      // Act
      const issues = validateSubmittedActions([submittedAction1, submittedAction2], rulesetWithMultipleCosts, turnState)

      // Assert
      expect(issues).toStrictEqual<typeof issues>([
        {
          issue: "Missing 6 INFLUENCE",
          submittedActionId: submittedAction2.id,
          actionDefinitionId: submittedAction2.actionDefinitionId,
          actionDefinitionName: actionDefinitionWithMultipleCosts.name,
        },
      ])
    })

    it("should return issues where the sum of missing resources of each issue is the total missing resources", () => {
      // Arrange
      const playerId = branded<PlayerId>("player-id")
      const actionDefinitionWithMultipleCosts = createActionDefinitionStub({
        costs: [
          ResourceLossMechanic.create({ quantity: 5, resourceType: ResourceType.INFLUENCE }),
          ResourceLossMechanic.create({ quantity: 5, resourceType: ResourceType.INFLUENCE }),
        ],
      })
      const rulesetWithMultipleCosts = createRulesetStub({
        actionDefinitions: {
          [actionDefinitionWithMultipleCosts.id]: actionDefinitionWithMultipleCosts,
        },
      })
      const submittedAction1 = createSubmittedActionStub({ actionDefinitionId: actionDefinitionWithMultipleCosts.id, playerId })
      const submittedAction2 = createSubmittedActionStub({ actionDefinitionId: actionDefinitionWithMultipleCosts.id, playerId })
      const turnState = createTurnStateStub({
        submittedActions: [submittedAction1, submittedAction2],
        players: {
          [playerId]: {
            id: playerId,
            resources: createResourcesStub({ [ResourceType.INFLUENCE]: 7 }),
          },
        },
      })

      // Act
      const issues = validateSubmittedActions([submittedAction1, submittedAction2], rulesetWithMultipleCosts, turnState)

      // Assert
      expect(issues).toStrictEqual<typeof issues>([
        {
          issue: "Missing 3 INFLUENCE",
          submittedActionId: submittedAction1.id,
          actionDefinitionId: submittedAction1.actionDefinitionId,
          actionDefinitionName: actionDefinitionWithMultipleCosts.name,
        },
        {
          issue: "Missing 10 INFLUENCE",
          submittedActionId: submittedAction2.id,
          actionDefinitionId: submittedAction2.actionDefinitionId,
          actionDefinitionName: actionDefinitionWithMultipleCosts.name,
        },
      ])
    })
  })
})
