import z from "zod"
import type { AbstractMechanic } from "#lib/rules-engine/ruleset-model/mechanics/AbstractMechanic.ts"
import { QuantityOfResourceSchema, type QuantityOfResource } from "#lib/rules-engine/ruleset-model/mechanics/QuantityOfResource.ts"
import { TargetDefinitionSelf, TargetDefinitionSelfSchema } from "#lib/rules-engine/ruleset-model/mechanics/TargetDefinition.ts"

export interface ResourceGainMechanic extends AbstractMechanic, QuantityOfResource {
  readonly type: "RESOURCE_GAIN"
  readonly targets: {
    readonly player: TargetDefinitionSelf
  }
}

export const ResourceGainMechanic = {
  type: "RESOURCE_GAIN",
  create: ({ quantity, resourceType }: Omit<ResourceGainMechanic, "type" | "targets">): ResourceGainMechanic => ({
    type: ResourceGainMechanic.type,
    targets: {
      player: TargetDefinitionSelf,
    },
    quantity,
    resourceType,
  }),
} as const

export const ResourceGainMechanicSchema = QuantityOfResourceSchema.extend({
  type: z.literal(ResourceGainMechanic.type),
  targets: z.object({ player: TargetDefinitionSelfSchema }),
}) satisfies z.ZodType<ResourceGainMechanic>
