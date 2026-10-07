import { typedParse } from "@guillaume-docquier/tools-ts/schemas"
import { AliasSchema } from "shared/domain/identity/Alias.ts"
import { v4 } from "uuid"
import type { NewAccountModel } from "#api/accounts/NewAccountModel.ts"

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
