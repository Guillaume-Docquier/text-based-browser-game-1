import type { Page } from "@playwright/test"

export type AuthenticatedUser = Readonly<{
  alias: string
  email: string
  page: Page
}>
