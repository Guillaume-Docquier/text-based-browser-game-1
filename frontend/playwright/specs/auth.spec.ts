import { clerk } from "@clerk/testing/playwright"
import { expect, test } from "../fixtures.ts"
import { HomePage } from "../pages/HomePage.ts"

test("updates the current page across sign-in and sign-out transitions", async ({ clerkConfig, page }) => {
  const homePage = await HomePage.goto(page)

  await test.step("Sign in without navigating", async () => {
    await clerk.signIn({ page, emailAddress: clerkConfig.emailAddress })

    await expect(homePage.userMenuButton).toBeVisible()
    await expect(homePage.signInLink).not.toBeVisible()
    await expect(homePage.signUpLink).not.toBeVisible()
  })

  await test.step("Sign out without navigating", async () => {
    await clerk.signOut({ page })

    await expect(homePage.signInLink).toBeVisible()
    await expect(homePage.signUpLink).toBeVisible()
    await expect(homePage.userMenuButton).not.toBeVisible()
  })
})
