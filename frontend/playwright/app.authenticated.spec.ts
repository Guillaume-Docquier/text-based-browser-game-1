import { expect, test } from "@playwright/test"
import { CreateGamePage } from "./pages/CreateGamePage.ts"
import { LobbyPage } from "./pages/LobbyPage.ts"

test("creates a game as an authenticated user", async ({ page }) => {
  const createGamePage = new CreateGamePage(page)
  await createGamePage.goto()

  const gameName = `Playwright game ${Date.now()}`

  await expect(createGamePage.userMenuButton).toBeVisible()
  await createGamePage.setGameName(gameName)
  await createGamePage.setMaxPlayers(2)
  await createGamePage.submit()

  await expect(page).toHaveURL(/\/games\/\d+$/)
  const gameId = Number(page.url().split("/").at(-1))

  const lobbyPage = new LobbyPage(page, gameId, gameName)
  await expect(lobbyPage.gameNameHeading).toBeVisible()
  await expect(lobbyPage.startGameButton).toBeVisible()
})
