import { Assert } from "@guillaume-docquier/tools-ts"
import {
  expect,
  test as base,
  type Browser,
  type BrowserContext,
  type ConsoleMessage,
  type Page,
  type TestInfo,
  type Video,
  type WebError,
} from "@playwright/test"
import { users } from "./auth.ts"
import type { AuthenticatedUser } from "./AuthenticatedUser.ts"
import { PlaywrightEnvSchema, type PlaywrightEnv } from "./parseEnv.ts"

const allowedConsoleWarnings = [/^Clerk: Clerk has been loaded with development keys\./]

type BrowserDiagnostics = {
  registerContext: (context: BrowserContext, player: string) => void
  registerVideo: (video: Video, name: string) => void
}

type Fixtures = {
  /**
   * Automatically fails the test on unexpected browser errors or warnings across all fixture contexts.
   * Should only be used within the fixtures to register additional contexts.
   */
  browserDiagnostics: BrowserDiagnostics

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

export const test = base.extend<Fixtures>({
  browserDiagnostics: [
    async ({ context }, use, testInfo): Promise<void> => {
      const unexpectedDiagnostics: string[] = []
      const removeListeners: Array<() => void> = []
      const videos: Array<{ video: Video; name: string }> = []
      const registerContext = (context: BrowserContext, player: string): void => {
        const pageNumbers = new Map<Page, number>()
        const registerPage = (page: Page): void => {
          if (!pageNumbers.has(page)) {
            pageNumbers.set(page, pageNumbers.size + 1)
          }
        }
        const describePage = (page: Page | null): string => {
          if (page === null) {
            return `[${player}, unknown page]`
          }

          registerPage(page)
          return `[${player}, page ${pageNumbers.get(page)}, ${page.url()}]`
        }
        const recordPageError = (webError: WebError): void => {
          const error = webError.error()
          unexpectedDiagnostics.push(`${describePage(webError.page())} page error: ${error.stack ?? error.message}`)
        }
        const recordConsoleMessage = (message: ConsoleMessage): void => {
          if (message.type() === "warning" && isAllowedConsoleWarning(message.text())) {
            return
          }

          if (message.type() === "error" || message.type() === "warning") {
            unexpectedDiagnostics.push(`${describePage(message.page())} console ${message.type()}: ${message.text()}`)
          }
        }

        context.pages().forEach(registerPage)
        context.on("page", registerPage)
        context.on("weberror", recordPageError)
        context.on("console", recordConsoleMessage)
        removeListeners.push(() => {
          context.off("page", registerPage)
          context.off("weberror", recordPageError)
          context.off("console", recordConsoleMessage)
        })
      }

      registerContext(context, "default")
      try {
        await use({
          registerContext,
          registerVideo: (video, name) => {
            videos.push({ video, name })
          },
        })
      } finally {
        removeListeners.forEach((remove) => {
          remove()
        })

        // All authenticated fixtures have closed. A late diagnostic from one context must retain every player's videos.
        const retainVideos = testInfo.status !== testInfo.expectedStatus || unexpectedDiagnostics.length > 0
        for (const { video, name } of videos) {
          if (retainVideos) {
            await testInfo.attach(name, { path: await video.path(), contentType: "video/webm" })
          } else {
            await video.delete()
          }
        }
        expect(unexpectedDiagnostics, "Unexpected browser diagnostics").toEqual([])
      }
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
  alice: async ({ browser, browserDiagnostics }, use, testInfo) => {
    await useAuthenticatedUser(browser, browserDiagnostics, users.alice, use, testInfo)
  },
  bob: async ({ browser, browserDiagnostics }, use, testInfo) => {
    await useAuthenticatedUser(browser, browserDiagnostics, users.bob, use, testInfo)
  },
})

async function useAuthenticatedUser(
  browser: Browser,
  browserDiagnostics: BrowserDiagnostics,
  user: (typeof users)[keyof typeof users],
  use: (user: AuthenticatedUser) => Promise<void>,
  testInfo: TestInfo,
): Promise<void> {
  const context = await browser.newContext({
    storageState: user.authFilePath,
    recordVideo: { dir: testInfo.outputPath("videos") },
  })
  const pages: Page[] = []
  const recordPage = (page: Page): void => {
    pages.push(page)
  }
  browserDiagnostics.registerContext(context, user.alias)
  context.on("page", recordPage)

  try {
    const page = await context.newPage()
    await use({ alias: user.alias, email: user.email, page })
  } finally {
    await context.close()
    context.off("page", recordPage)

    // Playwright traces manual contexts automatically, but their videos need explicit registration for final retention.
    for (const [index, page] of pages.entries()) {
      const video = page.video()
      Assert.isDefined(video)
      browserDiagnostics.registerVideo(video, `${user.alias} page ${index + 1}`)
    }
  }
}

function isAllowedConsoleWarning(message: string): boolean {
  return allowedConsoleWarnings.some((allowedWarning) => allowedWarning.test(message))
}

export { expect }
