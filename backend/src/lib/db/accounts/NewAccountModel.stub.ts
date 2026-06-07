import type { NewAccountModel } from "./accounts.repository.ts"
import { v4 } from "uuid"

export function createNewAccountModelStub(overrides?: Partial<NewAccountModel>): NewAccountModel {
  return {
    authId: v4(),
    email: "player@example.com",
    alias: "Account 1",
    ...overrides,
  }
}
