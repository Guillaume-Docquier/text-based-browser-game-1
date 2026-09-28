import { typedParse } from "@guillaume-docquier/tools-ts/schemas"
import { z } from "zod"
import type { AbstractEffectDefinition, NoTargets } from "#game-rules/ruleset/effect-definitions/AbstractEffectDefinition.ts"
import type { EffectDefinitionFactoryParameters } from "#game-rules/ruleset/effect-definitions/implementations/EffectDefinitionFactoryParameters.ts"
import { QuantityOfResourceSchema, type QuantityOfResource } from "#game-rules/ruleset/effect-definitions/QuantityOfResource.ts"

export interface ResourceGainEffectDefinition extends AbstractEffectDefinition {
  readonly type: "RESOURCE_GAIN"
  readonly targets: NoTargets
  readonly parameters: QuantityOfResource
}

export const ResourceGainEffectDefinition = {
  type: "RESOURCE_GAIN",
  create: ({ quantity, resourceType }: EffectDefinitionFactoryParameters<ResourceGainEffectDefinition>): ResourceGainEffectDefinition =>
    typedParse(ResourceGainEffectDefinitionSchema, {
      type: ResourceGainEffectDefinition.type,
      targets: {},
      parameters: {
        quantity,
        resourceType,
      },
    }),
} as const

export const ResourceGainEffectDefinitionSchema = z.object({
  type: z.literal(ResourceGainEffectDefinition.type),
  targets: z.object({}),
  parameters: QuantityOfResourceSchema,
}) satisfies z.ZodType<ResourceGainEffectDefinition>
