import type { DeepUnbranded } from "@guillaume-docquier/tools-ts"
import { v4 } from "uuid"
import type { CompiledRuleset } from "#game-rules/ruleset/CompiledRuleset.ts"
import { compileRuleset } from "#game-rules/ruleset/compileRuleset.ts"
import { createResourcesStub } from "#game-rules/ruleset/effect-definitions/Resources.stub.ts"
import { Ruleset } from "#game-rules/ruleset/Ruleset.ts"

/**
 * Creates a valid compiled Ruleset from authored overrides.
 */
export function createCompiledRulesetStub(overrides: Partial<DeepUnbranded<Ruleset>> = {}): CompiledRuleset {
  return compileRuleset(
    Ruleset.create({
      id: v4(),
      name: v4(),
      isDefault: false,
      actionDefinitions: {},
      actionPool: [],
      startingResources: createResourcesStub(),
      ...overrides,
    }),
  )
}
