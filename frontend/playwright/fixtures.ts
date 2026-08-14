import { expect, test as base, type ConsoleMessage } from "@playwright/test"
import { PlaywrightEnv } from "./loadEnv.ts"

const allowedConsoleWarnings = [/^Clerk: Clerk has been loaded with development keys\./]

type Fixtures = {
  /**
   * Automatically fails the test on unexpected browser errors or warnings.
   */
  browserDiagnostics: undefined

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
  browserDiagnostics: [
    async ({ page }, use): Promise<void> => {
      const unexpectedDiagnostics: string[] = []
      const recordPageError = (error: Error): void => {
        unexpectedDiagnostics.push(`page error: ${error.stack ?? error.message}`)
      }
      const recordConsoleMessage = (message: ConsoleMessage): void => {
        if (message.type() === "warning" && isAllowedConsoleWarning(message.text())) {
          return
        }

        if (message.type() === "error" || message.type() === "warning") {
          unexpectedDiagnostics.push(`console ${message.type()}: ${message.text()}`)
        }
      }

      page.on("pageerror", recordPageError)
      page.on("console", recordConsoleMessage)

      await use(undefined)

      page.off("pageerror", recordPageError)
      page.off("console", recordConsoleMessage)
      expect(unexpectedDiagnostics, "Unexpected browser diagnostics").toEqual([])
    },
    { auto: true },
  ],
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

function isAllowedConsoleWarning(message: string): boolean {
  return allowedConsoleWarnings.some((allowedWarning) => allowedWarning.test(message))
}

export { expect }
