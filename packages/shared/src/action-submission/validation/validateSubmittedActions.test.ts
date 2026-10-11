import { branded } from "@guillaume-docquier/tools-ts"
import { describe, expect, it } from "vitest"
import { createFleetEligibilityScenario } from "#shared/action-submission/actionEligibility.stub.ts"
import { validateSubmittedActions } from "#shared/action-submission/validation/validateSubmittedActions.ts"
import type { PlayerId } from "#shared/domain/players/PlayerId.ts"
import { createActionDefinitionStub } from "#shared/domain/ruleset/action-definitions/ActionDefinition.stub.ts"
import { createRulesetStub } from "#shared/domain/ruleset/Ruleset.stub.ts"
import { Ruleset } from "#shared/domain/ruleset/Ruleset.ts"
import { OwnedBySubmittingPlayerConstraint } from "#shared/domain/ruleset/target-definitions/OwnedBySubmittingPlayerTargetConstraint.ts"
import { createSubmittedActionStub } from "#shared/domain/turns/actions/Action.stub.ts"
import { createTurnStateStub } from "#shared/turn-resolution/TurnState.stub.ts"

describe("validateSubmittedActions", () => {
  it("should retain all independent prerequisite failures", () => {
    // Arrange
    const submittedAction = createSubmittedActionStub({ actionDefinitionId: "UNKNOWN_ACTION" })
    const ruleset = createRulesetStub({ actionDefinitions: {} })
    const turnState = createTurnStateStub()

    // Act
    const issues = validateSubmittedActions([submittedAction], ruleset, turnState)

    // Assert
    expect(issues).toStrictEqual<typeof issues>([
      {
        issue: "Unknown Action Definition",
        submittedActionId: submittedAction.id,
        actionDefinitionId: submittedAction.actionDefinitionId,
        actionDefinitionName: undefined,
      },
      ...["Unknown player", "Invalid action instance or definition binding"].map((issue) => ({
        issue,
        submittedActionId: submittedAction.id,
        actionDefinitionId: submittedAction.actionDefinitionId,
        actionDefinitionName: undefined,
      })),
    ])
  })
})

// Preserve baseline non-movement target coverage after removing the separate validator modules.
describe("complete target validation through the retained public entrypoint", () => {
  it.each([
    { name: "missing player", targets: { location: "origin" }, message: "Choose a target" },
    {
      name: "empty planet",
      targets: { location: "", recipient: "00000000-0000-4000-8000-000000000001" },
      message: "Unknown PLANET target",
    },
    {
      name: "wrong type",
      targets: { location: "source", recipient: "00000000-0000-4000-8000-000000000001" },
      message: "Unknown PLANET target",
    },
    {
      name: "unexpected tag",
      targets: { location: "origin", recipient: "00000000-0000-4000-8000-000000000001", extra: "20" },
      message: "Unexpected target",
    },
  ])("should retain a useful issue for $name selections", ({ targets, message }) => {
    // Arrange
    const fixture = createFleetEligibilityScenario()
    const definition = createActionDefinitionStub({
      ...fixture.definition,
      effects: [],
      costs: [],
      inputs: {},
      targets: {
        location: { targetType: "PLANET", constraints: [OwnedBySubmittingPlayerConstraint.create()] },
        recipient: { targetType: "PLAYER", constraints: [] },
      },
    })
    const ruleset = Ruleset.create({ ...fixture.ruleset, actionDefinitions: { [definition.id]: definition } })
    const action = createSubmittedActionStub({
      id: "X",
      playerId: fixture.playerId,
      actionDefinitionId: definition.id,
      selectedTargets: targets,
    })
    // Act
    const issues = validateSubmittedActions([action], ruleset, fixture.state)
    // Assert
    expect(issues).toStrictEqual([
      { issue: message, submittedActionId: "X", actionDefinitionId: "RENAMED", actionDefinitionName: "Traverse" },
    ])
  })

  it.each([
    { name: "owned", owner: branded<PlayerId>("00000000-0000-4000-8000-000000000001"), expected: [] },
    {
      name: "enemy",
      owner: branded<PlayerId>("enemy"),
      expected: [
        {
          issue: "Target must be owned by submitting player",
          submittedActionId: "X",
          actionDefinitionId: "RENAMED",
          actionDefinitionName: "Traverse",
        },
      ],
    },
    {
      name: "unclaimed",
      owner: null,
      expected: [
        {
          issue: "Target must be owned by submitting player",
          submittedActionId: "X",
          actionDefinitionId: "RENAMED",
          actionDefinitionName: "Traverse",
        },
      ],
    },
  ])("should evaluate $name planet ownership without a movement effect", ({ owner, expected }) => {
    // Arrange
    const fixture = createFleetEligibilityScenario()
    const definition = createActionDefinitionStub({
      ...fixture.definition,
      effects: [],
      costs: [],
      inputs: {},
      targets: { location: { targetType: "PLANET", constraints: [OwnedBySubmittingPlayerConstraint.create()] } },
    })
    const ruleset = Ruleset.create({ ...fixture.ruleset, actionDefinitions: { [definition.id]: definition } })
    const planet = { ...fixture.origin, ownerPlayerId: owner }
    const state = { ...fixture.state, planets: { ...fixture.state.planets, [planet.id]: planet } }
    const action = createSubmittedActionStub({
      id: "X",
      playerId: fixture.playerId,
      actionDefinitionId: definition.id,
      selectedTargets: { location: "origin" },
    })
    // Act
    const issues = validateSubmittedActions([action], ruleset, state)
    // Assert
    expect(issues).toStrictEqual(expected)
  })
})
