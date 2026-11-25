import { Assert } from "@guillaume-docquier/tools-ts"
// oxlint-disable-next-line cosmic-empires/no-renamed-imports, unicorn/prefer-export-from -- Extend Playwright's base test and export expect for custom matchers.
import { expect, test as base, type BrowserContext, type ConsoleMessage, type WebError } from "@playwright/test"
import { type User, users } from "./auth.ts"
import type { AuthenticatedUser } from "./AuthenticatedUser.ts"
import { type PlaywrightEnv, parseEnv } from "./parseEnv.ts"

const allowedConsoleWarnings = [/^Clerk: Clerk has been loaded with development keys\./]

type WorkerFixtures = {
  env: PlaywrightEnv
  clerkConfig: {
    publishableKey: string
    secretKey: string
  }
  isCI: boolean
}

type TestFixtures = {
  expectedBrowserDiagnostics: { messages: readonly RegExp[] }
  browserSessions: {
    for: (user: User) => Promise<AuthenticatedUser>
  }
  alice: AuthenticatedUser
  bob: AuthenticatedUser
}

export const test = base.extend<TestFixtures, WorkerFixtures>({
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
  expectedBrowserDiagnostics: [{ messages: [] }, { option: true }],
  browserSessions: [
    async ({ browser, context, expectedBrowserDiagnostics, ignoreHTTPSErrors }, use, testInfo): Promise<void> => {
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
            ignoreHTTPSErrors,
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

      // CONSTRAINT: Update the test status without stopping teardown, so diagnostic failures retain videos.
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
