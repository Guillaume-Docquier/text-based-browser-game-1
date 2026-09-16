import { aliceUser } from "../auth.ts"
import { expect, test } from "../fixtures.ts"
import { CreateGamePage } from "../pages/CreateGamePage.ts"
import { HomePage } from "../pages/HomePage.ts"
import { OnboardingPage } from "../pages/OnboardingPage.ts"

const onboardingStatusRoute = "**/accounts.isOnboarded*"

test.describe("onboarding", () => {
  test.use(aliceUser)

  test("keeps the requested page visible while status is loading", async ({ page }) => {
    let releaseStatusRequest: (() => void) | undefined
    let markStatusRequestStarted: (() => void) | undefined
    const statusRequestReleased = new Promise<void>((resolve) => {
      releaseStatusRequest = resolve
    })
    const statusRequestStarted = new Promise<void>((resolve) => {
      markStatusRequestStarted = resolve
    })

    await page.route(onboardingStatusRoute, async (route) => {
      markStatusRequestStarted?.()
      await statusRequestReleased
      await route.continue()
    })

    const createGamePage = await CreateGamePage.goto(page, { mapGenerationSeed: 9012 })
    await statusRequestStarted

    await test.step("Use the requested page while onboarding status is pending", async () => {
      await expect(createGamePage.heading).toBeVisible()
      await expect(new OnboardingPage(page).heading).not.toBeVisible()
      await createGamePage.setGameName("Status can load in the background")
    })

    releaseStatusRequest?.()
    await expect(createGamePage.heading).toBeVisible()
  })

  test("keeps the requested page visible after a failed status request", async ({ page }) => {
    let statusRequestCount = 0
    await page.route(onboardingStatusRoute, async (route) => {
      statusRequestCount++
      await route.fulfill({
        contentType: "application/json",
        body: "{}",
      })
    })

    const createGamePage = await CreateGamePage.goto(page, { mapGenerationSeed: 9013 })
    const aliasOnboardingPage = new OnboardingPage(page)

    await test.step("Keep the requested page usable after the status request fails", async () => {
      await expect(createGamePage.heading).toBeVisible()
      await expect(aliasOnboardingPage.heading).not.toBeVisible()
      await createGamePage.setGameName("Status failures stay unobtrusive")
    })

    await test.step("Do not retry after focus or route remounts", async () => {
      await page.evaluate("document.dispatchEvent(new Event('visibilitychange')); window.dispatchEvent(new Event('focus'))")

      await createGamePage.navbar.homeLink.click()
      await expect(new HomePage(page).heading).toBeVisible()
      await page.goBack()
      await expect(createGamePage.heading).toBeVisible()
      await expect.poll(() => statusRequestCount).toBe(1)
    })
  })
})

test("does not request onboarding status for signed-out visitors", async ({ page }) => {
  let statusRequestCount = 0
  await page.route(onboardingStatusRoute, async (route) => {
    statusRequestCount++
    await route.abort()
  })

  const homePage = await HomePage.goto(page)
  await expect(homePage.heading).toBeVisible()
  await expect.poll(() => statusRequestCount).toBe(0)
})
