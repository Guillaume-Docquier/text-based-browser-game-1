import type { AccountId } from "shared/domain/identity/AccountId.ts"
import type { Alias } from "shared/domain/identity/Alias.ts"

export type AccountModel = {
  id: AccountId
  authId: string
  email: string | null
  alias: Alias
  onboarded: boolean
}
