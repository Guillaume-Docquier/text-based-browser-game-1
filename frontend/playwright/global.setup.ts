import { clerk, clerkSetup } from "@clerk/testing/playwright"
import { users } from "./auth.ts"
import { test as setup } from "./fixtures.ts"
import { HomePage } from "./pages/HomePage.ts"

// Based on Clerk's docs: https://clerk.com/docs/guides/development/testing/playwright/test-authenticated-flows
setup.describe.configure({ mode: "serial" })

setup("configure Clerk testing", async ({ clerkConfig }) => {
  await clerkSetup(clerkConfig)
})

for (const [name, { email, authFilePath }] of Object.entries(users)) {
  setup(`authenticate ${name}`, async ({ page }) => {
    await HomePage.goto(page)
    await clerk.signIn({ page, emailAddress: email })
    await page.context().storageState({ path: authFilePath })
  })
}
