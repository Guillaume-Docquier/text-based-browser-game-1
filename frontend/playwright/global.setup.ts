import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { clerk, clerkSetup } from "@clerk/testing/playwright"
import { FatalError } from "@guillaume-docquier/tools-ts"
import { expect, test as setup } from "@playwright/test"
import { CreateGamePage } from "./pages/CreateGamePage.ts"
import { HomePage } from "./pages/HomePage.ts"

// Based on Clerk's docs: https://clerk.com/docs/guides/development/testing/playwright/test-authenticated-flows
setup.describe.configure({ mode: "serial" })

const playwrightDirectory = dirname(fileURLToPath(import.meta.url))
const authFile = resolve(playwrightDirectory, ".clerk/user.json")

setup("configure Clerk testing", async () => {
  await clerkSetup()
})

setup("authenticate test user", async ({ page }) => {
  const emailAddress = process.env.E2E_CLERK_USER_EMAIL
  if (emailAddress === undefined || emailAddress === "") {
    throw new FatalError("E2E_CLERK_USER_EMAIL must be set in frontend/.env", { E2E_CLERK_USER_EMAIL: process.env.E2E_CLERK_USER_EMAIL })
  }

  const homePage = new HomePage(page)
  await homePage.goto()
  await clerk.signIn({ page, emailAddress })

  const createGamePage = new CreateGamePage(page)
  await createGamePage.goto()
  await expect(page).toHaveURL(/\/games\/create$/)
  await expect(createGamePage.heading).toBeVisible()

  await page.context().storageState({ path: authFile })
})
