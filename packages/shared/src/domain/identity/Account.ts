import { z } from "zod"
import { AccountIdSchema, type AccountId } from "#shared/domain/identity/AccountId.ts"
import { AliasSchema, type Alias } from "#shared/domain/identity/Alias.ts"

export type Account = Readonly<{
  id: AccountId
  authId: string
  email: string | null
  alias: Alias
  onboarded: boolean
}>

export const AccountSchema = z.object({
  id: AccountIdSchema,
  authId: z.string(),
  email: z.string().nullable(),
  alias: AliasSchema,
  onboarded: z.boolean(),
}) satisfies z.ZodType<Account>
