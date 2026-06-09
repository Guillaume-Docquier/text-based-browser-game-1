import { v4 } from "uuid"
import type { NewAccountModel } from "./accounts.repository.ts"

export function createNewAccountModelStub(overrides?: Partial<NewAccountModel>): NewAccountModel {
  return {
    authId: v4(),
    email: "player@example.com",
    alias: "Player 1",
    ...overrides,
  }
}
