import { Result } from "@guillaume-docquier/tools-ts"
import { PositiveNumberSchema } from "@guillaume-docquier/tools-ts/schemas"
import { describe, expect, expectTypeOf, it } from "vitest"
import { z } from "zod"
import { ActionTier } from "#shared/domain/ruleset/action-definitions/ActionTier.ts"
import { ActionType } from "#shared/domain/ruleset/action-definitions/ActionType.ts"
import type { Fleet } from "#shared/domain/world/fleets/Fleet.ts"
import type { Planet } from "#shared/domain/world/planets/Planet.ts"
import { defineAction, type Invocation } from "../definitions/defineAction.ts"
import { defineMechanic } from "../definitions/defineMechanic.ts"
import { mechanicRegistry } from "../mechanics/mechanicRegistry.ts"

const base = {
  id: "EXAMPLE",
  name: "Example",
  type: ActionType.DIRECTIVE,
  tier: ActionTier.STANDARD,
  targets: { fleetA: "fleet", planetA: "planet" },
  constraints: [],
  costs: [],
} as const

describe("TypeScript authoring", () => {
  it("should infer the actual resolver entity types from mechanic slots", () => {
    // Arrange
    const mechanic = defineMechanic({
      targets: { fleet: "fleet", destination: "planet" },
      parameters: z.strictObject({ speed: PositiveNumberSchema }),
      phase: "fleetMovement",
      requirements: (refs) => {
        expectTypeOf(refs.fleet.kind).toEqualTypeOf<"fleet">()
        return [{ kind: "ownedByActor", target: refs.fleet }]
      },
      resolve: ({ fleet, destination }, parameters) => {
        expectTypeOf(fleet).toEqualTypeOf<Fleet>()
        expectTypeOf(destination).toEqualTypeOf<Planet>()
        expectTypeOf(parameters.speed).toEqualTypeOf<z.output<typeof PositiveNumberSchema>>()
        return Result.Success([])
      },
    })
    // Act
    const action = defineAction(
      { move: mechanic },
      {
        ...base,
        mechanics: [{ use: "move", bind: { fleet: "fleetA", destination: "planetA" }, parameters: { speed: 1 } }],
      },
    )
    // Assert
    expectTypeOf<keyof typeof mechanic.targets>().toEqualTypeOf<"fleet" | "destination">()
    expectTypeOf<Extract<Invocation<typeof base.targets, typeof mechanicRegistry>, { use: "moveFleet" }>["bind"]>().toEqualTypeOf<{
      readonly fleet: "fleetA"
      readonly destination: "planetA"
    }>()
    expect(action.mechanics).toStrictEqual([{ use: "move", bind: { fleet: "fleetA", destination: "planetA" }, parameters: { speed: 1 } }])
  })

  it("should reject incompatible bindings, missing slots and malformed parameters statically", () => {
    // Arrange
    const targets = base.targets
    // Act
    defineAction(mechanicRegistry, {
      ...base,
      targets,
      mechanics: [
        // @ts-expect-error A planet cannot fill a fleet slot.
        {
          use: "moveFleet",
          bind: { fleet: "planetA", destination: "planetA" },
          parameters: { speed: 1 },
        },
      ],
    })
    defineAction(mechanicRegistry, {
      ...base,
      mechanics: [
        // @ts-expect-error Required destination binding is absent.
        {
          use: "moveFleet",
          // Required destination binding is absent.
          bind: { fleet: "fleetA" },
          parameters: { speed: 1 },
        },
      ],
    })
    defineAction(mechanicRegistry, {
      ...base,
      mechanics: [
        {
          use: "moveFleet",
          bind: { fleet: "fleetA", destination: "planetA" },
          // @ts-expect-error The parameter schema requires a number.
          parameters: { speed: "fast" },
        },
      ],
    })
    defineAction(mechanicRegistry, {
      ...base,
      mechanics: [
        // @ts-expect-error Undeclared targets cannot be bound.
        {
          use: "moveFleet",
          // Undeclared targets cannot be bound.
          bind: { fleet: "missing", destination: "planetA" },
          parameters: { speed: 1 },
        },
      ],
    })
    defineAction(mechanicRegistry, {
      ...base,
      mechanics: [],
      constraints: [
        // @ts-expect-error Strength constraints require a fleet.
        { kind: "strengthAtLeast", fleet: "planetA", value: 10 },
      ],
    })
    // Assert
    expect(targets).toStrictEqual({ fleetA: "fleet", planetA: "planet" })
  })
})
