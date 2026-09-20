import { clerk, clerkSetup } from "@clerk/testing/playwright"
import { z } from "zod"
import { users } from "./auth.ts"
import { expect, test as setup } from "./fixtures.ts"
import { CreateGamePage } from "./pages/CreateGamePage.ts"

// Based on Clerk's docs: https://clerk.com/docs/guides/development/testing/playwright/test-authenticated-flows
setup.describe.configure({ mode: "serial" })

setup("configure Clerk for testing", async ({ clerkConfig }) => {
  await clerkSetup(clerkConfig)
})

for (const { alias, email, authFilePath } of Object.values(users)) {
  setup(`authenticate ${alias} and complete onboarding`, async ({ page, isCI }) => {
    const createGamePage = await CreateGamePage.goto(page)

    const onboardingResponseJson = await setup.step("sign in", async () => {
      await clerk.signIn({ page, emailAddress: email })

      // clerk.signIn only sets the cookies, so we need to reload for the app to properly render the onboarding
      // waiting for onboardingStatusResponse is not needed on the CI, because we expect to never be onboarded, and we'll wait during aliasOnboardingPage.chooseAlias
      // But it is needed when running locally because the user might already be onboarded since the db could be dirty
      const [onboardingResponseJson] = await Promise.all([
        (await page.waitForResponse((response) => response.url().includes("accounts.isOnboarded"))).json(),
        page.reload(),
      ])

      return onboardingResponseJson
    })

    await setup.step("complete onboarding", async () => {
      // On the CI, the db should be clean and users should always need to onboard
      // We want tests to fail here if that's not the case, so we force the onboarding flow
      // Locally, the test users might already onboarded, so we only complete the onboarding if necessary
      if (isCI || !isOnboarded(onboardingResponseJson)) {
        await expect(createGamePage.onboarding.heading).toBeVisible()
        await createGamePage.onboarding.chooseAlias(alias)
        await createGamePage.onboarding.finishOnboarding()
      }

      await expect(createGamePage.onboarding.heading).not.toBeVisible()
    })

    await setup.step("save auth state", async () => {
      await page.context().storageState({ path: authFilePath })
    })
  })
}

function isOnboarded(responseJson: unknown): boolean {
  return isOnboardedResponseSchema.parse(responseJson)[0].result.data
}

const isOnboardedResponseSchema = z
  .array(
    z.object({
      result: z.object({
        data: z.boolean(),
      }),
    }),
  )
  .min(1)
