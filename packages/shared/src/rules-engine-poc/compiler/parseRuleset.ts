import { Result } from "@guillaume-docquier/tools-ts"
import { RulesetDefinitionSchema, type RulesetDefinition } from "../definitions/RulesetDefinition.ts"
import type { CompilationIssue } from "./CompilationIssue.ts"

/**
 * Parses player-authored JSON and reports structural errors at original paths.
 */
export function parseRuleset(input: unknown): Result<RulesetDefinition, CompilationIssue[]> {
  const parsed = RulesetDefinitionSchema.safeParse(input)
  return parsed.success ? Result.Success(parsed.data) : Result.Failure(parsed.error.issues.map(({ path, message }) => ({ path, message })))
}
