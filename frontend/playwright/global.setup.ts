import { clerk, clerkSetup } from "@clerk/testing/playwright"
import { users } from "./auth.ts"
import { expect, test as setup } from "./fixtures.ts"
import { OnboardingPage } from "./pages/OnboardingPage.ts"

// Based on Clerk's docs: https://clerk.com/docs/guides/development/testing/playwright/test-authenticated-flows
setup.describe.configure({ mode: "serial" })

setup("configure Clerk testing", async ({ clerkConfig }) => {
  await clerkSetup(clerkConfig)
})

for (const [name, { email, authFilePath }] of Object.entries(users)) {
  setup(`authenticate ${name}`, async ({ page }) => {
    await page.goto("/games/create")

    const onboardingStatusResponse = page.waitForResponse((response) => response.url().includes("accounts.isOnboarded"))
    await clerk.signIn({ page, emailAddress: email })

    await onboardingStatusResponse

    const aliasOnboardingPage = new OnboardingPage(page)
    if (await aliasOnboardingPage.heading.isVisible()) {
      await aliasOnboardingPage.chooseAlias(`E2E ${name}`)
      await expect(aliasOnboardingPage.heading).not.toBeVisible()
    }

    await page.context().storageState({ path: authFilePath })
  })
}
