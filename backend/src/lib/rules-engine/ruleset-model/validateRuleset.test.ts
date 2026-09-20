import { branded } from "@guillaume-docquier/tools-ts"
import { describe, expect, it } from "vitest"
import { indexById } from "#lib/indexById.ts"
import { createActionDefinitionStub } from "#lib/rules-engine/ruleset-model/actions/ActionDefinition.stub.ts"
import { getEffectiveTargetConstraints } from "#lib/rules-engine/ruleset-model/actions/effectiveTargetConstraints.ts"
import { FleetBuildMechanic } from "#lib/rules-engine/ruleset-model/mechanics/implementations/FleetBuildMechanic.ts"
import { ResourceGainMechanic } from "#lib/rules-engine/ruleset-model/mechanics/implementations/ResourceGainMechanic.ts"
import { ResourceLossMechanic } from "#lib/rules-engine/ruleset-model/mechanics/implementations/ResourceLossMechanic.ts"
import { ResourceType } from "#lib/rules-engine/ruleset-model/mechanics/ResourceType.ts"
import { TargetType } from "#lib/rules-engine/ruleset-model/mechanics/TargetType.ts"
import { createRulesetStub } from "#lib/rules-engine/ruleset-model/Ruleset.stub.ts"
import { OwnedBySubmittingPlayerConstraint } from "#lib/rules-engine/ruleset-model/target-constraints/implementations/OwnedBySubmittingPlayerConstraint.ts"
import { validateRuleset } from "#lib/rules-engine/ruleset-model/validateRuleset.ts"

const validActionDefinition = createActionDefinitionStub({
  id: "VALID_ACTION",
  name: "Valid Action",
  costs: [
    ResourceLossMechanic.create({
      quantity: 2,
      resourceType: ResourceType.INFLUENCE,
    }),
  ],
  mechanics: [
    ResourceGainMechanic.create({
      quantity: 5,
      resourceType: ResourceType.INFLUENCE,
    }),
  ],
})

