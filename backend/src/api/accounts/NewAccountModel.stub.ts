import { v4 } from "uuid"
import type { NewAccountModel } from "./accounts.repository.ts"

export function createNewAccountModelStub(overrides?: Partial<NewAccountModel>): NewAccountModel {
  const authId = v4()

  return {
    authId,
    email: `player.${authId}@example.com`,
    alias: `Player ${authId}`,
    ...overrides,
  }
}
