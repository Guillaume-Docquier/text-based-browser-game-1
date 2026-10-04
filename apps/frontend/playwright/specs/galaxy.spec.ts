import { expect, test } from "../fixtures.ts"
import { CreateGamePage } from "../pages/CreateGamePage.ts"
import { LobbyPage } from "../pages/LobbyPage.ts"

test("the galaxy view distinguishes systems with claimed planets and system view labels claimed planets", async ({ alice, bob }) => {
  const aliceLobbyPage = await test.step("Create a game for Alice and Bob", async () => {
    return await CreateGamePage.createGame({
      creator: alice,
      participants: [bob],
      settings: { maxPlayers: 2 },
    })
  })

  const aliceGalaxyPage = await test.step("Start the game", async () => await aliceLobbyPage.startGame())

  const bobGalaxyPage = await test.step("Open the game from the participant lobby", async () => {
    const bobLobbyPage = new LobbyPage(bob.page)
    await bobLobbyPage.reload()
    return await bobLobbyPage.openGame()
  })

  await test.step("Distinguish each player's own and opponent-owned systems", async () => {
    await expect(aliceGalaxyPage.ownStars).toHaveCount(1)
    await expect(aliceGalaxyPage.opponentStars).toHaveCount(1)
    await expect(aliceGalaxyPage.sharedStars).toHaveCount(0)

    await expect(bobGalaxyPage.ownStars).toHaveCount(1)
    await expect(bobGalaxyPage.opponentStars).toHaveCount(1)
    await expect(bobGalaxyPage.sharedStars).toHaveCount(0)
  })

  await test.step("Label Planets with their owner or Unclaimed", async () => {
    await aliceGalaxyPage.openStarSystem(aliceGalaxyPage.ownStar(0))
    await expect(aliceGalaxyPage.ownedPlanets).toHaveCount(1)
    await expect(aliceGalaxyPage.planetOwnershipLabel(aliceGalaxyPage.ownedPlanet(0))).toHaveText(alice.alias)
    await expect(aliceGalaxyPage.unclaimedPlanets).not.toHaveCount(0)
    await expect(aliceGalaxyPage.planetOwnershipLabel(aliceGalaxyPage.unclaimedPlanet(0))).toHaveText("Unclaimed")
  })
})

test("the galaxy view can be navigated and the star system view can inspect planets", async ({ alice }) => {
  const lobbyPage = await test.step("Create a game", async () => await CreateGamePage.createGame({ creator: alice }))
  const galaxyPage = await test.step("Start the game", async () => await lobbyPage.startGame())

  const selectedStar = galaxyPage.star(1)

  await test.step("Open a Star System and inspect its Planet profiles", async () => {
    await galaxyPage.openStarSystem(selectedStar)
    await expect(galaxyPage.starSystemMap).toBeVisible()

    const firstPlanet = galaxyPage.planet("planet 72231")
    const firstPlanetName = await galaxyPage.getPlanetName(firstPlanet)
    await galaxyPage.openPlanetProfile(firstPlanet)
    expect(firstPlanetName).toBe("planet 72231")
    await expect(galaxyPage.planetDetailsPane).toBeVisible()
    await expect(galaxyPage.planetDetailsPane.getByRole("heading", { name: firstPlanetName })).toBeVisible()
    await expect(galaxyPage.planetDetailsPane).toContainText("Planet attributes")
    await expect(galaxyPage.planetDetailsPane).toContainText("Fertility")
    await expect(galaxyPage.planetDetailsPane).toContainText("Max population")
    await expect(galaxyPage.planetDetailsPane).toContainText("Coordinates")

    const secondPlanet = galaxyPage.planet("planet 73768")
    const secondPlanetName = await galaxyPage.getPlanetName(secondPlanet)
    await galaxyPage.openPlanetProfile(secondPlanet)
    expect(secondPlanetName).toBe("planet 73768")
    await expect(galaxyPage.planetDetailsPane.getByRole("heading", { name: secondPlanetName })).toBeVisible()

    await galaxyPage.clickOnTheMap()
    await expect(galaxyPage.planetDetailsPane).not.toBeVisible()
  })

  await test.step("Return to the Galaxy and reopen the Star System", async () => {
    await galaxyPage.returnToGalaxy()
    await expect(galaxyPage.heading).toBeVisible()
    await expect(galaxyPage.starSystemMap).toHaveCount(0)
    await expect(selectedStar).toBeVisible()

    await galaxyPage.openStarSystem(selectedStar)
    await expect(galaxyPage.starSystemMap).toHaveCount(1)
    await expect(galaxyPage.starSystemMap).toBeVisible()

    await galaxyPage.returnToGalaxy()
    await expect(galaxyPage.heading).toBeVisible()
    await expect(galaxyPage.starSystemMap).toHaveCount(0)
  })
})
