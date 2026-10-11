import type { DeepUnbranded } from "@guillaume-docquier/tools-ts"
import { typedParse } from "@guillaume-docquier/tools-ts/schemas"
import type { TargetDefinition } from "#shared/domain/ruleset/target-definitions/TargetDefinition.ts"
import { TargetDefinitionSchema } from "#shared/domain/ruleset/target-definitions/TargetDefinition.ts"
import { TargetType } from "#shared/domain/ruleset/target-definitions/TargetType.ts"

type TargetDefinitionOverrides = {
  [TType in TargetType]: Partial<DeepUnbranded<Extract<TargetDefinition, { targetType: TType }>>> & {
    targetType: TType
  }
}[TargetType]

/**
 * Builds a valid target definition while preserving entity-specific constraints.
 */
export function createTargetDefinitionStub(overrides: TargetDefinitionOverrides = { targetType: TargetType.PLANET }): TargetDefinition {
  return typedParse(TargetDefinitionSchema, { constraints: [], ...overrides })
}
