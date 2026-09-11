import { z } from "zod"
import type { AbstractMechanic, NoTargets } from "#lib/rules-engine/ruleset-model/mechanics/AbstractMechanic.ts"
import type { MechanicFactoryParameters } from "#lib/rules-engine/ruleset-model/mechanics/implementations/MechanicFactoryParameters.ts"
import { QuantityOfResourceSchema, type QuantityOfResource } from "#lib/rules-engine/ruleset-model/mechanics/QuantityOfResource.ts"
import { trustedParse } from "#lib/validation/trustedParse.ts"

export interface ResourceLossMechanic extends AbstractMechanic {
  readonly type: "RESOURCE_LOSS"
  readonly targets: NoTargets
  readonly parameters: QuantityOfResource
}

export const ResourceLossMechanic = {
  type: "RESOURCE_LOSS",
  create: ({ quantity, resourceType }: MechanicFactoryParameters<ResourceLossMechanic>): ResourceLossMechanic =>
    trustedParse(ResourceLossMechanicSchema, {
      type: ResourceLossMechanic.type,
      targets: {},
      parameters: {
        quantity,
        resourceType,
      },
    }),
} as const

export const ResourceLossMechanicSchema = z.object({
  type: z.literal(ResourceLossMechanic.type),
  targets: z.object({}),
  parameters: QuantityOfResourceSchema,
}) satisfies z.ZodType<ResourceLossMechanic>
