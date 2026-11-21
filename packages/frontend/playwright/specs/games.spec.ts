import { Time, UnitOfTime } from "@guillaume-docquier/tools-ts"
import { expect, test } from "../fixtures.ts"
import { CreateGamePage } from "../pages/CreateGamePage.ts"
import { GalaxyPage } from "../pages/GalaxyPage.ts"
import { GameListingsPage } from "../pages/GameListingsPage.ts"

test("a player can create a game with 16 seats and start it", async ({ alice }) => {
  const gameName = "Playwright configured game"

  const gameDetailsPage = await test.step("Correct the seat limit and create the game", async () => {
    const createGamePage = await CreateGamePage.goto(alice.page)
    await createGamePage.setGameName(gameName)
    await createGamePage.setTurnLength(Time.create(2, UnitOfTime.HOURS))

    await createGamePage.setMaxPlayers(17)
    await expect(createGamePage.createButton).toBeDisabled()
    await createGamePage.setMaxPlayers(16)

    const gameDetailsPage = await createGamePage.submit()
    await expect(gameDetailsPage.gameNameHeading).toHaveText(gameName)
    await expect(gameDetailsPage.configurationValue("Number of seats")).toHaveText("16 players")
    await expect(gameDetailsPage.configurationValue("Time per turn")).toHaveText("2 hr")
    return gameDetailsPage
  })

  await test.step("Start the game and see its Galaxy", async () => {
    const galaxyPage = await gameDetailsPage.startGame()
    await expect(alice.page).toHaveURL(GalaxyPage.urlPattern)
    await expect(galaxyPage.gameNameHeading).toHaveText(gameName)
    await expect(galaxyPage.map).toBeVisible()
  })
})

test("a signed-in player can filter game listings by name and membership", async ({ page, alice, bob }) => {
  const listingGroup = `Listings ${crypto.randomUUID()}`
  const aliceGameName = `${listingGroup} Alice`
  const bobGameName = `${listingGroup} Bob`

  await test.step("Create separate games for Alice and Bob and find both in the public listings", async () => {
    await CreateGamePage.createGame({ creator: alice, settings: { gameName: aliceGameName } })
    await CreateGamePage.createGame({ creator: bob, settings: { gameName: bobGameName } })
    const listings = await GameListingsPage.goto(page)
    await expect(listings.gameListing(aliceGameName)).toBeVisible()
    await expect(listings.gameListing(bobGameName)).toBeVisible()
  })

  const aliceListings = await test.step("Search for Bob's game as Alice", async () => {
    const listings = await GameListingsPage.goto(alice.page)
    await listings.filterByName(bobGameName)
    await expect(listings.gameListing(bobGameName)).toBeVisible()
    await expect(listings.gameListing(aliceGameName)).not.toBeVisible()
    return listings
  })

  await test.step("Enable My games while the search still matches Bob's game", async () => {
    await aliceListings.toggleMyGamesFilter()
    await expect(aliceListings.noMatchingGames).toBeVisible()
  })

  await test.step("Clear the search and view Alice's games", async () => {
    await aliceListings.filterByName("")
    await expect(aliceListings.gameListing(aliceGameName)).toBeVisible()
    await expect(aliceListings.gameListing(bobGameName)).not.toBeVisible()
  })

  await test.step("Turn off My games to see Bob's game again", async () => {
    await aliceListings.toggleMyGamesFilter()
    await expect(aliceListings.gameListing(bobGameName)).toBeVisible()
  })
})
