import { z } from "zod"
import type { AbstractMechanic, NoTargets } from "#lib/rules-engine/ruleset-model/mechanics/AbstractMechanic.ts"
import type { MechanicFactoryParameters } from "#lib/rules-engine/ruleset-model/mechanics/implementations/MechanicFactoryParameters.ts"
import { QuantityOfResourceSchema, type QuantityOfResource } from "#lib/rules-engine/ruleset-model/mechanics/QuantityOfResource.ts"

export interface ResourceGainMechanic extends AbstractMechanic {
  readonly type: "RESOURCE_GAIN"
  readonly targets: NoTargets
  readonly parameters: QuantityOfResource
}

export const ResourceGainMechanic = {
  type: "RESOURCE_GAIN",
  create: ({ quantity, resourceType }: MechanicFactoryParameters<ResourceGainMechanic>): ResourceGainMechanic => ({
    type: ResourceGainMechanic.type,
    targets: {},
    parameters: {
      quantity,
      resourceType,
    },
  }),
} as const

export const ResourceGainMechanicSchema = z.object({
  type: z.literal(ResourceGainMechanic.type),
  targets: z.object({}),
  parameters: QuantityOfResourceSchema,
}) satisfies z.ZodType<ResourceGainMechanic>
