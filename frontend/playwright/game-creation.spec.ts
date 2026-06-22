import { expect, test } from "@playwright/test"
import { authenticatedUser } from "./authenticatedUser.ts"
import { CreateGamePage } from "./pages/CreateGamePage.ts"
import { LobbyPage } from "./pages/LobbyPage.ts"
import { SignInPage } from "./pages/SignInPage.ts"

test.describe("anonymous user", () => {
  test("redirects to sign in", async ({ page }) => {
    await CreateGamePage.goto(page)

    await test.step("Verify the sign-in redirect", async () => {
      await expect(page).toHaveURL(/\/sign-in\?redirect=%2Fgames%2Fcreate$/)
      const signInPage = new SignInPage(page)
      await expect(signInPage.heading).toBeVisible()
    })
  })
})

test.describe("authenticated user", () => {
  test.use(authenticatedUser)

  test("creates a game", async ({ page }) => {
    const createGamePage = await CreateGamePage.goto(page)
    const gameName = `Playwright game ${Date.now()}`

    await test.step("Configure the game", async () => {
      await expect(createGamePage.userMenuButton).toBeVisible()
      await createGamePage.setGameName(gameName)
      await createGamePage.setMaxPlayers(2)
    })

    await test.step("Create the game", async () => {
      await createGamePage.submit()
    })

    await test.step("Verify the created lobby", async () => {
      const lobbyPage = new LobbyPage(page)
      await expect(lobbyPage.gameNameHeading).toHaveText(gameName)
      await expect(lobbyPage.startGameButton).toBeVisible()
    })
  })
})
