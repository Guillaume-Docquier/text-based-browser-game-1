import { Assert } from "@guillaume-docquier/tools-ts"
import { expect, test as base, type BrowserContext, type ConsoleMessage, type WebError } from "@playwright/test"
import { type User, users } from "./auth.ts"
import type { AuthenticatedUser } from "./AuthenticatedUser.ts"
import { type PlaywrightEnv, parseEnv } from "./parseEnv.ts"

const allowedConsoleWarnings = [/^Clerk: Clerk has been loaded with development keys\./]

type WorkerFixtures = {
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
}

type TestFixtures = {
  /**
   * Exact sequence of diagnostics deliberately produced by a failure-path test.
   * Unexpected or missing messages still fail the test. Empty by default.
   */
  expectedBrowserDiagnostics: { messages: readonly RegExp[] }

  /**
   * This fixture is automatic and should only be used by other fixtures.
   *
   * Creates authenticated users and owns context cleanup, diagnostics, and videos.
   * Also monitors the default context automatically.
   */
  browserSessions: {
    for: (user: User) => Promise<AuthenticatedUser>
  }

  /**
   * Using this will sign in alice and give you a page for alice.
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

export const test = base.extend<TestFixtures, WorkerFixtures>({
  // Worker fixtures
  env: [
    // oxlint-disable-next-line no-empty-pattern -- That's how playwright fixtures work
    async ({}, use): Promise<void> => {
      await use(parseEnv())
    },
    { scope: "worker" },
  ],
  clerkConfig: [
    async ({ env }, use): Promise<void> => {
      await use({
        publishableKey: env.VITE_CLERK_PUBLISHABLE_KEY,
        secretKey: env.CLERK_SECRET_KEY,
      })
    },
    { scope: "worker" },
  ],
  isCI: [
    async ({ env }, use): Promise<void> => {
      await use(env.CI)
    },
    { scope: "worker" },
  ],
  // Test fixtures
  expectedBrowserDiagnostics: [{ messages: [] }, { option: true }],
  browserSessions: [
    async ({ browser, context, expectedBrowserDiagnostics }, use, testInfo): Promise<void> => {
      const sessions: Array<{ context: BrowserContext; user: AuthenticatedUser }> = []
      const diagnostics: string[] = []
      const removeContextListeners: Array<() => void> = []

      const watchContext = (context: BrowserContext, label: string): void => {
        const recordPageError = (webError: WebError): void => {
          const error = webError.error()
          diagnostics.push(`[${label}] page error: ${error.stack ?? error.message}`)
        }
        const recordConsoleMessage = (message: ConsoleMessage): void => {
          if (message.type() === "warning" && isAllowedConsoleWarning(message.text())) {
            return
          }

          if (message.type() === "error" || message.type() === "warning") {
            diagnostics.push(`[${label}] console ${message.type()}: ${message.text()}`)
          }
        }

        context.on("weberror", recordPageError)
        context.on("console", recordConsoleMessage)
        removeContextListeners.push(() => {
          context.off("weberror", recordPageError)
          context.off("console", recordConsoleMessage)
        })
      }

      watchContext(context, "default")

      await use({
        for: async (user) => {
          const userContext = await browser.newContext({
            storageState: user.authFilePath,
            recordVideo: { dir: testInfo.outputPath("videos") },
          })
          watchContext(userContext, user.alias)
          const authenticatedUser = { alias: user.alias, email: user.email, page: await userContext.newPage() }
          sessions.push({ context: userContext, user: authenticatedUser })
          return authenticatedUser
        },
      })

      for (const session of sessions) {
        await session.context.close()
      }
      for (const removeContextListener of removeContextListeners) {
        removeContextListener()
      }

      // Update the test status without stopping teardown, so diagnostic failures retain videos.
      expect
        .soft(diagnostics, "Unexpected browser diagnostics")
        .toEqual(expectedBrowserDiagnostics.messages.map((pattern) => expect.stringMatching(pattern)))

      for (const { user } of sessions) {
        const video = user.page.video()
        Assert.isDefined(video)
        testInfo.status === testInfo.expectedStatus
          ? await video.delete()
          : await testInfo.attach(user.alias, { path: await video.path(), contentType: "video/webm" })
      }
    },
    { auto: true },
  ],
  alice: async ({ browserSessions }, use) => {
    await use(await browserSessions.for(users.alice))
  },
  bob: async ({ browserSessions }, use) => {
    await use(await browserSessions.for(users.bob))
  },
})

function isAllowedConsoleWarning(message: string): boolean {
  return allowedConsoleWarnings.some((allowedWarning) => allowedWarning.test(message))
}

export { expect }
