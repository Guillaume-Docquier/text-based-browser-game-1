import { branded } from "@guillaume-docquier/tools-ts"
import { ResourceType } from "shared/domain/resources/ResourceType.ts"
import { ActionDefinitionSchema } from "shared/domain/ruleset/action-definitions/ActionDefinition.ts"
import type { TargetTag } from "shared/domain/ruleset/action-definitions/TargetTag.ts"
import { FleetAssaultEffectDefinition } from "shared/domain/ruleset/effect-definitions/FleetAssaultEffectDefinition.ts"
import { FleetMoveEffectDefinition } from "shared/domain/ruleset/effect-definitions/FleetMoveEffectDefinition.ts"
import { ResourceLossEffectDefinition } from "shared/domain/ruleset/effect-definitions/ResourceLossEffectDefinition.ts"
import { RulesetSchema } from "shared/domain/ruleset/Ruleset.ts"
import { DifferentFromFleetOriginConstraint } from "shared/domain/ruleset/target-definitions/DifferentFromFleetOriginTargetConstraint.ts"
import { OwnedBySubmittingPlayerConstraint } from "shared/domain/ruleset/target-definitions/OwnedBySubmittingPlayerTargetConstraint.ts"
import { StationaryFleetConstraint } from "shared/domain/ruleset/target-definitions/StationaryFleetTargetConstraint.ts"
import { TargetType } from "shared/domain/ruleset/target-definitions/TargetType.ts"
import { WithinFleetRangeConstraint } from "shared/domain/ruleset/target-definitions/WithinFleetRangeTargetConstraint.ts"
import { AttackMoveTest } from "shared/testing/test-ruleset/action-definitions/attack-move.ts"
import { TestRuleset } from "shared/testing/test-ruleset/TestRuleset.ts"
import { describe, expect, it } from "vitest"

const renamedActionId = "TEST_RENAMED_ATTACK_MOVE"
const renamedPoolId = "TEST_RENAMED_ATTACK_MOVE_1"

const RenamedAttackMove = ActionDefinitionSchema.parse({
  ...AttackMoveTest,
  id: renamedActionId,
  name: "Flexible Landing Assault",
  tier: "EXCEPTIONAL",
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
  costs: [
    ResourceLossEffectDefinition.create({ quantity: 7, resourceType: ResourceType.INFLUENCE }),
    ResourceLossEffectDefinition.create({ quantity: 2, resourceType: ResourceType.FUEL }),
  ],
  effects: [
    FleetMoveEffectDefinition.create({ fleetTag: "originForce", planetTag: "landingSite", strengthTag: "units", speed: 2 }),
    FleetAssaultEffectDefinition.create({ fleetTag: "originForce", planetTag: "landingSite" }),
  ],
})

describe("Assault Ruleset boundary", () => {
  it("should accept a renamed composed definition and the existing standalone stationary Assault through full RulesetSchema", () => {
    // Arrange
    const input = rulesetInputFor(RenamedAttackMove)

    // Act
    const parsed = RulesetSchema.parse(input)

    // Assert
    expect(Object.values(parsed.actionDefinitions).find(({ id }) => String(id) === renamedActionId)).toStrictEqual(RenamedAttackMove)
    expect(Object.values(parsed.actionDefinitions).find(({ id }) => String(id) === "TEST_STATIONARY_ASSAULT")).toStrictEqual(
      Object.values(TestRuleset.actionDefinitions).find(({ id }) => String(id) === "TEST_STATIONARY_ASSAULT"),
    )
  })

  it("should reject an Assault with a missing Fleet source role in the complete RulesetSchema", () => {
    // Arrange
    const missingAssaultSource = {
      ...RenamedAttackMove,
      effects: [
        RenamedAttackMove.effects[0],
        FleetAssaultEffectDefinition.create({ fleetTag: "missingOriginForce", planetTag: "landingSite" }),
      ],
    }

    // Act
    const parsed = RulesetSchema.safeParse(rulesetInputFor(missingAssaultSource))

    // Assert
    expect(parsed.success).toBe(false)
  })

  it("should reject a Move and Assault with different mapped Fleet source roles", () => {
    // Arrange
    const mismatchedSource = {
      ...RenamedAttackMove,
      targets: {
        ...RenamedAttackMove.targets,
        alternateForce: RenamedAttackMove.targets[branded<TargetTag>("originForce")],
      },
      effects: [
        RenamedAttackMove.effects[0],
        FleetAssaultEffectDefinition.create({ fleetTag: "alternateForce", planetTag: "landingSite" }),
      ],
    }

    // Act
    const parsed = RulesetSchema.safeParse(rulesetInputFor(mismatchedSource))

    // Assert
    expect(parsed.success).toBe(false)
  })

  it("should reject a Move and Assault that use different mapped destination slots", () => {
    // Arrange
    const mismatchedDestination = {
      ...RenamedAttackMove,
      targets: {
        ...RenamedAttackMove.targets,
        alternateLanding: RenamedAttackMove.targets[branded<TargetTag>("landingSite")],
      },
      effects: [
        RenamedAttackMove.effects[0],
        FleetAssaultEffectDefinition.create({ fleetTag: "originForce", planetTag: "alternateLanding" }),
      ],
    }

    // Act
    const parsed = RulesetSchema.safeParse(rulesetInputFor(mismatchedDestination))

    // Assert
    expect(parsed.success).toBe(false)
  })

  it("should reject a duplicate Assault and an unknown deferred mechanic in the complete RulesetSchema", () => {
    // Arrange
    const duplicateAssault = {
      ...RenamedAttackMove,
      effects: [...RenamedAttackMove.effects, FleetAssaultEffectDefinition.create({ fleetTag: "originForce", planetTag: "landingSite" })],
    }
    const unknownDeferredMechanic = {
      ...RenamedAttackMove,
      effects: [...RenamedAttackMove.effects, { type: "FLEET_DEFERRED_UNKNOWN", targets: {}, parameters: {} }],
    }

    // Act
    const duplicate = RulesetSchema.safeParse(rulesetInputFor(duplicateAssault))
    const unknown = RulesetSchema.safeParse(rulesetInputFor(unknownDeferredMechanic))

    // Assert
    expect(duplicate.success).toBe(false)
    expect(unknown.success).toBe(false)
  })
})

function rulesetInputFor(actionDefinition: unknown): unknown {
  return {
    ...TestRuleset,
    actionDefinitions: { ...TestRuleset.actionDefinitions, [renamedActionId]: actionDefinition },
    actionPool: [...TestRuleset.actionPool, { id: renamedPoolId, actionDefinitionId: renamedActionId }],
  }
}
