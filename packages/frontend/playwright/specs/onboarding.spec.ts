import { expect, test } from "../fixtures.ts"
import { HomePage } from "../pages/HomePage.ts"

const onboardingStatusRoute = "**/accounts.isOnboarded*"

test("the onboarding modal appears after the first successful status request", async ({ alice }) => {
  let statusRequestCount = 0
  await alice.page.route(onboardingStatusRoute, async (route) => {
    statusRequestCount++
    await route.fulfill({ json: [{ result: { data: false } }] })
  })

  const homePage = await HomePage.goto(alice.page)

  await test.step("Prompt for an alias without waiting for another status request", async () => {
    await expect(homePage.onboarding.heading).toBeVisible()
    expect(statusRequestCount).toBe(1)
  })
})

test("the onboarding modal is not visible for signed-out users", async ({ page }) => {
  let statusRequestCount = 0
  await page.route(onboardingStatusRoute, async (route) => {
    statusRequestCount++
    await route.abort()
  })

  const homePage = await HomePage.goto(page)
  await expect(homePage.heading).toBeVisible()
  await expect(homePage.navbar.signInLink).toBeVisible()
  await expect(homePage.onboarding.heading).not.toBeVisible()
  expect(statusRequestCount).toBe(0)
})
