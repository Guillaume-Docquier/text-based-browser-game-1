import { DETERMINISTIC_GALAXY_SEED } from "../constants.ts"
import { expect, test } from "../fixtures.ts"
import { CreateGamePage } from "../pages/CreateGamePage.ts"
import { HomePage } from "../pages/HomePage.ts"

const onboardingStatusRoute = "**/accounts.isOnboarded*"

test.describe("onboarding", () => {
  test("keeps the requested page visible while retrying a failed status request", async ({ alice }) => {
    let statusRequestCount = 0
    await alice.page.route(onboardingStatusRoute, async (route) => {
      statusRequestCount++
      await route.fulfill({
        contentType: "application/json",
        body: "{}",
      })
    })

    const createGamePage = await CreateGamePage.goto(alice.page, { mapGenerationSeed: DETERMINISTIC_GALAXY_SEED })

    await test.step("Keep the requested page usable after the status request fails", async () => {
      await expect(createGamePage.heading).toBeVisible()
      await expect(createGamePage.onboarding.heading).not.toBeVisible()
      await createGamePage.setGameName("Status failures stay unobtrusive")
    })

    await test.step("Retry failures with a limited retry budget", async () => {
      await expect.poll(() => statusRequestCount, { timeout: 10_000 }).toBe(4)
    })

    await test.step("Do not restart retries after focus or route remounts", async () => {
      await alice.page.evaluate("document.dispatchEvent(new Event('visibilitychange')); window.dispatchEvent(new Event('focus'))")

      await createGamePage.navbar.homeLink.click()
      const homePage = new HomePage(alice.page)
      await expect(homePage.heading).toBeVisible()
      await homePage.goBack()

      await expect(createGamePage.heading).toBeVisible()
      await expect.poll(() => statusRequestCount).toBe(4)
    })

    await test.step("Do not retry after a successful mutation", async () => {
      const gameName = `Onboarding invalidation ${Date.now()}`
      await createGamePage.setGameName(gameName)
      const lobbyPage = await createGamePage.submit()
      await expect(lobbyPage.gameNameHeading).toHaveText(gameName)
      await expect.poll(() => statusRequestCount).toBe(4)
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
})
