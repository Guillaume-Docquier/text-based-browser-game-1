import { Assert, branded, type DeepUnbranded, indexBy, Result } from "@guillaume-docquier/tools-ts"
import { describe, expect, it } from "vitest"
import { createResourcesStub } from "#shared/domain/resources/Resources.stub.ts"
import { ResourceType } from "#shared/domain/resources/ResourceType.ts"
import { createActionDefinitionStub } from "#shared/domain/ruleset/action-definitions/ActionDefinition.stub.ts"
import { ActionDefinitionSchema, type ActionDefinition } from "#shared/domain/ruleset/action-definitions/ActionDefinition.ts"
import type { TargetTag } from "#shared/domain/ruleset/action-definitions/TargetTag.ts"
import { FleetAssaultEffectDefinition } from "#shared/domain/ruleset/effect-definitions/FleetAssaultEffectDefinition.ts"
import { FleetBuildEffectDefinition } from "#shared/domain/ruleset/effect-definitions/FleetBuildEffectDefinition.ts"
import { FleetColonizeEffectDefinition } from "#shared/domain/ruleset/effect-definitions/FleetColonizeEffectDefinition.ts"
import { FleetMoveEffectDefinition } from "#shared/domain/ruleset/effect-definitions/FleetMoveEffectDefinition.ts"
import { ResourceGainEffectDefinition } from "#shared/domain/ruleset/effect-definitions/ResourceGainEffectDefinition.ts"
import { ResourceLossEffectDefinition } from "#shared/domain/ruleset/effect-definitions/ResourceLossEffectDefinition.ts"
import { Ruleset } from "#shared/domain/ruleset/Ruleset.ts"
import { AtFleetPlanetConstraint } from "#shared/domain/ruleset/target-definitions/AtFleetPlanetTargetConstraint.ts"
import { DifferentFromFleetOriginConstraint } from "#shared/domain/ruleset/target-definitions/DifferentFromFleetOriginTargetConstraint.ts"
import { OwnedBySubmittingPlayerConstraint } from "#shared/domain/ruleset/target-definitions/OwnedBySubmittingPlayerTargetConstraint.ts"
import { StationaryFleetConstraint } from "#shared/domain/ruleset/target-definitions/StationaryFleetTargetConstraint.ts"
import { TargetType } from "#shared/domain/ruleset/target-definitions/TargetType.ts"
import { UnclaimedPlanetConstraint } from "#shared/domain/ruleset/target-definitions/UnclaimedPlanetTargetConstraint.ts"
import { WithinFleetRangeConstraint } from "#shared/domain/ruleset/target-definitions/WithinFleetRangeTargetConstraint.ts"
import { ColonizeHereTest, ColonizePlanetTest } from "#shared/testing/test-ruleset/action-definitions/colonize.ts"
import { MoveFleetStandard } from "#shared/testing/test-ruleset/action-definitions/move-fleet.ts"

const validActionDefinition = createActionDefinitionStub({
  id: "VALID_ACTION",
  name: "Valid Action",
  costs: [
    ResourceLossEffectDefinition.create({
      quantity: 2,
      resourceType: ResourceType.INFLUENCE,
    }),
  ],
  effects: [
    ResourceGainEffectDefinition.create({
      quantity: 5,
      resourceType: ResourceType.INFLUENCE,
    }),
  ],
})

