import { branded, type Branded } from "@guillaume-docquier/tools-ts"
import { text } from "drizzle-orm/pg-core"
import { z } from "zod"

export type RulesetId = Branded<string, "RulesetId">
export const RulesetId = z.string().transform(branded<RulesetId>)

// oxlint-disable-next-line typescript/explicit-function-return-type -- Let drizzle inference do the work
export const rulesetIdColumn = (name: string) => text(name).$type<RulesetId>()
