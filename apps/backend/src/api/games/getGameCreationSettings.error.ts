import type { Enumify } from "@guillaume-docquier/tools-ts"

export type GetGameCreationSettingsError = Enumify<typeof GetGameCreationSettingsError>
export const GetGameCreationSettingsError = {
  UNKNOWN: "UNKNOWN",
} as const
