import { expect, test as base, type ConsoleMessage, type Page } from "@playwright/test"
import { users } from "./auth.ts"
import { PlaywrightEnv } from "./loadEnv.ts"

const allowedConsoleWarnings = [/^Clerk: Clerk has been loaded with development keys\./]

type AuthenticatedUserContext = {
  email: string
  page: Page
}

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
   * The secrets configured in the Clerk test environment.
   * Should only be used to configure Clerk testing.
   */
  clerkConfig: {
    publishableKey: string
    secretKey: string
  }

  /**
   * Using this will sign in bob and give you a page for bob.
   */
  alice: AuthenticatedUserContext

  /**
   * Using this will sign in bob and give you a page for bob.
   */
  bob: AuthenticatedUserContext
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
      publishableKey: env.VITE_CLERK_PUBLISHABLE_KEY,
      secretKey: env.CLERK_SECRET_KEY,
    })
  },
  // I would make reusable code for alice and bob, but the type shenanigans I'd have to do...
  alice: async ({ browser }, use) => {
    const context = await browser.newContext({ storageState: users.alice.authFilePath })
    const page = await context.newPage()

    await use({ email: users.alice.email, page })

    await context.close()
  },
  bob: async ({ browser }, use) => {
    const context = await browser.newContext({ storageState: users.bob.authFilePath })
    const page = await context.newPage()

    await use({ email: users.bob.email, page })

    await context.close()
  },
})

function isAllowedConsoleWarning(message: string): boolean {
  return allowedConsoleWarnings.some((allowedWarning) => allowedWarning.test(message))
}

export { expect }
