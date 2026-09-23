import { v4 } from "uuid"
import { AliasSchema } from "#lib/db/accounts/Alias.ts"
import { typedParse } from "#lib/validation/typedParse.ts"
import type { NewAccountModel } from "./accounts.repository.ts"

export function createNewAccountModelStub(overrides?: Partial<NewAccountModel>): NewAccountModel {
  const authId = v4()

  return {
    authId,
    email: `player.${authId}@example.com`,
    alias: typedParse(AliasSchema, v4()),
    onboarded: false,
    ...overrides,
  }
}
