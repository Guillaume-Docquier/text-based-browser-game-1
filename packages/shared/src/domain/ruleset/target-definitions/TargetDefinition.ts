import { z } from "zod"
import { FleetTargetConstraintSchema } from "#shared/domain/ruleset/target-definitions/fleet/FleetTargetConstraint.ts"
import { PlanetTargetConstraintSchema } from "#shared/domain/ruleset/target-definitions/planet/PlanetTargetConstraint.ts"
import { PlayerTargetConstraintSchema } from "#shared/domain/ruleset/target-definitions/player/PlayerTargetConstraint.ts"
import type { TargetConstraint } from "#shared/domain/ruleset/target-definitions/TargetConstraint.ts"
import { TargetType } from "#shared/domain/ruleset/target-definitions/TargetType.ts"

/**
 * A target slot pairs one entity type with its own constraint array.
 */
export type TargetDefinition = {
  [TType in TargetType]: Readonly<{
    targetType: TType
    constraints: ReadonlyArray<TargetConstraint[TType]>
  }>
}[TargetType]

export const TargetDefinitionSchema = z.discriminatedUnion("targetType", [
  z.object({
    targetType: z.literal(TargetType.FLEET),
    constraints: z.array(FleetTargetConstraintSchema).readonly(),
  }),
  z.object({
    targetType: z.literal(TargetType.PLANET),
    constraints: z.array(PlanetTargetConstraintSchema).readonly(),
  }),
  z.object({
    targetType: z.literal(TargetType.PLAYER),
    constraints: z.array(PlayerTargetConstraintSchema).readonly(),
  }),
]) satisfies z.ZodType<TargetDefinition>
