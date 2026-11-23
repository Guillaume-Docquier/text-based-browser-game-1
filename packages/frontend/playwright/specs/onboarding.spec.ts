import { expect, test } from "../fixtures.ts"
import { HomePage } from "../pages/HomePage.ts"

test("the onboarding modal is not visible for signed-out users", async ({ page }) => {
  const statusRequests: string[] = []
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.includes("accounts.isOnboarded")) {
      statusRequests.push(request.url())
    }
  })

  await test.step("Visit Home as a signed-out player", async () => {
    const homePage = await HomePage.goto(page)
    await expect(homePage.heading).toBeVisible()
    await expect(homePage.navbar.signInLink).toBeVisible()
    await expect(homePage.onboarding.dialog).not.toBeVisible()
    expect(statusRequests).toEqual([])
  })
})
