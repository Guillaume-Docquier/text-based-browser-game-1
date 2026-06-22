import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { clerk, clerkSetup } from "@clerk/testing/playwright"
import { expect, test as setup } from "@playwright/test"

setup.describe.configure({ mode: "serial" })

const playwrightDirectory = dirname(fileURLToPath(import.meta.url))
const authFile = resolve(playwrightDirectory, ".clerk/user.json")

setup("configure Clerk testing", async () => {
  await clerkSetup()
})

setup("authenticate test user", async ({ page }) => {
  const emailAddress = process.env.E2E_CLERK_USER_EMAIL
  if (emailAddress === undefined || emailAddress === "") {
    throw new Error("E2E_CLERK_USER_EMAIL must be set in frontend/.env")
  }

  await page.goto("/")
  await clerk.signIn({ page, emailAddress })
  await page.goto("/games/create")

  await expect(page).toHaveURL(/\/games\/create$/)
  await expect(page.getByRole("heading", { name: "Create a new game" })).toBeVisible()

  await page.context().storageState({ path: authFile })
})
