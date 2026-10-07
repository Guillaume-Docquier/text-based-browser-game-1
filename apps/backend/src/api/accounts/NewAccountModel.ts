import type { AccountId } from "shared/domain/identity/AccountId.ts"
import type { Alias } from "shared/domain/identity/Alias.ts"

export type NewAccountModel = {
  id?: AccountId | undefined
  authId: string
  email?: string | null | undefined
  alias: Alias
  onboarded: boolean
}
