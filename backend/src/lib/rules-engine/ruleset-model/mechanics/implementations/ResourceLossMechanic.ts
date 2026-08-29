import { z } from "zod"
import type { AbstractMechanic } from "#lib/rules-engine/ruleset-model/mechanics/AbstractMechanic.ts"
import { QuantityOfResourceSchema, type QuantityOfResource } from "#lib/rules-engine/ruleset-model/mechanics/QuantityOfResource.ts"
import { TargetDefinitionSelf, TargetDefinitionSelfSchema } from "#lib/rules-engine/ruleset-model/mechanics/TargetDefinition.ts"

export interface ResourceLossMechanic extends AbstractMechanic, QuantityOfResource {
  readonly type: "RESOURCE_LOSS"
  readonly targets: {
    readonly player: TargetDefinitionSelf
  }
}

export const ResourceLossMechanic = {
  type: "RESOURCE_LOSS",
  create: ({ quantity, resourceType }: Omit<ResourceLossMechanic, "type" | "targets">): ResourceLossMechanic => ({
    type: ResourceLossMechanic.type,
    targets: {
      player: TargetDefinitionSelf,
    },
    quantity,
    resourceType,
  }),
} as const

export const ResourceLossMechanicSchema = QuantityOfResourceSchema.extend({
  type: z.literal(ResourceLossMechanic.type),
  targets: z.object({ player: TargetDefinitionSelfSchema }),
}) satisfies z.ZodType<ResourceLossMechanic>
