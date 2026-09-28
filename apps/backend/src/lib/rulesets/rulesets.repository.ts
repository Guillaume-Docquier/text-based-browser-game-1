import { Assert, type Logger, omit, Result } from "@guillaume-docquier/tools-ts"
import { eq } from "drizzle-orm"
import type { RulesetId } from "game-rules/models/RulesetId.ts"
import { CompiledRuleset } from "game-rules/ruleset/CompiledRuleset.ts"
import { compileRuleset } from "game-rules/ruleset/compileRuleset.ts"
import type { Ruleset } from "game-rules/ruleset/Ruleset.ts"
import { PostgresRepository } from "#lib/db/PostgresRepository.ts"
import { rulesetsTable } from "#lib/db/schema.ts"
import { couldNot } from "#lib/errors.ts"

export type RulesetRulesJson = Omit<Ruleset, "id" | "name" | "isDefault">
export type CompiledRulesetRulesJson = Omit<CompiledRuleset, "id" | "name" | "isDefault">

export class RulesetsRepository extends PostgresRepository {
  private readonly logger: Logger

  public constructor({ logger, db }: { logger: Logger; db: PostgresRepository["db"] }) {
    super({ db })
    this.logger = logger.child({ scope: "rulesets-repository" })
  }

  public static toCompiledRuleset(rulesetRow: typeof rulesetsTable.$inferSelect): CompiledRuleset {
    const { id, name, isDefault, compiledRules } = rulesetRow

    return CompiledRuleset.create({
      id,
      name,
      isDefault,
      ...compiledRules,
    })
  }

  public async upsertRuleset(ruleset: Ruleset): Promise<Result<void, string>> {
    const rulesetRulesJson = toRulesetRulesJson(ruleset)
    const compiledRulesetRulesJson = toCompiledRulesetRulesJson(compileRuleset(ruleset))
    const insertResult = await Result.tryCatch(
      this.db
        .insert(rulesetsTable)
        .values({
          id: ruleset.id,
          name: ruleset.name,
          isDefault: ruleset.isDefault,
          rules: rulesetRulesJson,
          compiledRules: compiledRulesetRulesJson,
        })
        .onConflictDoUpdate({
          target: rulesetsTable.id,
          set: {
            name: ruleset.name,
            isDefault: ruleset.isDefault,
            rules: rulesetRulesJson,
            compiledRules: compiledRulesetRulesJson,
          },
        }),
    )
    if (Result.isFailure(insertResult)) {
      this.logger.error("Could not upsert ruleset", { rulesetId: ruleset.id, error: insertResult.error })
      return Result.Failure(couldNot("upsert ruleset"))
    }

    return Result.Success(undefined)
  }

  public async getCompiledRuleset(
    { rulesetId }: { rulesetId: RulesetId },
    db: PostgresRepository["db"] = this.db,
  ): Promise<Result<CompiledRuleset | undefined, string>> {
    const rulesetsResult = await Result.tryCatch(db.select().from(rulesetsTable).where(eq(rulesetsTable.id, rulesetId)))
    if (Result.isFailure(rulesetsResult)) {
      this.logger.error("Could not get ruleset", { rulesetId, error: rulesetsResult.error })
      return Result.Failure(couldNot("get ruleset"))
    }

    Assert.isTrue(rulesetsResult.value.length <= 1)
    const rulesetRow = rulesetsResult.value[0]
    if (rulesetRow === undefined) {
      return Result.Success(undefined)
    }

    return Result.Success(RulesetsRepository.toCompiledRuleset(rulesetRow))
  }
}

function toRulesetRulesJson(ruleset: Ruleset): RulesetRulesJson {
  return omit(ruleset, "id", "name", "isDefault")
}

function toCompiledRulesetRulesJson(ruleset: CompiledRuleset): CompiledRulesetRulesJson {
  return omit(ruleset, "id", "name", "isDefault")
}
