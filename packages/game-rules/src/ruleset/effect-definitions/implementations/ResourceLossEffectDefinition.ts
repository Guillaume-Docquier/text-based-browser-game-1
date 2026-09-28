import { typedParse } from "@guillaume-docquier/tools-ts/schemas"
import { z } from "zod"
import type { AbstractEffectDefinition, NoTargets } from "#game-rules/ruleset/effect-definitions/AbstractEffectDefinition.ts"
import type { EffectDefinitionFactoryParameters } from "#game-rules/ruleset/effect-definitions/implementations/EffectDefinitionFactoryParameters.ts"
import { QuantityOfResourceSchema, type QuantityOfResource } from "#game-rules/ruleset/effect-definitions/QuantityOfResource.ts"

export interface ResourceLossEffectDefinition extends AbstractEffectDefinition {
  readonly type: "RESOURCE_LOSS"
  readonly targets: NoTargets
  readonly parameters: QuantityOfResource
}

export const ResourceLossEffectDefinition = {
  type: "RESOURCE_LOSS",
  create: ({ quantity, resourceType }: EffectDefinitionFactoryParameters<ResourceLossEffectDefinition>): ResourceLossEffectDefinition =>
    typedParse(ResourceLossEffectDefinitionSchema, {
      type: ResourceLossEffectDefinition.type,
      targets: {},
      parameters: {
        quantity,
        resourceType,
      },
    }),
} as const

export const ResourceLossEffectDefinitionSchema = z.object({
  type: z.literal(ResourceLossEffectDefinition.type),
  targets: z.object({}),
  parameters: QuantityOfResourceSchema,
}) satisfies z.ZodType<ResourceLossEffectDefinition>
