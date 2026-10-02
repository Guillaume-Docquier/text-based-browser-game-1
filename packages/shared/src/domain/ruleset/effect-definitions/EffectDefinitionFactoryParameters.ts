import type { UnbrandedProperties } from "@guillaume-docquier/tools-ts"
import type { AbstractEffectDefinition } from "#shared/domain/ruleset/effect-definitions/AbstractEffectDefinition.ts"

/**
 * Parameters accepted by effect definition factories.
 */
export type EffectDefinitionFactoryParameters<TEffectDefinition extends AbstractEffectDefinition> = UnbrandedProperties<
  {
    [K in keyof TEffectDefinition["targets"] as `${K & string}Tag`]: string
  } & TEffectDefinition["parameters"]
>
