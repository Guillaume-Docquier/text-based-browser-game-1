import { clerk } from "@clerk/testing/playwright"
import { authenticatedUser } from "../authenticatedUser.ts"
import { expect, test } from "../fixtures.ts"
import { CreateGamePage } from "../pages/CreateGamePage.ts"
import { GamesPage } from "../pages/GamesPage.ts"
import { HomePage } from "../pages/HomePage.ts"

test.describe("authenticated user", () => {
  test.use(authenticatedUser)

  test("filters to games the player joined after signing in", async ({ clerkConfig, page }) => {
    const gameName = `Playwright game ${Date.now()}`

    await test.step("Create a game", async () => {
      const createGamePage = await CreateGamePage.goto(page)
      await createGamePage.setGameName(gameName)
      const lobbyPage = await createGamePage.submit()
      await expect(lobbyPage.gameNameHeading).toHaveText(gameName)
      await clerk.signOut({ page })
      await expect(page).toHaveURL(HomePage.urlPattern)
    })

    await test.step("Load the games anonymously", async () => {
      const gamesPage = await GamesPage.goto(page)
      await expect(gamesPage.game(gameName)).toBeVisible()
      await expect(gamesPage.myGamesButton).not.toBeVisible()
    })

    await test.step("Sign in and show only the player's games", async () => {
      const gamesPage = new GamesPage(page)
      await clerk.signIn({ page, emailAddress: clerkConfig.emailAddress })
      await gamesPage.myGamesButton.click()
      await expect(gamesPage.myGamesButton).toHaveAttribute("aria-pressed", "true")
      await expect(gamesPage.game(gameName)).toBeVisible()
    })
  })
})
