import { expect, test } from "../fixtures.ts"
import { CreateGamePage } from "../pages/CreateGamePage.ts"
import { HomePage } from "../pages/HomePage.ts"

const onboardingStatusRoute = "**/accounts.isOnboarded*"

test("an account that needs an alias sees onboarding on its first status response", async ({ alice }) => {
  let statusRequests = 0
  await alice.page.route(onboardingStatusRoute, async (route) => {
    statusRequests++
    await route.fulfill({ json: [{ result: { data: false } }] })
  })

  await test.step("Open the home page and receive the alias prompt", async () => {
    const homePage = await HomePage.goto(alice.page)
    await expect(homePage.onboarding.heading).toBeVisible()
    expect(statusRequests).toBe(1)
  })
})

test.describe("onboarding status request failures", () => {
  const expectedError = /^\[alice\] console error: .*ERROR: API request failed .*path: accounts\.isOnboarded, type: query,/
  test.use({ expectedBrowserDiagnostics: { messages: [expectedError, expectedError, expectedError, expectedError] } })

  test("a player can create a game after onboarding status retries are exhausted", async ({ alice }) => {
    let statusRequests = 0
    await alice.page.route(onboardingStatusRoute, async (route) => {
      statusRequests++
      await route.fulfill({ json: {} })
    })

    const gameName = "Playwright game during onboarding outage"
    const createGamePage = await test.step("Begin creating a game while the status endpoint fails", async () => {
      const createGame = await CreateGamePage.goto(alice.page)
      await createGame.setGameName(gameName)
      await expect(createGame.onboarding.heading).not.toBeVisible()
      await expect.poll(() => statusRequests, { timeout: 10_000 }).toBe(4)
      return createGame
    })

    const newGamePage = await test.step("Leave and return to game creation without restarting onboarding", async () => {
      const homePage = await createGamePage.navbar.openHome()
      const gamesPage = await homePage.playForFree()
      const newGame = await gamesPage.createGame()
      await newGame.setGameName(gameName)
      await expect(newGame.onboarding.heading).not.toBeVisible()
      return newGame
    })

    await test.step("Create the game without starting another status request", async () => {
      const gameDetailsPage = await newGamePage.submit()
      await expect(gameDetailsPage.gameNameHeading).toHaveText(gameName)
      await expect(gameDetailsPage.onboarding.heading).not.toBeVisible()
      expect(statusRequests).toBe(4)
    })
  })
})
