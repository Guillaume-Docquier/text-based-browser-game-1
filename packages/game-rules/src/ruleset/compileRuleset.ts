import { v5 } from "uuid"
import { CompiledRuleset } from "#game-rules/ruleset/CompiledRuleset.ts"
import type { Ruleset } from "#game-rules/ruleset/Ruleset.ts"

/** Assigns deterministic Action IDs to the authored Action Pool. */
export function compileRuleset(ruleset: Ruleset): CompiledRuleset {
  const occurrences = new Map<string, number>()
  return CompiledRuleset.create({
    ...ruleset,
    actionPool: ruleset.actionPool.map((action) => {
      const occurrence = (occurrences.get(action.actionDefinitionId) ?? 0) + 1
      occurrences.set(action.actionDefinitionId, occurrence)
      return {
        ...action,
        id: v5(JSON.stringify([action.actionDefinitionId, occurrence]), v5.URL),
      }
    }),
  })
}