describe("Ruleset.safeCreate", () => {
  it("should validate a Ruleset with correctly indexed Action Definitions and all required target slots", () => {
    // Arrange
    const ruleset: DeepUnbranded<Ruleset> = {
      id: "test-ruleset",
      name: "Test Ruleset",
      isDefault: false,
      actionDefinitions: indexBy("id", [validActionDefinition]),
      actionPool: [{ id: "VALID_ACTION_1", actionDefinitionId: validActionDefinition.id }],
      startingResources: createResourcesStub(),
    }

    // Act
    const result = Ruleset.safeCreate(ruleset)

    // Assert
    expect(result).toStrictEqual(Result.Success(ruleset))
  })

  it("should report an Action Definition indexed under an id other than its own", () => {
    // Arrange
    const ruleset: DeepUnbranded<Ruleset> = {
      id: "test-ruleset",
      name: "Test Ruleset",
      isDefault: false,
      actionDefinitions: { "incorrect-index": validActionDefinition },
      actionPool: [],
      startingResources: createResourcesStub(),
    }

    // Act
    const result = Ruleset.safeCreate(ruleset)

    // Assert
    expect(result).toStrictEqual(
      Result.Failure([
        `Action Definition ${validActionDefinition.name} is indexed under incorrect-index instead of ${validActionDefinition.id}`,
      ]),
    )
  })

  it("should report a target slot required by a EffectDefinition but missing from its Action Definition", () => {
    // Arrange
    const actionDefinition: DeepUnbranded<ActionDefinition> = {
      ...validActionDefinition,
      effects: [FleetBuildEffectDefinition.create({ planetTag: "planet", strength: 1 })],
    }
    const ruleset: DeepUnbranded<Ruleset> = {
      id: "test-ruleset",
      name: "Test Ruleset",
      isDefault: false,
      actionDefinitions: indexBy("id", [actionDefinition]),
      actionPool: [],
      startingResources: createResourcesStub(),
    }

    // Act
    const result = Ruleset.safeCreate(ruleset)

    // Assert
    expect(result).toStrictEqual(
      Result.Failure([
        `Action Definition "${actionDefinition.name}" is missing target slot tagged "planet" required by the "${FleetBuildEffectDefinition.type}" effect definition`,
      ]),
    )
  })

  it("should report an Action Definition target slot with an incompatible type", () => {
    // Arrange
    const actionDefinition: DeepUnbranded<ActionDefinition> = {
      ...validActionDefinition,
      targets: { planet: { targetType: TargetType.FLEET, constraints: [] } },
      effects: [FleetBuildEffectDefinition.create({ planetTag: "planet", strength: 1 })],
    }
    const ruleset: DeepUnbranded<Ruleset> = {
      id: "test-ruleset",
      name: "Test Ruleset",
      isDefault: false,
      actionDefinitions: indexBy("id", [actionDefinition]),
      actionPool: [],
      startingResources: createResourcesStub(),
    }

    // Act
    const result = Ruleset.safeCreate(ruleset)

    // Assert
    expect(result).toStrictEqual(
      Result.Failure([
        `Action Definition "${actionDefinition.name}" target slot tagged "planet" has type "FLEET", but the "FLEET_BUILD" effect definition requires "PLANET"`,
      ]),
    )
  })

  it.each([0, -1])("should report a non-positive fleet strength", (invalidStrength) => {
    // Arrange
    const actionDefinition: DeepUnbranded<ActionDefinition> = {
      ...validActionDefinition,
      id: "TEST_ACTION",
      targets: {
        planet: { targetType: TargetType.PLANET, constraints: [] },
      },
      effects: [
        {
          type: FleetBuildEffectDefinition.type,
          targets: {
            planet: {
              actionTargetTag: "planet",
              targetType: TargetType.PLANET,
            },
          },
          parameters: {
            strength: invalidStrength,
          },
        },
      ],
    }
    const ruleset: DeepUnbranded<Ruleset> = {
      id: "test-ruleset",
      name: "Test Ruleset",
      isDefault: false,
      actionDefinitions: indexBy("id", [actionDefinition]),
      actionPool: [],
      startingResources: createResourcesStub(),
    }

    // Act
    const result = Ruleset.safeCreate(ruleset)

    // Assert
    expect(result).toStrictEqual(Result.Failure([expect.stringContaining("Too small: expected number to be >0")]))
    expect(result).toStrictEqual(
      Result.Failure([expect.stringContaining("at actionDefinitions.TEST_ACTION.effects[0].parameters.strength")]),
    )
  })

  it("should accept arbitrary movement role tags, a gain composition, and multiple instances of the same definition", () => {
    // Arrange
    const movementWithRenamedRoles: DeepUnbranded<ActionDefinition> = {
      ...MoveFleetStandard,
      id: "RENAMED_MOVEMENT_WITH_GAIN",
      name: "Renamed movement with gain",
      inputs: { units: { type: "POSITIVE_INTEGER", label: "Units" } },
      targets: {
        originForce: {
          targetType: TargetType.FLEET,
          constraints: [OwnedBySubmittingPlayerConstraint.create(), StationaryFleetConstraint.create()],
        },
        landingSite: {
          targetType: TargetType.PLANET,
          constraints: [
            WithinFleetRangeConstraint.create({ sourceFleetTag: "originForce", maxDistance: 5 }),
            DifferentFromFleetOriginConstraint.create({ sourceFleetTag: "originForce" }),
          ],
        },
      },
      effects: [
        FleetMoveEffectDefinition.create({ fleetTag: "originForce", planetTag: "landingSite", strengthTag: "units", speed: 0.1 }),
        ResourceGainEffectDefinition.create({ quantity: 2, resourceType: ResourceType.INFLUENCE }),
      ],
    }

    // Act
    const result = safeCreateRulesetWithAction(movementWithRenamedRoles, [
      { id: "RENAMED_MOVEMENT_1", actionDefinitionId: movementWithRenamedRoles.id },
      { id: "RENAMED_MOVEMENT_2", actionDefinitionId: movementWithRenamedRoles.id },
    ])

    // Assert
    const expectedRuleset = Ruleset.create({
      id: "test-movement-ruleset",
      name: "Test Movement Ruleset",
      isDefault: false,
      actionDefinitions: { [movementWithRenamedRoles.id]: movementWithRenamedRoles },
      actionPool: [
        { id: "RENAMED_MOVEMENT_1", actionDefinitionId: movementWithRenamedRoles.id },
        { id: "RENAMED_MOVEMENT_2", actionDefinitionId: movementWithRenamedRoles.id },
      ],
      startingResources: createResourcesStub(),
    })
    expect(result).toStrictEqual(Result.Success(expectedRuleset))
  })

  it("should reject missing or invalid movement role mappings and unused input controls", () => {
    // Arrange
    const movementEffect = FleetMoveEffectDefinition.create({ fleetTag: "fleet", planetTag: "planet", strengthTag: "strength", speed: 1 })

    const missingForceInput: DeepUnbranded<ActionDefinition> = {
      ...MoveFleetStandard,
      id: "MISSING_FORCE_INPUT",
      inputs: {},
    }
    const unusedInput: DeepUnbranded<ActionDefinition> = {
      ...MoveFleetStandard,
      id: "UNUSED_INPUT",
      inputs: {
        ...MoveFleetStandard.inputs,
        bonusUnits: { type: "POSITIVE_INTEGER", label: "Bonus units" },
      },
    }
    const unknownFleetRole: DeepUnbranded<ActionDefinition> = {
      ...MoveFleetStandard,
      id: "UNKNOWN_FLEET_ROLE",
      effects: [
        {
          ...movementEffect,
          targets: {
            fleet: { actionTargetTag: "unknownFleet", targetType: TargetType.FLEET },
            planet: movementEffect.targets.planet,
          },
        },
      ],
    }

    const invalidDefinitions = [
      [missingForceInput, "is missing input slot"],
      [unusedInput, "is not used by an Effect Definition"],
      [unknownFleetRole, "is missing target slot tagged"],
    ] as const

    // Act
    const results = invalidDefinitions.map(([actionDefinition]) => safeCreateRulesetWithAction(actionDefinition))

    // Assert
    for (const [index, [, message]] of invalidDefinitions.entries()) {
      expect(results[index]).toStrictEqual(Result.Failure(expect.arrayContaining([expect.stringContaining(message)])))
    }
  })

  it("should reject movement mappings missing ownership, stationary, range, no-op, or Fleet-reference constraints", () => {
    // Arrange
    const missingOwnership: DeepUnbranded<ActionDefinition> = {
      ...MoveFleetStandard,
      id: "MISSING_MOVE_OWNERSHIP",
      targets: {
        fleet: { targetType: TargetType.FLEET, constraints: [StationaryFleetConstraint.create()] },
      },
    }
    const missingStationary: DeepUnbranded<ActionDefinition> = {
      ...MoveFleetStandard,
      id: "MISSING_STATIONARY_REQUIREMENT",
      targets: {
        fleet: { targetType: TargetType.FLEET, constraints: [OwnedBySubmittingPlayerConstraint.create()] },
      },
    }
    const missingRange: DeepUnbranded<ActionDefinition> = {
      ...MoveFleetStandard,
      id: "MISSING_MOVE_RANGE",
      targets: {
        planet: {
          targetType: TargetType.PLANET,
          constraints: [DifferentFromFleetOriginConstraint.create({ sourceFleetTag: "fleet" })],
        },
      },
    }
    const missingDifferentOrigin: DeepUnbranded<ActionDefinition> = {
      ...MoveFleetStandard,
      id: "MISSING_DIFFERENT_ORIGIN",
      targets: {
        planet: {
          targetType: TargetType.PLANET,
          constraints: [WithinFleetRangeConstraint.create({ sourceFleetTag: "fleet", maxDistance: 5 })],
        },
      },
    }
    const missingSourceReference: DeepUnbranded<ActionDefinition> = {
      ...MoveFleetStandard,
      id: "MISSING_FLEET_REFERENCE",
      targets: {
        planet: {
          targetType: TargetType.PLANET,
          constraints: [
            WithinFleetRangeConstraint.create({ sourceFleetTag: "absentFleet", maxDistance: 5 }),
            DifferentFromFleetOriginConstraint.create({ sourceFleetTag: "absentFleet" }),
          ],
        },
      },
    }
    const wrongTypeSourceReference: DeepUnbranded<ActionDefinition> = {
      ...MoveFleetStandard,
      id: "WRONG_TYPE_FLEET_REFERENCE",
      targets: {
        planet: {
          targetType: TargetType.PLANET,
          constraints: [
            WithinFleetRangeConstraint.create({ sourceFleetTag: "planet", maxDistance: 5 }),
            DifferentFromFleetOriginConstraint.create({ sourceFleetTag: "planet" }),
          ],
        },
      },
    }
    const unsupportedSourceConstraint: DeepUnbranded<ActionDefinition> = {
      ...MoveFleetStandard,
      id: "UNSUPPORTED_FLEET_CONSTRAINT",
      targets: {
        fleet: {
          targetType: TargetType.FLEET,
          constraints: [
            OwnedBySubmittingPlayerConstraint.create(),
            StationaryFleetConstraint.create(),
            WithinFleetRangeConstraint.create({ sourceFleetTag: "fleet", maxDistance: 5 }),
          ],
        },
      },
    }
    const invalidMappings = [
      [missingOwnership, "must require ownership by the submitting player"],
      [missingStationary, "must require a stationary Fleet"],
      [missingRange, 'must constrain range from Fleet slot "fleet"'],
      [missingDifferentOrigin, 'must differ from Fleet slot "fleet" origin'],
      [missingSourceReference, 'references missing source Fleet slot "absentFleet"'],
      [wrongTypeSourceReference, 'source slot "planet" must be a FLEET target'],
      [unsupportedSourceConstraint, 'does not support target type "FLEET"'],
    ] as const

    // Act
    const results = invalidMappings.map(([actionDefinition]) => safeCreateRulesetWithAction(actionDefinition))

    // Assert
    for (const [index, [, expectedIssue]] of invalidMappings.entries()) {
      expect(results[index]).toStrictEqual(Result.Failure(expect.arrayContaining([expect.stringContaining(expectedIssue)])))
    }
  })

  it("should reject invalid movement speed and range and more than one movement effect", () => {
    // Arrange
    const movementEffect = FleetMoveEffectDefinition.create({ fleetTag: "fleet", planetTag: "planet", strengthTag: "strength", speed: 1 })

    const invalidSpeed: DeepUnbranded<ActionDefinition> = {
      ...MoveFleetStandard,
      id: "INVALID_SPEED",
      effects: [{ ...movementEffect, parameters: { speed: Number.POSITIVE_INFINITY } }],
    }
    const invalidRange: DeepUnbranded<ActionDefinition> = {
      ...MoveFleetStandard,
      id: "INVALID_RANGE",
      targets: {
        ...MoveFleetStandard.targets,
        planet: {
          targetType: TargetType.PLANET,
          constraints: [
            { type: "WITHIN_FLEET_RANGE", references: { sourceFleetTag: "fleet" }, parameters: { maxDistance: 0 } },
            { type: "DIFFERENT_FROM_FLEET_ORIGIN", references: { sourceFleetTag: "fleet" }, parameters: {} },
          ],
        },
      },
    }
    const multipleMovementEffects: DeepUnbranded<ActionDefinition> = {
      ...MoveFleetStandard,
      id: "MULTIPLE_MOVEMENT_EFFECTS",
      effects: [movementEffect, movementEffect],
    }

    // Act
    const invalidSpeedResult = safeCreateRulesetWithAction(invalidSpeed)
    const invalidRangeResult = safeCreateRulesetWithAction(invalidRange)
    const multipleEffectResult = safeCreateRulesetWithAction(multipleMovementEffects)

    // Assert
    expect(invalidSpeedResult).toStrictEqual(
      Result.Failure([expect.stringContaining("at actionDefinitions.INVALID_SPEED.effects[0].parameters.speed")]),
    )
    expect(invalidRangeResult).toStrictEqual(
      Result.Failure([expect.stringContaining("at actionDefinitions.INVALID_RANGE.targets.planet.constraints[0].parameters.maxDistance")]),
    )
    expect(multipleEffectResult).toStrictEqual(
      Result.Failure([
        expect.stringContaining(`Action Definition "${multipleMovementEffects.name}" may contain only one FLEET_MOVE effect`),
      ]),
    )
  })

  it.each([0, -1, 1.5, Number.POSITIVE_INFINITY])(
    "should reject an invalid Colonize strength requirement at its parameter field",
    (strengthRequirement) => {
      const effect = ColonizeHereTest.effects[0]
      Assert.isDefined(effect)
      const invalidAction = {
        ...ColonizeHereTest,
        id: "INVALID_COLONIZE_STRENGTH",
        effects: [{ ...effect, parameters: { strengthRequirement } }],
      }

      expectActionIssue(invalidAction, ["effects", 0, "parameters", "strengthRequirement"])
    },
  )

  it("should reject missing, mismatched, or incorrectly typed Colonize role mappings at their effect fields", () => {
    const effect = ColonizeHereTest.effects.find(isColonizeEffect)
    Assert.isDefined(effect)
    const missingFleetSlot = {
      ...ColonizeHereTest,
      effects: [
        {
          ...effect,
          targets: { ...effect.targets, fleet: { ...effect.targets.fleet, actionTargetTag: "missingFleet" } },
        },
      ],
    }
    const missingPlanetSlot = {
      ...ColonizeHereTest,
      effects: [
        {
          ...effect,
          targets: { ...effect.targets, planet: { ...effect.targets.planet, actionTargetTag: "missingPlanet" } },
        },
      ],
    }
    const wrongFleetSlot = {
      ...ColonizeHereTest,
      effects: [
        {
          ...effect,
          targets: { ...effect.targets, fleet: { ...effect.targets.fleet, actionTargetTag: "planet" } },
        },
      ],
    }
    const wrongFleetType = {
      ...ColonizeHereTest,
      effects: [
        {
          ...effect,
          targets: { ...effect.targets, fleet: { ...effect.targets.fleet, targetType: TargetType.PLANET } },
        },
      ],
    }

    expectActionIssue(missingFleetSlot, ["effects", 0, "targets", "fleet"], 'missing target slot tagged "missingFleet"')
    expectActionIssue(missingPlanetSlot, ["effects", 0, "targets", "planet"], 'missing target slot tagged "missingPlanet"')
    expectActionIssue(wrongFleetSlot, ["effects", 0, "targets", "fleet"], 'target slot tagged "planet" has type "PLANET"')
    expectActionIssue(wrongFleetType, ["effects", 0, "targets", "fleet", "targetType"])
  })

  it("should require owned stationary source, unclaimed destination, and the selected Fleet's current Planet", () => {
    const fleetTag = branded<TargetTag>("fleet")
    const planetTag = branded<TargetTag>("planet")
    const fleetTarget = ColonizeHereTest.targets[fleetTag]
    const planetTarget = ColonizeHereTest.targets[planetTag]
    Assert.isDefined(fleetTarget)
    Assert.isDefined(planetTarget)
    const missingOwnership = {
      ...ColonizeHereTest,
      targets: {
        ...ColonizeHereTest.targets,
        [fleetTag]: {
          ...fleetTarget,
          constraints: fleetTarget.constraints.filter((constraint) => constraint.type !== OwnedBySubmittingPlayerConstraint.type),
        },
      },
    }
    const missingStationary = {
      ...ColonizeHereTest,
      targets: {
        ...ColonizeHereTest.targets,
        [fleetTag]: {
          ...fleetTarget,
          constraints: fleetTarget.constraints.filter((constraint) => constraint.type !== StationaryFleetConstraint.type),
        },
      },
    }
    const missingUnclaimed = {
      ...ColonizeHereTest,
      targets: {
        ...ColonizeHereTest.targets,
        [planetTag]: {
          ...planetTarget,
          constraints: planetTarget.constraints.filter((constraint) => constraint.type !== UnclaimedPlanetConstraint.type),
        },
      },
    }
    const missingAtFleetPlanet = {
      ...ColonizeHereTest,
      targets: {
        ...ColonizeHereTest.targets,
        [planetTag]: {
          ...planetTarget,
          constraints: planetTarget.constraints.filter((constraint) => constraint.type !== AtFleetPlanetConstraint.type),
        },
      },
    }

    expect(ActionDefinitionSchema.safeParse(missingOwnership).success).toBe(false)
    expect(ActionDefinitionSchema.safeParse(missingStationary).success).toBe(false)
    expect(ActionDefinitionSchema.safeParse(missingUnclaimed).success).toBe(false)
    expect(ActionDefinitionSchema.safeParse(missingAtFleetPlanet).success).toBe(false)
    expectActionIssue(missingOwnership, ["effects", 0, "targets", "fleet"], "must require ownership by the submitting player")
    expectActionIssue(missingStationary, ["effects", 0, "targets", "fleet"], "must require a stationary Fleet")
    expectActionIssue(missingUnclaimed, ["targets", "planet"], "must require an unclaimed Planet")
    expectActionIssue(missingAtFleetPlanet, ["targets", "planet"], "must require the selected Fleet's stationary Planet")
  })

  it("should retain the original Move effect index after a Colonize effect", () => {
    const colonizeEffect = ColonizePlanetTest.effects.find((effect) => effect.type === FleetColonizeEffectDefinition.type)
    const movementEffect = ColonizePlanetTest.effects.find((effect) => effect.type === "FLEET_MOVE")
    Assert.isDefined(colonizeEffect)
    Assert.isDefined(movementEffect)
    const invalidAction = {
      ...ColonizePlanetTest,
      id: "COLONIZE_BEFORE_MOVE_MISSING_STRENGTH",
      inputs: {},
      effects: [
        colonizeEffect,
        {
          ...movementEffect,
          inputs: { ...movementEffect.inputs, strength: { ...movementEffect.inputs.strength, actionInputTag: "missingStrength" } },
        },
      ],
    }

    expectActionIssue(invalidAction, ["effects", 1, "inputs", "strength"], 'is missing input slot "missingStrength" required by FLEET_MOVE')
  })

  it("should reject mismatched Move, Assault, and Colonize mappings, duplicate Colonize effects, and unused inputs", () => {
    const colonizeEffect = ColonizePlanetTest.effects.find(isColonizeEffect)
    Assert.isDefined(colonizeEffect)
    const mismatchedColonizeEffects = [...ColonizePlanetTest.effects]
    const colonizeEffectIndex = mismatchedColonizeEffects.indexOf(colonizeEffect)
    mismatchedColonizeEffects[colonizeEffectIndex] = {
      ...colonizeEffect,
      targets: {
        ...colonizeEffect.targets,
        planet: { ...colonizeEffect.targets.planet, actionTargetTag: branded<TargetTag>("otherPlanet") },
      },
    }
    const mismatchedColonize = { ...ColonizePlanetTest, id: "MISMATCHED_MOVE_COLONIZE", effects: mismatchedColonizeEffects }
    const mismatchedAssault = {
      ...ColonizePlanetTest,
      id: "MISMATCHED_MOVE_ASSAULT",
      effects: [...ColonizePlanetTest.effects, FleetAssaultEffectDefinition.create({ fleetTag: "planet", planetTag: "fleet" })],
    }
    const duplicateColonize = {
      ...ColonizeHereTest,
      id: "DUPLICATE_COLONIZE",
      effects: [...ColonizeHereTest.effects, colonizeEffect],
    }
    const unusedInput = {
      ...ColonizeHereTest,
      id: "UNUSED_COLONIZE_INPUT",
      inputs: { quota: { type: "POSITIVE_INTEGER", label: "Quota" } },
    }

    expectActionIssue(mismatchedColonize, ["effects", 1, "targets"], "FLEET_COLONIZE must use the same source and destination target tags")
    expectActionIssue(mismatchedAssault, ["effects", 2, "targets"], "FLEET_ASSAULT must use the same source and destination target tags")
    expectActionIssue(duplicateColonize, ["effects"], "may contain only one FLEET_COLONIZE effect")
    expectActionIssue(unusedInput, ["inputs", "quota"], 'input slot "quota" is not used by an Effect Definition')
  })

  it("should reject an Action Pool entry that references a missing Action Definition", () => {
    // Arrange
    const ruleset: DeepUnbranded<Ruleset> = {
      id: "test-ruleset",
      name: "Test Ruleset",
      isDefault: false,
      actionDefinitions: indexBy("id", [validActionDefinition]),
      actionPool: [{ id: "MISSING_ACTION_1", actionDefinitionId: "MISSING_ACTION" }],
      startingResources: createResourcesStub(),
    }

    // Act
    const result = Ruleset.safeCreate(ruleset)

    // Assert
    expect(result).toStrictEqual(
      Result.Failure(["Action Pool action MISSING_ACTION_1 references missing Action Definition MISSING_ACTION"]),
    )
  })

  it("should reject duplicate Action IDs in the Action Pool", () => {
    // Arrange
    const ruleset: DeepUnbranded<Ruleset> = {
      id: "test-ruleset",
      name: "Test Ruleset",
      isDefault: false,
      actionDefinitions: indexBy("id", [validActionDefinition]),
      actionPool: [
        { id: "VALID_ACTION_1", actionDefinitionId: validActionDefinition.id },
        { id: "VALID_ACTION_1", actionDefinitionId: validActionDefinition.id },
      ],
      startingResources: createResourcesStub(),
    }

    // Act
    const result = Ruleset.safeCreate(ruleset)

    // Assert
    expect(result).toStrictEqual(Result.Failure(["Action Pool contains duplicate action id VALID_ACTION_1"]))
  })
})

function expectActionIssue(actionDefinition: unknown, path: Array<string | number>, message?: string): void {
  const result = ActionDefinitionSchema.safeParse(actionDefinition)
  expect(result.success).toBe(false)
  if (result.success) {
    return
  }

  const issue = result.error.issues.find(
    ({ path: actualPath }) => actualPath.length === path.length && actualPath.every((part, index) => part === path[index]),
  )
  expect(issue).toBeDefined()
  expect(issue?.message ?? "").toContain(message ?? "")
}

function isColonizeEffect(effect: ActionDefinition["effects"][number]): effect is ReturnType<typeof FleetColonizeEffectDefinition.create> {
  return effect.type === FleetColonizeEffectDefinition.type
}

function safeCreateRulesetWithAction(
  actionDefinition: DeepUnbranded<ActionDefinition>,
  actionPool: Array<DeepUnbranded<Ruleset["actionPool"][number]>> = [],
): ReturnType<typeof Ruleset.safeCreate> {
  return Ruleset.safeCreate({
    id: "test-movement-ruleset",
    name: "Test Movement Ruleset",
    isDefault: false,
    actionDefinitions: { [actionDefinition.id]: actionDefinition },
    actionPool,
    startingResources: createResourcesStub(),
  })
}
