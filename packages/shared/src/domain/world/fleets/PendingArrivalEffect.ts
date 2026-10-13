import { branded, type Branded } from "@guillaume-docquier/tools-ts"
import { z } from "zod"
import { AssaultEffectDefinitionSchema } from "#shared/domain/ruleset/effect-definitions/AssaultEffectDefinition.ts"
import { ColonizeEffectDefinitionSchema } from "#shared/domain/ruleset/effect-definitions/ColonizeEffectDefinition.ts"
import type { EffectDefinition } from "#shared/domain/ruleset/effect-definitions/EffectDefinition.ts"
export type ArrivalEffectIndex = Branded<"ArrivalEffectIndex", number>
export const ArrivalEffectIndexSchema = z
  .number()
  .int()
  .nonnegative()
  .max(Number.MAX_SAFE_INTEGER)
  .transform(branded<ArrivalEffectIndex>)
/** Indexed arrival mechanics exclude costs and arbitrary effects. */
export const PendingArrivalEffectSchema = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("ASSAULT"), effectIndex: ArrivalEffectIndexSchema, definition: AssaultEffectDefinitionSchema }),
  z.strictObject({ type: z.literal("COLONIZE"), effectIndex: ArrivalEffectIndexSchema, definition: ColonizeEffectDefinitionSchema }),
])
export type PendingArrivalEffect = z.infer<typeof PendingArrivalEffectSchema>
/** Supported arrival variants, preserving the original definition indexes. */
export function getPendingArrivalEffects(effects: readonly EffectDefinition[]): PendingArrivalEffect[] {
  return effects.flatMap((definition, effectIndex): PendingArrivalEffect[] => {
    if (definition.type !== "ASSAULT" && definition.type !== "COLONIZE") return []
    const index = branded<ArrivalEffectIndex>(effectIndex)
    return definition.type === "ASSAULT"
      ? [{ type: "ASSAULT", effectIndex: index, definition }]
      : [{ type: "COLONIZE", effectIndex: index, definition }]
  })
}
