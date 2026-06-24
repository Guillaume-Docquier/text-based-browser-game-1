import { clerk, clerkSetup } from "@clerk/testing/playwright"
import { authFilePath } from "./authenticatedUser.ts"
import { expect, test as setup } from "./fixtures.ts"
import { CreateGamePage } from "./pages/CreateGamePage.ts"
import { HomePage } from "./pages/HomePage.ts"

// Based on Clerk's docs: https://clerk.com/docs/guides/development/testing/playwright/test-authenticated-flows
setup.describe.configure({ mode: "serial" })

setup("configure Clerk testing", async ({ clerkConfig }) => {
  await clerkSetup(clerkConfig)
})

setup("authenticate test user", async ({ clerkConfig, page }) => {
  await setup.step("Sign in the Clerk test user", async () => {
    await HomePage.goto(page)
    await clerk.signIn({ page, emailAddress: clerkConfig.emailAddress })
  })

  await setup.step("Verify access to a protected page", async () => {
    const createGamePage = await CreateGamePage.goto(page)
    await expect(page).toHaveURL(CreateGamePage.urlPattern)
    await expect(createGamePage.heading).toBeVisible()
  })

  await setup.step("Save authenticated browser state", async () => {
    await page.context().storageState({ path: authFilePath })
  })
})
