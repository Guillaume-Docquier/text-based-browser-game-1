import { AliasSchema } from "shared/domain/accounts/Alias.ts"
import { z } from "zod"

export type FinishOnboardingCommand = z.infer<typeof FinishOnboardingCommandSchema>
export const FinishOnboardingCommandSchema = z.object({
  alias: AliasSchema,
})
