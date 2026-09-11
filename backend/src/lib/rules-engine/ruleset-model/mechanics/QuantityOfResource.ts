import { z } from "zod"
import { ResourceTypeSchema } from "#lib/rules-engine/ruleset-model/mechanics/ResourceType.ts"
import { PositiveNumberSchema } from "#lib/validation/PositiveNumber.ts"

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
