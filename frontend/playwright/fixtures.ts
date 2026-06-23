import { expect, test as base } from "@playwright/test"
import { PlaywrightEnv } from "./loadEnv.ts"

type Fixtures = {
  /**
   * Should only be used within the fixtures.
   */
  env: PlaywrightEnv

  /**
   * The user email configured in the Clerk test environment.
   */
  clerkConfig: {
    emailAddress: string
    publishableKey: string
    secretKey: string
  }
}

export const test = base.extend<Fixtures>({
  // oxlint-disable-next-line no-empty-pattern -- That's how playwright fixtures work
  env: async ({}, use, testInfo) => {
    await use(PlaywrightEnv.parse(testInfo.config.metadata.env))
  },
  clerkConfig: async ({ env }, use) => {
    await use({
      emailAddress: env.E2E_CLERK_USER_EMAIL,
      publishableKey: env.VITE_CLERK_PUBLISHABLE_KEY,
      secretKey: env.CLERK_SECRET_KEY,
    })
  },
})

export { expect }
