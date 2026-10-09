import type { Enumify } from "@guillaume-docquier/tools-ts"

export type FinishOnboardingError = Enumify<typeof FinishOnboardingError>
export const FinishOnboardingError = {
  ALREADY_ONBOARDED: "ALREADY_ONBOARDED",
  ALIAS_ALREADY_TAKEN: "ALIAS_ALREADY_TAKEN",
  UNKNOWN: "UNKNOWN",
} as const
