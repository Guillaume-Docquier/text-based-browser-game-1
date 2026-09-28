import { ResourceTypeSchema } from "game-rules/ruleset/effect-definitions/ResourceType.ts"
import { PositiveNumberSchema } from "game-rules/validation/PositiveNumber.ts"
import { z } from "zod"

export type QuantityOfResource = z.infer<typeof QuantityOfResourceSchema>

export const QuantityOfResourceSchema = z
  .object({
    /**
     * Expected to be a positive non-zero number, often times an integer, but not always.
     */
    quantity: z.number().pipe(PositiveNumberSchema),
    /**
     * Expected to match a resource available in the current ruleset.
     */
    resourceType: ResourceTypeSchema,
  })
  .readonly()
