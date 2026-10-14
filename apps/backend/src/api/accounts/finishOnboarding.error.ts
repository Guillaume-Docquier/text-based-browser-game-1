import type { Enumify } from "@guillaume-docquier/tools-ts"
import type { TrpcErrorResponse } from "#api/trpc.ts"

export type FinishOnboardingError = Enumify<typeof FinishOnboardingError>
export const FinishOnboardingError = {
  ALREADY_ONBOARDED: "ALREADY_ONBOARDED",
  ALIAS_ALREADY_TAKEN: "ALIAS_ALREADY_TAKEN",
  UNKNOWN: "UNKNOWN",
} as const

/**
 * Maps each use-case failure to its API response code and user message.
 */
export const FinishOnboardingErrorResponses: Record<FinishOnboardingError, TrpcErrorResponse> = {
  [FinishOnboardingError.ALREADY_ONBOARDED]: { code: "BAD_REQUEST", message: "Onboarding has already been completed." },
  [FinishOnboardingError.ALIAS_ALREADY_TAKEN]: { code: "CONFLICT", message: "That alias is already taken." },
  [FinishOnboardingError.UNKNOWN]: { code: "INTERNAL_SERVER_ERROR", message: "Onboarding could not be completed." },
}
