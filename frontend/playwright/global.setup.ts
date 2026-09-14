import { clerk, clerkSetup } from "@clerk/testing/playwright"
import { users } from "./auth.ts"
import { expect, test as setup } from "./fixtures.ts"
import { AliasOnboardingPage } from "./pages/AliasOnboardingPage.ts"
import { HomePage } from "./pages/HomePage.ts"

// Based on Clerk's docs: https://clerk.com/docs/guides/development/testing/playwright/test-authenticated-flows
setup.describe.configure({ mode: "serial" })

setup("configure Clerk testing", async ({ clerkConfig }) => {
  await clerkSetup(clerkConfig)
})

for (const [name, { email, authFilePath }] of Object.entries(users)) {
  setup(`authenticate ${name}`, async ({ page }) => {
    const homePage = await HomePage.goto(page)
    await clerk.signIn({ page, emailAddress: email })
    const aliasOnboardingPage = new AliasOnboardingPage(page)
    await expect(aliasOnboardingPage.heading.or(homePage.navbar.userMenuButton)).toBeVisible()

    if (await aliasOnboardingPage.heading.isVisible()) {
      await expect(page).toHaveURL(HomePage.urlPattern)
      await aliasOnboardingPage.chooseAlias(`E2E ${name}`)
    }

    await expect(homePage.heading).toBeVisible()
    await page.context().storageState({ path: authFilePath })
  })
}
