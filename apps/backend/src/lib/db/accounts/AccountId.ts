import { uuid } from "drizzle-orm/pg-core"
import type { AccountId } from "shared/domain/identity/AccountId.ts"

// oxlint-disable-next-line typescript/explicit-function-return-type -- Let drizzle inference do the work
export const accountIdColumn = (name: string) => uuid(name).$type<AccountId>()
