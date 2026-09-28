import { Assert, Logger, Result } from "@guillaume-docquier/tools-ts"
import { eq } from "drizzle-orm"
import { compileRuleset } from "game-rules/ruleset/compileRuleset.ts"
import { Ruleset } from "game-rules/ruleset/Ruleset.ts"
import { TestRuleset } from "game-rules/test-ruleset/TestRuleset.ts"
import { describe, expect, it } from "vitest"
import { createDbMock } from "#lib/db/createDb.mock.ts"
import { rulesetsTable } from "#lib/db/schema.ts"
import { RulesetsRepository } from "#lib/rulesets/rulesets.repository.ts"

describe("RulesetsRepository", () => {
  it("should persist authored and compiled rules separately and load the compiled rules for gameplay", async () => {
    // Arrange
    const db = await createDbMock()
    const repository = new RulesetsRepository({ db, logger: Logger.get() })

    // Act
    const upsertResult = await repository.upsertRuleset(TestRuleset)
    const rows = await db.select().from(rulesetsTable).where(eq(rulesetsTable.id, TestRuleset.id))
    const loadedResult = await repository.getCompiledRuleset({ rulesetId: TestRuleset.id })

    // Assert
    expect(upsertResult).toStrictEqual(Result.Success(undefined))
    expect(rows).toHaveLength(1)
    expect(rows[0]?.rules.actionPool).toStrictEqual(TestRuleset.actionPool)
    expect(rows[0]?.compiledRules.actionPool).toStrictEqual(compileRuleset(TestRuleset).actionPool)
    expect(loadedResult).toStrictEqual(Result.Success(compileRuleset(TestRuleset)))
  })

  it("should recompile both stored forms when a Ruleset is updated", async () => {
    // Arrange
    const db = await createDbMock()
    const repository = new RulesetsRepository({ db, logger: Logger.get() })
    const firstAction = TestRuleset.actionPool[0]
    Assert.isDefined(firstAction)
    const ruleset = Ruleset.create({
      ...TestRuleset,
      actionPool: [...TestRuleset.actionPool, { actionDefinitionId: firstAction.actionDefinitionId }],
    })
    const originalCompiledRuleset = compileRuleset(TestRuleset)

    // Act
    const firstUpsert = await repository.upsertRuleset(TestRuleset)
    const secondUpsert = await repository.upsertRuleset(ruleset)
    const rows = await db.select().from(rulesetsTable).where(eq(rulesetsTable.id, TestRuleset.id))

    // Assert
    expect(firstUpsert).toStrictEqual(Result.Success(undefined))
    expect(secondUpsert).toStrictEqual(Result.Success(undefined))
    expect(rows).toHaveLength(1)
    expect(rows[0]?.rules.actionPool).toStrictEqual(ruleset.actionPool)
    expect(rows[0]?.compiledRules.actionPool).toHaveLength(ruleset.actionPool.length)
    expect(rows[0]?.compiledRules.actionPool.slice(0, -1)).toStrictEqual(originalCompiledRuleset.actionPool)
  })
})
