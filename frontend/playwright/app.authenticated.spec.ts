import { expect, test } from "@playwright/test"
import { CreateGamePage } from "./pages/CreateGamePage.ts"
import { LobbyPage } from "./pages/LobbyPage.ts"

test("creates a game as an authenticated user", async ({ page }) => {
  const createGamePage = await CreateGamePage.goto(page)

  const gameName = `Playwright game ${Date.now()}`

  await expect(createGamePage.userMenuButton).toBeVisible()
  await createGamePage.setGameName(gameName)
  await createGamePage.setMaxPlayers(2)
  await createGamePage.submit()

  const lobbyPage = new LobbyPage(page)
  await expect(lobbyPage.gameNameHeading).toHaveText(gameName)
  await expect(lobbyPage.startGameButton).toBeVisible()
})
