import { clerk } from "@clerk/testing/playwright"
import { aliceUser } from "../authenticatedUser.ts"
import { expect, test } from "../fixtures.ts"
import { CreateGamePage } from "../pages/CreateGamePage.ts"
import { GamesBrowserPage } from "../pages/GamesBrowserPage.ts"
import { HomePage } from "../pages/HomePage.ts"

test.describe("authenticated user", () => {
  test.use(aliceUser)

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
      const gamesBrowserPage = await GamesBrowserPage.goto(page)
      await expect(gamesBrowserPage.game(gameName)).toBeVisible()
      await expect(gamesBrowserPage.myGamesButton).not.toBeVisible()
    })

    await test.step("Sign in and show only the player's games", async () => {
      const gamesBrowserPage = new GamesBrowserPage(page)
      await clerk.signIn({ page, emailAddress: clerkConfig.emails.alice })
      await gamesBrowserPage.myGamesButton.click()
      await expect(gamesBrowserPage.myGamesButton).toHaveAttribute("aria-pressed", "true")
      await expect(gamesBrowserPage.game(gameName)).toBeVisible()
    })
  })
})
