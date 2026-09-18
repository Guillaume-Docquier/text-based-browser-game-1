import { clerk, clerkSetup } from "@clerk/testing/playwright"
import { z } from "zod"
import { users } from "./auth.ts"
import { expect, test as setup } from "./fixtures.ts"
import { OnboardingPage } from "./pages/OnboardingPage.ts"

// Based on Clerk's docs: https://clerk.com/docs/guides/development/testing/playwright/test-authenticated-flows
setup.describe.configure({ mode: "serial" })

setup("configure Clerk testing", async ({ clerkConfig }) => {
  await clerkSetup(clerkConfig)
})

for (const [name, { email, authFilePath }] of Object.entries(users)) {
  setup(`authenticate ${name}`, async ({ page, isCI }) => {
    await page.goto("/games/create")

    await clerk.signIn({ page, emailAddress: email })

    // clerk.signIn only sets the cookies, so we need to reload for the app to properly render the onboarding
    // waiting for onboardingStatusResponse is not needed on the CI, because we expect to never be onboarded, and we'll wait during aliasOnboardingPage.chooseAlias
    // But it is needed when running locally because the user might already be onboarded since the db could be dirty
    const onboardingStatusResponse = page.waitForResponse((response) => response.url().includes("accounts.isOnboarded"))
    await page.reload()
    const onboardingResponse = await onboardingStatusResponse

    const aliasOnboardingPage = new OnboardingPage(page)

    // On the CI, the db should be clean and users should always need to onboard
    // We want tests to fail here if that's not the case, so we force the onboarding flow
    // Locally, the test users might already onboarded, so we only complete the onboarding if necessary
    if (isCI || !isOnboarded(await onboardingResponse.json())) {
      await aliasOnboardingPage.chooseAlias(`E2E ${name}`)
      await aliasOnboardingPage.finishOnboarding()
      await expect(aliasOnboardingPage.heading).not.toBeVisible()
    }

    await page.context().storageState({ path: authFilePath })
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
