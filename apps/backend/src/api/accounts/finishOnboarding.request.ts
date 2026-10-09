import { AliasSchema } from "shared/domain/accounts/Alias.ts"
import { z } from "zod"

export const FinishOnboardingRequestSchema = z.object({
  alias: AliasSchema,
})