describe("validateRuleset", () => {
  it("should validate a Ruleset with correctly indexed Action Definitions and all required target slots", () => {
    // Arrange
    const ruleset = createRulesetStub({
      actionDefinitions: indexById([validActionDefinition]),
    })

    // Act
    const validationIssues = validateRuleset(ruleset)

    // Assert
    expect(validationIssues).toStrictEqual([])
  })

  it("should report an Action Definition indexed under an id other than its own", () => {
    // Arrange
    const ruleset = createRulesetStub({
      actionDefinitions: { "incorrect-index": validActionDefinition },
    })

    // Act
    const validationIssues = validateRuleset(ruleset)

    // Assert
    expect(validationIssues).toStrictEqual<typeof validationIssues>([
      {
        issue: `Action Definition ${validActionDefinition.name} is indexed under incorrect-index instead of ${validActionDefinition.id}`,
      },
    ])
  })

  it("should report a target slot required by a Mechanic but missing from its Action Definition", () => {
    // Arrange
    const actionDefinition = createActionDefinitionStub({
      mechanics: [FleetBuildMechanic.create({ planetTag: "planet", strength: 1 })],
    })
    const ruleset = createRulesetStub({
      actionDefinitions: indexById([actionDefinition]),
    })

    // Act
    const validationIssues = validateRuleset(ruleset)

    // Assert
    expect(validationIssues).toStrictEqual<typeof validationIssues>([
      {
        issue: `Action Definition "${actionDefinition.name}" is missing target slot "planet" required by the "${FleetBuildMechanic.type}" mechanic`,
      },
    ])
  })

  it("should report an Action Definition target slot with an incompatible type", () => {
    // Arrange
    const actionDefinition = createActionDefinitionStub({
      targets: { planet: { type: TargetType.FLEET, constraints: [] } },
      mechanics: [FleetBuildMechanic.create({ planetTag: "planet", strength: 1 })],
    })
    const ruleset = createRulesetStub({
      actionDefinitions: indexById([actionDefinition]),
    })

    // Act
    const validationIssues = validateRuleset(ruleset)

    // Assert
    expect(validationIssues).toStrictEqual<typeof validationIssues>([
      {
        issue: `Action Definition "${actionDefinition.name}" target slot "planet" has type "FLEET", but the "FLEET_BUILD" mechanic requires "PLANET"`,
      },
    ])
  })

  it.each([0, -1])("should report a non-positive fleet strength", (strength) => {
    // Arrange
    const ruleset = createRulesetStub({
      actionDefinitions: indexById([
        createActionDefinitionStub({
          targets: {
            planet: { type: TargetType.PLANET, constraints: [] },
          },
          mechanics: [
            {
              type: FleetBuildMechanic.type,
              targets: {
                planet: {
                  tag: "planet",
                  type: TargetType.PLANET,
                  constraints: [],
                },
              },
              parameters: {
                // intentionally using `branded` and hand rolled json instead of the mechanic factory because the factory validates the payload
                // right now it makes no sense, but later on we'll parse raw json too
                strength: branded(strength),
              },
            },
          ],
        }),
      ]),
    })

    // Act
    const validationIssues = validateRuleset(ruleset)

    // Assert
    expect(validationIssues).toStrictEqual<typeof validationIssues>([
      { issue: expect.stringContaining("Too small: expected number to be >0") },
    ])
    expect(validationIssues).toStrictEqual<typeof validationIssues>([
      { issue: expect.stringContaining("at actionDefinitions.TEST_ACTION.mechanics[0].parameters.strength") },
    ])
  })

  it("should accept OWNED_BY_SUBMITTING_PLAYER for PLANET and FLEET target slots", () => {
    // Arrange
    const constraint = OwnedBySubmittingPlayerConstraint.create()
    const planetAction = createActionDefinitionStub({
      id: "PLANET_ACTION",
      targets: {
        planet: { type: TargetType.PLANET, constraints: [constraint] },
      },
    })
    const fleetAction = createActionDefinitionStub({
      id: "FLEET_ACTION",
      targets: {
        fleet: { type: TargetType.FLEET, constraints: [constraint] },
      },
    })
    const ruleset = createRulesetStub({
      actionDefinitions: indexById([planetAction, fleetAction]),
    })

    // Act
    const validationIssues = validateRuleset(ruleset)

    // Assert
    expect(validationIssues).toStrictEqual([])
  })

  it("should reject OWNED_BY_SUBMITTING_PLAYER for PLAYER target slots", () => {
    // Arrange
    const actionDefinition = createActionDefinitionStub({
      targets: {
        player: {
          type: TargetType.PLAYER,
          constraints: [OwnedBySubmittingPlayerConstraint.create()],
        },
      },
    })
    const ruleset = createRulesetStub({
      actionDefinitions: indexById([actionDefinition]),
    })

    // Act
    const validationIssues = validateRuleset(ruleset)

    // Assert
    expect(validationIssues).toStrictEqual([
      {
        issue:
          'Action Definition "Test Action" target slot "player" has unsupported constraint "OWNED_BY_SUBMITTING_PLAYER" for target type "PLAYER"',
      },
    ])
  })

  it("should inherit mechanic constraints through effective composition", () => {
    // Arrange
    const mechanic = FleetBuildMechanic.create({ planetTag: "planet", strength: 1 })
    const constraint = OwnedBySubmittingPlayerConstraint.create()
    const constrainedMechanic = {
      ...mechanic,
      targets: {
        planet: {
          ...mechanic.targets.planet,
          constraints: [constraint],
        },
      },
    }
    const actionDefinition = createActionDefinitionStub({
      targets: {
        planet: { type: TargetType.PLANET, constraints: [] },
      },
      mechanics: [constrainedMechanic],
    })
    const ruleset = createRulesetStub({
      actionDefinitions: indexById([actionDefinition]),
    })

    // Act
    const validationIssues = validateRuleset(ruleset)
    const effectiveConstraints = getEffectiveTargetConstraints(actionDefinition, "planet")

    // Assert
    expect(validationIssues).toStrictEqual([])
    expect(effectiveConstraints).toStrictEqual([constraint])
  })

  it("should reject unknown or malformed target constraints at the Ruleset boundary", () => {
    // Arrange
    const actionDefinition = createActionDefinitionStub({
      targets: {
        player: { type: TargetType.PLAYER, constraints: [] },
      },
    })
    Object.assign(actionDefinition.targets, {
      player: {
        type: TargetType.PLAYER,
        constraints: [{ type: "UNKNOWN", references: {}, parameters: {} }],
      },
    })
    const ruleset = createRulesetStub({
      actionDefinitions: indexById([actionDefinition]),
    })

    // Act
    const validationIssues = validateRuleset(ruleset)

    // Assert
    expect(validationIssues).toStrictEqual([{ issue: expect.stringContaining("Invalid discriminator value") }])
  })

  it("should collect mechanic constraints before additive action constraints and preserve duplicates", () => {
    // Arrange
    const constraint = OwnedBySubmittingPlayerConstraint.create()
    const firstMechanic = FleetBuildMechanic.create({ planetTag: "planet", strength: 1 })
    const secondMechanic = FleetBuildMechanic.create({ planetTag: "planet", strength: 2 })
    const actionDefinition = createActionDefinitionStub({
      targets: {
        planet: { type: TargetType.PLANET, constraints: [constraint] },
      },
      mechanics: [
        {
          ...firstMechanic,
          targets: {
            planet: { ...firstMechanic.targets.planet, constraints: [constraint] },
          },
        },
        {
          ...secondMechanic,
          targets: {
            planet: { ...secondMechanic.targets.planet, constraints: [constraint] },
          },
        },
      ],
    })

    // Act
    const effectiveConstraints = getEffectiveTargetConstraints(actionDefinition, "planet")

    // Assert
    expect(effectiveConstraints).toStrictEqual([constraint, constraint, constraint])
  })
})
