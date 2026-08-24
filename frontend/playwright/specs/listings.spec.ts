import { expect, test } from "../fixtures.ts"
import { CreateGamePage } from "../pages/CreateGamePage.ts"
import { GamesBrowserPage } from "../pages/GamesBrowserPage.ts"

test("filters to games the player joined after signing in", async ({ page, alice, bob }) => {
  const aliceGameName = `Playwright game ${Date.now()}-alice`
  const bobGameName = `Playwright game ${Date.now()}-bob`

  await test.step("Create a game as Alice", async () => {
    const createGamePage = await CreateGamePage.goto(alice.page)
    await createGamePage.setGameName(aliceGameName)
    const lobbyPage = await createGamePage.submit()
    await expect(lobbyPage.gameNameHeading).toHaveText(aliceGameName)
  })

  await test.step("Create a game as Bob", async () => {
    const createGamePage = await CreateGamePage.goto(bob.page)
    await createGamePage.setGameName(bobGameName)
    const lobbyPage = await createGamePage.submit()
    await expect(lobbyPage.gameNameHeading).toHaveText(bobGameName)
  })

  await test.step("Load the games anonymously", async () => {
    const gamesBrowserPage = await GamesBrowserPage.goto(page)
    await expect(gamesBrowserPage.game(aliceGameName)).toBeVisible()
    await expect(gamesBrowserPage.game(bobGameName)).toBeVisible()
    await expect(gamesBrowserPage.myGamesButton).not.toBeVisible()
  })

  await test.step("Filter Alice's games", async () => {
    const gamesBrowserPage = await GamesBrowserPage.goto(alice.page)
    await gamesBrowserPage.filterToMyGames()
    await expect(gamesBrowserPage.myGamesButton).toHaveAttribute("aria-pressed", "true")
    await expect(gamesBrowserPage.game(aliceGameName)).toBeVisible()
    await expect(gamesBrowserPage.game(bobGameName)).not.toBeVisible()
  })

  await test.step("Filter Bob's games", async () => {
    const gamesBrowserPage = await GamesBrowserPage.goto(bob.page)
    await gamesBrowserPage.filterToMyGames()
    await expect(gamesBrowserPage.myGamesButton).toHaveAttribute("aria-pressed", "true")
    await expect(gamesBrowserPage.game(aliceGameName)).not.toBeVisible()
    await expect(gamesBrowserPage.game(bobGameName)).toBeVisible()
  })
})
