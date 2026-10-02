import type { DeepUnbranded } from "@guillaume-docquier/tools-ts"
import { typedParse } from "@guillaume-docquier/tools-ts/schemas"
import type { TargetDefinition } from "#shared/domain/ruleset/target-definitions/TargetDefinition.ts"
import { TargetDefinitionSchema } from "#shared/domain/ruleset/target-definitions/TargetDefinition.ts"
import { TargetType } from "#shared/domain/ruleset/target-definitions/TargetType.ts"

export function createTargetDefinitionStub({ ...overrides }: Partial<DeepUnbranded<TargetDefinition>> = {}): TargetDefinition {
  return typedParse(TargetDefinitionSchema, {
    targetType: TargetType.PLANET,
    constraints: [],
    ...overrides,
  })
}
