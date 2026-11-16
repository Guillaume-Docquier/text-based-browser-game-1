import { Assert } from "@guillaume-docquier/tools-ts"
import {
  expect,
  test as base,
  type Browser,
  type BrowserContext,
  type ConsoleMessage,
  type TestInfo,
  type WebError,
} from "@playwright/test"
import { users } from "./auth.ts"
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
   * Automatically fails the test on unexpected errors or warnings in any browser context.
   */
  browserDiagnostics: undefined

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
  browserDiagnostics: [
    async ({ browser, expectedBrowserDiagnostics }, use): Promise<void> => {
      // We can't use only browser.contexts() because it returns only the open contexts, and user contexts are closed before this fixture's teardown.
      const contexts = new Set<BrowserContext>()
      const diagnostics: string[] = []

      const recordPageError = (webError: WebError): void => {
        const error = webError.error()
        diagnostics.push(`page error: ${error.stack ?? error.message}`)
      }
      const recordConsoleMessage = (message: ConsoleMessage): void => {
        if (message.type() === "warning" && isAllowedConsoleWarning(message.text())) {
          return
        }

        if (message.type() === "error" || message.type() === "warning") {
          diagnostics.push(`console ${message.type()}: ${message.text()}`)
        }
      }

      const watchContext = (context: BrowserContext): void => {
        contexts.add(context)
        context.on("weberror", recordPageError)
        context.on("console", recordConsoleMessage)
      }
      const unwatchContext = (context: BrowserContext): void => {
        context.off("weberror", recordPageError)
        context.off("console", recordConsoleMessage)
      }

      browser.on("context", watchContext)
      browser.contexts().forEach(watchContext)

      await use(undefined)

      browser.off("context", watchContext)
      for (const context of contexts) {
        unwatchContext(context)
      }

      expect(diagnostics, "Unexpected browser diagnostics").toEqual(
        expectedBrowserDiagnostics.messages.map((pattern) => expect.stringMatching(pattern)),
      )
    },
    { auto: true },
  ],
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
