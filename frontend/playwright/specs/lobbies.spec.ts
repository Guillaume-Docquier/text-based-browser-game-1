import { Time, UnitOfTime } from "@guillaume-docquier/tools-ts"
import { TEST_RULESET_NAME } from "../constants.ts"
import { expect, test } from "../fixtures.ts"
import { CreateGamePage } from "../pages/CreateGamePage.ts"
import { GalaxyPage } from "../pages/GalaxyPage.ts"
import { SignInPage } from "../pages/SignInPage.ts"

test("the game creation page redirects signed-out visitors to sign in", async ({ page }) => {
  await CreateGamePage.goto(page)

  await test.step("Verify the sign-in redirect", async () => {
    await expect(page).toHaveURL(SignInPage.urlPattern)
    const signInPage = new SignInPage(page)
    await expect(signInPage.heading).toBeVisible()
  })
})

test("the game creation form limits games to 16 players", async ({ alice }) => {
  const createGamePage = await CreateGamePage.goto(alice.page)
  await createGamePage.setGameName(`Playwright game ${Date.now()}`)

  await createGamePage.setMaxPlayers(17)
  await expect(createGamePage.createButton).toBeDisabled()

  await createGamePage.setMaxPlayers(16)
  await expect(createGamePage.createButton).toBeEnabled()
})

test("the game creation page can create a game and opens the galaxy view when starting the game", async ({ alice }) => {
  const createGamePage = await CreateGamePage.goto(alice.page)
  const gameName = `Playwright game ${Date.now()}`

  const lobbyPage = await test.step("Configure and create the game", async () => {
    await createGamePage.setGameName(gameName)
    await createGamePage.setMaxPlayers(3)
    await createGamePage.setTurnLength(Time.create(2, UnitOfTime.HOURS))
    await createGamePage.selectRuleset(TEST_RULESET_NAME)
    return await createGamePage.submit()
  })

  await test.step("Verify the lobby configuration", async () => {
    await expect(lobbyPage.gameNameHeading).toHaveText(gameName)
    await expect(lobbyPage.configurationValue("Number of seats")).toHaveText("3 players")
    await expect(lobbyPage.configurationValue("Time per turn")).toHaveText("2 hr")
    await expect(lobbyPage.configurationValue("Ruleset")).toContainText(TEST_RULESET_NAME)
  })

  const galaxyPage = await test.step("Start the game", async () => {
    return await lobbyPage.startGame()
  })

  await test.step("Verify the Galaxy opens", async () => {
    await expect(alice.page).toHaveURL(GalaxyPage.urlPattern)
    await expect(galaxyPage.heading).toBeVisible()
    await expect(galaxyPage.map).toBeVisible()
  })
})
