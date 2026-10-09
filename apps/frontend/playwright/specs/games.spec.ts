import { Time, UnitOfTime } from "@guillaume-docquier/tools-ts"
import { TEST_RULESET_NAME } from "../constants.ts"
import { expect, test } from "../fixtures.ts"
import { CreateGamePage } from "../pages/CreateGamePage.ts"
import { GalaxyPage } from "../pages/GalaxyPage.ts"
import { GameSummariesPage } from "../pages/GameSummariesPage.ts"
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

  const gameDetailsPage = await test.step("Configure and create the game", async () => {
    await createGamePage.setGameName(gameName)
    await createGamePage.setMaxPlayers(3)
    await createGamePage.setTurnLength(Time.create(2, UnitOfTime.HOURS))
    await createGamePage.selectRuleset(TEST_RULESET_NAME)
    return await createGamePage.submit()
  })

  await test.step("Verify the game configuration", async () => {
    await expect(gameDetailsPage.gameNameHeading).toHaveText(gameName)
    await expect(gameDetailsPage.configurationValue("Number of seats")).toHaveText("3 players")
    await expect(gameDetailsPage.configurationValue("Time per turn")).toHaveText("2 hr")
    await expect(gameDetailsPage.configurationValue("Ruleset")).toContainText(TEST_RULESET_NAME)
  })

  const galaxyPage = await test.step("Start the game", async () => {
    return await gameDetailsPage.startGame()
  })

  await test.step("Verify the Galaxy opens", async () => {
    await expect(alice.page).toHaveURL(GalaxyPage.urlPattern)
    await expect(galaxyPage.heading).toBeVisible()
    await expect(galaxyPage.map).toBeVisible()
  })
})

test("the game summaries page filters by name and by player membership for signed in users", async ({ page, alice, bob }) => {
  const aliceGameName = `Playwright game ${Date.now()}-alice`
  const bobGameName = `Playwright game ${Date.now()}-bob`

  const aliceGameDetailsPage = await test.step("Create a game as Alice", async () => {
    return await CreateGamePage.createGame({ creator: alice, settings: { gameName: aliceGameName } })
  })

  await test.step("Verify Alice's game", async () => {
    await expect(aliceGameDetailsPage.gameNameHeading).toHaveText(aliceGameName)
  })

  const bobGameDetailsPage = await test.step("Create a game as Bob", async () => {
    return await CreateGamePage.createGame({ creator: bob, settings: { gameName: bobGameName } })
  })

  await test.step("Verify Bob's game", async () => {
    await expect(bobGameDetailsPage.gameNameHeading).toHaveText(bobGameName)
  })

  await test.step("Load the games anonymously", async () => {
    const gameSummariesPage = await GameSummariesPage.goto(page)
    await expect(gameSummariesPage.gameSummary(aliceGameName)).toBeVisible()
    await expect(gameSummariesPage.gameSummary(bobGameName)).toBeVisible()
    await expect(gameSummariesPage.myGamesButton).not.toBeVisible()
  })

  const aliceGameSummariesPage = await GameSummariesPage.goto(alice.page)
  await test.step("Filter Alice's games by name", async () => {
    await aliceGameSummariesPage.filterByName(bobGameName)
    await expect(aliceGameSummariesPage.gameSummary(aliceGameName)).not.toBeVisible()
    await expect(aliceGameSummariesPage.gameSummary(bobGameName)).toBeVisible()
  })

  await test.step("... and by my games", async () => {
    await aliceGameSummariesPage.filterToMyGames()
    await expect(aliceGameSummariesPage.myGamesButton).toHaveAttribute("aria-pressed", "true")
    await expect(aliceGameSummariesPage.gameSummary(aliceGameName)).not.toBeVisible()
    await expect(aliceGameSummariesPage.gameSummary(bobGameName)).not.toBeVisible()
  })

  await test.step("... by my games only", async () => {
    await aliceGameSummariesPage.filterByName("")
    await expect(aliceGameSummariesPage.gameSummary(aliceGameName)).toBeVisible()
    await expect(aliceGameSummariesPage.gameSummary(bobGameName)).not.toBeVisible()
  })

  await test.step("Filter Bob's games", async () => {
    const gameSummariesPage = await GameSummariesPage.goto(bob.page)
    await gameSummariesPage.filterToMyGames()
    await expect(gameSummariesPage.myGamesButton).toHaveAttribute("aria-pressed", "true")
    await expect(gameSummariesPage.gameSummary(aliceGameName)).not.toBeVisible()
    await expect(gameSummariesPage.gameSummary(bobGameName)).toBeVisible()
  })
})
