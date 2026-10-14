import type { Enumify } from "@guillaume-docquier/tools-ts"
import type { TRPCError } from "@trpc/server"

export type GetGameCreationSettingsError = Enumify<typeof GetGameCreationSettingsError>
export const GetGameCreationSettingsError = {
  UNKNOWN: "UNKNOWN",
} as const

/**
 * Maps each use-case failure to its API response code and user message.
 */
export const GetGameCreationSettingsErrorResponses: Record<GetGameCreationSettingsError, { code: TRPCError["code"]; message: string }> = {
  [GetGameCreationSettingsError.UNKNOWN]: { code: "INTERNAL_SERVER_ERROR", message: "Game creation settings could not be loaded." },
}
