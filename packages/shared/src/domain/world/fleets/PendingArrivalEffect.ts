import { branded, type Branded } from "@guillaume-docquier/tools-ts"
import { z } from "zod"
import { AssaultEffectDefinitionSchema } from "#shared/domain/ruleset/effect-definitions/AssaultEffectDefinition.ts"
export type ArrivalEffectIndex = Branded<"ArrivalEffectIndex", number>
export const ArrivalEffectIndexSchema = z
  .number()
  .int()
  .nonnegative()
  .max(Number.MAX_SAFE_INTEGER)
  .transform(branded<ArrivalEffectIndex>)
/** An indexed supported effect; no costs or arbitrary phase program. */
export const PendingArrivalEffectSchema = z.strictObject({
  type: z.literal("ASSAULT"),
  effectIndex: ArrivalEffectIndexSchema,
  definition: AssaultEffectDefinitionSchema,
})
export type PendingArrivalEffect = z.infer<typeof PendingArrivalEffectSchema>
