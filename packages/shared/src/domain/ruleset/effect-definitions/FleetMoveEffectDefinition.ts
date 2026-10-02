import { typedParse, type PositiveNumber, PositiveNumberSchema } from "@guillaume-docquier/tools-ts/schemas"
import { z } from "zod"
import type { AbstractEffectDefinition } from "#shared/domain/ruleset/effect-definitions/AbstractEffectDefinition.ts"
import type { EffectDefinitionFactoryParameters } from "#shared/domain/ruleset/effect-definitions/EffectDefinitionFactoryParameters.ts"
import { EffectDefinitionTargetDefinition } from "#shared/domain/ruleset/effect-definitions/EffectDefinitionTargetDefinition.ts"
import { TargetType } from "#shared/domain/ruleset/target-definitions/TargetType.ts"

/**
 * Moves a fleet to a target planet at speed X.
 * On arrival, if a fleet for this player is already present on the planet, that fleet is reinforced.
 */
export interface FleetMoveEffectDefinition extends AbstractEffectDefinition {
  readonly type: "FLEET_MOVE"
  readonly targets: {
    /**
     * The fleet to move.
     */
    readonly fleet: EffectDefinitionTargetDefinition<typeof TargetType.FLEET>
    /**
     * The planet the fleet should move to.
     */
    readonly planet: EffectDefinitionTargetDefinition<typeof TargetType.PLANET>
  }
  readonly parameters: {
    /**
     * Non-zero positive number representing the fleet's movement speed in Light Years per turn.
     */
    readonly speed: PositiveNumber
  }
}

export const FleetMoveEffectDefinition = {
  type: "FLEET_MOVE",
  create: ({ fleetTag, planetTag, speed }: EffectDefinitionFactoryParameters<FleetMoveEffectDefinition>): FleetMoveEffectDefinition =>
    typedParse(FleetMoveEffectDefinitionSchema, {
      type: FleetMoveEffectDefinition.type,
      targets: {
        fleet: {
          actionTargetTag: fleetTag,
          targetType: TargetType.FLEET,
        },
        planet: {
          actionTargetTag: planetTag,
          targetType: TargetType.PLANET,
        },
      },
      parameters: {
        speed,
      },
    }),
} as const

export const FleetMoveEffectDefinitionSchema = z.object({
  type: z.literal(FleetMoveEffectDefinition.type),
  targets: z.object({
    fleet: EffectDefinitionTargetDefinition.schemaFor(z.literal(TargetType.FLEET)),
    planet: EffectDefinitionTargetDefinition.schemaFor(z.literal(TargetType.PLANET)),
  }),
  parameters: z.object({
    speed: z.number().pipe(PositiveNumberSchema),
  }),
}) satisfies z.ZodType<FleetMoveEffectDefinition>
