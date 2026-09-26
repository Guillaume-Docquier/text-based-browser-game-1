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

    const needsOnboarding = await setup.step("sign in", async () => {
      await clerk.signIn({ page, emailAddress: email })

      // clerk.signIn only sets the cookies, so we need to reload for the app to properly render the onboarding
      await page.reload()

      // On the CI, the db should be clean and users should always need to onboard
      if (isCI) {
        return true
      }

      // Locally, the DB could be dirty, so we check the network response to decide
      const onboardingStatusResponse = await page.waitForResponse((response) => response.url().includes("accounts.isOnboarded"))
      return !isOnboarded(await onboardingStatusResponse.json())
    })

    await setup.step("complete onboarding", async () => {
      if (needsOnboarding) {
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
