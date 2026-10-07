import type { UnbrandedProperties } from "@guillaume-docquier/tools-ts"
import { typedParse } from "@guillaume-docquier/tools-ts/schemas"
import { v4 } from "uuid"
import { AccountSchema, type Account } from "#shared/domain/accounts/Account.ts"

export function createAccountStub({ id = v4(), ...overrides }: Partial<UnbrandedProperties<Account>> = {}): Account {
  return typedParse(AccountSchema, {
    id,
    authId: v4(),
    email: `player.${id}@example.com`,
    alias: v4(),
    onboarded: false,
    ...overrides,
  })
}
