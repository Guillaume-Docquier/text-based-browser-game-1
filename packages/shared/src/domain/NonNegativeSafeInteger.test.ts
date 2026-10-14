import { describe, expect, it } from "vitest"
import { NonNegativeSafeIntegerSchema } from "#shared/domain/NonNegativeSafeInteger.ts"
import { FleetAssaultEffectDefinition } from "#shared/domain/ruleset/effect-definitions/FleetAssaultEffectDefinition.ts"
import { createFleetStub } from "#shared/domain/world/fleets/Fleet.stub.ts"
import { FleetSchema, PendingArrivalAssaultSchema, type Fleet, type PendingArrivalAssault } from "#shared/domain/world/fleets/Fleet.ts"

describe("NonNegativeSafeInteger", () => {
  it("should keep Fleet strength and captured definition ordinals safe and nonnegative", () => {
    // Arrange
    const fleet = createFleetStub({ strength: 0 })
    const effectDefinition = FleetAssaultEffectDefinition.create({ fleetTag: "fleet", planetTag: "planet" })

    // @ts-expect-error Fleet strength must be parsed as a safe nonnegative integer.
    const invalidFleetStrength: Fleet["strength"] = -0.5
    // @ts-expect-error Captured effect ordinals must be parsed as a safe nonnegative integer.
    const invalidDefinitionOrdinal: PendingArrivalAssault["definitionOrdinal"] = -0.5
    void [invalidFleetStrength, invalidDefinitionOrdinal]

    // Act
    const validZeroStrength = FleetSchema.safeParse(fleet)
    const validMaximumStrength = FleetSchema.safeParse({ ...fleet, strength: Number.MAX_SAFE_INTEGER })
    const invalidStrengths = [-1, 0.5, Number.MAX_SAFE_INTEGER + 1].map((strength) => FleetSchema.safeParse({ ...fleet, strength }).success)
    const validZeroOrdinal = PendingArrivalAssaultSchema.safeParse({ effectDefinition, definitionOrdinal: 0 })
    const validMaximumOrdinal = PendingArrivalAssaultSchema.safeParse({
      effectDefinition,
      definitionOrdinal: Number.MAX_SAFE_INTEGER,
    })
    const invalidOrdinals = [-1, 0.5, Number.MAX_SAFE_INTEGER + 1].map(
      (definitionOrdinal) => PendingArrivalAssaultSchema.safeParse({ effectDefinition, definitionOrdinal }).success,
    )

    // Assert
    expect(validZeroStrength.success).toBe(true)
    expect(validMaximumStrength.success).toBe(true)
    expect(invalidStrengths).toStrictEqual([false, false, false])
    expect(validZeroOrdinal.success).toBe(true)
    expect(validMaximumOrdinal.success).toBe(true)
    expect(invalidOrdinals).toStrictEqual([false, false, false])
    expect(NonNegativeSafeIntegerSchema.safeParse(0).success).toBe(true)
    expect(NonNegativeSafeIntegerSchema.safeParse(Number.MAX_SAFE_INTEGER).success).toBe(true)
  })
})
