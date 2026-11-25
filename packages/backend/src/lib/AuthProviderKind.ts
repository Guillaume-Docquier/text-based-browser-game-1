import type { Enumify } from "@guillaume-docquier/tools-ts"

export type AuthProviderKind = Enumify<typeof AuthProviderKind>
export const AuthProviderKind = {
  CLERK: "clerk",
  TEST_HEADER: "test-header",
} as const
