import { text } from "drizzle-orm/pg-core"
import type { RulesetId } from "shared/domain/ruleset/RulesetId.ts"

// oxlint-disable-next-line typescript/explicit-function-return-type -- Let drizzle inference do the work
export const rulesetIdColumn = (name: string) => text(name).$type<RulesetId>()
