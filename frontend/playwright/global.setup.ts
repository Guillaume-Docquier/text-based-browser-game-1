import { clerk, clerkSetup } from "@clerk/testing/playwright"
import { FatalError } from "@guillaume-docquier/tools-ts"
import { expect, test as setup } from "@playwright/test"
import { authFilePath } from "./authenticatedUser.ts"
import { CreateGamePage } from "./pages/CreateGamePage.ts"
import { HomePage } from "./pages/HomePage.ts"

// Based on Clerk's docs: https://clerk.com/docs/guides/development/testing/playwright/test-authenticated-flows
setup.describe.configure({ mode: "serial" })

setup("configure Clerk testing", async () => {
  await clerkSetup()
})

setup("authenticate test user", async ({ page }) => {
  const emailAddress = process.env.E2E_CLERK_USER_EMAIL
  if (emailAddress === undefined || emailAddress === "") {
    throw new FatalError("E2E_CLERK_USER_EMAIL must be set in frontend/.env", { E2E_CLERK_USER_EMAIL: process.env.E2E_CLERK_USER_EMAIL })
  }

  await setup.step("Sign in the Clerk test user", async () => {
    await HomePage.goto(page)
    await clerk.signIn({ page, emailAddress })
  })

  await setup.step("Verify access to a protected page", async () => {
    const createGamePage = await CreateGamePage.goto(page)
    await expect(page).toHaveURL(/\/games\/create$/)
    await expect(createGamePage.heading).toBeVisible()
  })

  await setup.step("Save authenticated browser state", async () => {
    await page.context().storageState({ path: authFilePath })
  })
})
