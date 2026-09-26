import { Assert } from "@guillaume-docquier/tools-ts"
import { expect, test as base, type Browser, type ConsoleMessage, type TestInfo } from "@playwright/test"
import { users } from "./auth.ts"
import type { AuthenticatedUser } from "./AuthenticatedUser.ts"
import { PlaywrightEnvSchema, type PlaywrightEnv } from "./loadEnv.ts"

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
   * The secrets configured in the Clerk test environment.
   * Should only be used to configure Clerk testing.
   */
  clerkConfig: {
    publishableKey: string
    secretKey: string
  }

  /**
   * True when running on the CI.
   * Should only be needed by the global setup.
   */
  isCI: boolean

  /**
   * Using this will sign in bob and give you a page for bob.
   *
   * @example
   * ```ts
   * test("filters to games the player joined after signing in", async ({ page, alice, bob }) => {
   *   const aliceCreateGamePage = await CreateGamePage.goto(alice.page)
   *   const bobCreateGamePage = await CreateGamePage.goto(bob.page)
   * })
   * ```
   */
  alice: AuthenticatedUser

  /**
   * Using this will sign in bob and give you a page for bob.
   *
   * @example
   * ```ts
   * test("filters to games the player joined after signing in", async ({ page, alice, bob }) => {
   *   const aliceCreateGamePage = await CreateGamePage.goto(alice.page)
   *   const bobCreateGamePage = await CreateGamePage.goto(bob.page)
   * })
   * ```
   */
  bob: AuthenticatedUser
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
    await use(PlaywrightEnvSchema.parse(testInfo.config.metadata.env))
  },
  clerkConfig: async ({ env }, use) => {
    await use({
      publishableKey: env.VITE_CLERK_PUBLISHABLE_KEY,
      secretKey: env.CLERK_SECRET_KEY,
    })
  },
  isCI: async ({ env }, use) => {
    await use(env.CI)
  },
  alice: async ({ browser }, use, testInfo) => {
    await useAuthenticatedUser(browser, users.alice, use, testInfo)
  },
  bob: async ({ browser }, use, testInfo) => {
    await useAuthenticatedUser(browser, users.bob, use, testInfo)
  },
})

async function useAuthenticatedUser(
  browser: Browser,
  user: (typeof users)[keyof typeof users],
  use: (user: AuthenticatedUser) => Promise<void>,
  testInfo: TestInfo,
): Promise<void> {
  const context = await browser.newContext({
    storageState: user.authFilePath,
    recordVideo: { dir: testInfo.outputPath("videos") },
  })
  const page = await context.newPage()

  await use({ alias: user.alias, email: user.email, page })

  await context.close()

  // Playwright doesn't automatically record videos for manually created contexts, we have to do it ourselves.
  const video = page.video()
  Assert.isDefined(video)
  testInfo.status === testInfo.expectedStatus
    ? await video.delete()
    : await testInfo.attach(user.alias, { path: await video.path(), contentType: "video/webm" })
}

function isAllowedConsoleWarning(message: string): boolean {
  return allowedConsoleWarnings.some((allowedWarning) => allowedWarning.test(message))
}

export { expect }
