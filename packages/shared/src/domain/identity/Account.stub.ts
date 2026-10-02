import type { UnbrandedProperties } from "@guillaume-docquier/tools-ts"
import { typedParse } from "@guillaume-docquier/tools-ts/schemas"
import { v4 } from "uuid"
import { AccountSchema, type Account } from "#shared/domain/identity/Account.ts"
import { AliasSchema } from "#shared/domain/identity/Alias.ts"

export function createAccountStub({ id = v4(), authId = v4(), ...overrides }: Partial<UnbrandedProperties<Account>> = {}): Account {
  return typedParse(AccountSchema, {
    id,
    authId,
    email: "player." + authId + "@example.com",
    alias: typedParse(AliasSchema, v4()),
    onboarded: false,
    ...overrides,
  })
}
