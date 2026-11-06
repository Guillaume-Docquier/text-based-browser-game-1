import { Assert, branded, Range, Result } from "@guillaume-docquier/tools-ts"
import { IntegerSchema, PositiveNumberSchema, typedParse } from "@guillaume-docquier/tools-ts/schemas"
import { v5 } from "uuid"
import { z } from "zod"
import type { FleetId } from "#shared/domain/world/fleets/FleetId.ts"
import { FleetNameSchema } from "#shared/domain/world/fleets/FleetName.ts"
import { defineMechanic } from "../definitions/defineMechanic.ts"

/**
 * Builds or reinforces the actor's stationed fleet at an owned planet.
 */
export const buildFleet = defineMechanic({
  targets: { planet: "planet" },
  parameters: z.strictObject({ strength: z.number().pipe(PositiveNumberSchema).and(IntegerSchema) }),
  phase: "fleetBuild",
  requirements: (refs) => [{ kind: "ownedByActor", target: refs.planet }],
  resolve: ({ planet }, { strength }, { state, actor, rng }) => {
    const existing = Object.values(state.fleets).find(
      (fleet) => fleet.ownerPlayerId === actor.id && fleet.originPlanetId === planet.id && fleet.destinationPlanetId === undefined,
    )
    if (existing !== undefined) {
      existing.strength += strength
      return Result.Success([{ status: "resolved", message: `Reinforced fleet by ${strength}` }])
    }
    // Same deterministic identity and random-name algorithm as the current engine.
    const id = branded<FleetId>(v5(`${state.gameId}-${actor.id}-${planet.id}-${state.turn}`, "429f862a-013d-5dc6-8d9b-f4fe00801af1"))
    Assert.isNotDefined(state.fleets[id])
    state.fleets[id] = {
      id,
      ownerPlayerId: actor.id,
      originPlanetId: planet.id,
      strength,
      name: typedParse(FleetNameSchema, `fleet ${rng.int(Range.integer({ min: 999, max: 999999 }))}`),
    }
    return Result.Success([{ status: "resolved", message: `Built fleet with strength ${strength}` }])
  },
})
