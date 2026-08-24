import { clerk, clerkSetup } from "@clerk/testing/playwright"
import { users } from "./auth.ts"
import { expect, test as setup } from "./fixtures.ts"
import { CreateGamePage } from "./pages/CreateGamePage.ts"
import { HomePage } from "./pages/HomePage.ts"

// Based on Clerk's docs: https://clerk.com/docs/guides/development/testing/playwright/test-authenticated-flows
setup.describe.configure({ mode: "serial" })

setup("configure Clerk testing", async ({ clerkConfig }) => {
  await clerkSetup(clerkConfig)
})

for (const [name, { email, authFilePath }] of Object.entries(users)) {
  setup(`authenticate ${name}`, async ({ page }) => {
    await setup.step(`Sign in ${name}`, async () => {
      await HomePage.goto(page)
      await clerk.signIn({ page, emailAddress: email })
    })

    await setup.step("Verify access to a protected page", async () => {
      const createGamePage = await CreateGamePage.goto(page)
      await expect(page).toHaveURL(CreateGamePage.urlPattern)
      await expect(createGamePage.heading).toBeVisible()
    })

    await setup.step(`Save ${name}'s authenticated browser state`, async () => {
      await page.context().storageState({ path: authFilePath })
    })
  })
}
