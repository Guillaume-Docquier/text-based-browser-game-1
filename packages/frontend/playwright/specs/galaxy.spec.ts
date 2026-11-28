import { expect, test } from "../fixtures.ts"
import { CreateGamePage } from "../pages/CreateGamePage.ts"
import { GameDetailsPage } from "../pages/GameDetailsPage.ts"

test("the galaxy view distinguishes systems with claimed planets and system view labels claimed planets", async ({ alice, bob }) => {
  const aliceGameDetailsPage = await test.step("Create a game for Alice and Bob", async () => {
    return await CreateGamePage.createGame({
      creator: alice,
      participants: [bob],
      settings: { maxPlayers: 2 },
    })
  })

  const aliceGalaxyPage = await test.step("Start the game", async () => await aliceGameDetailsPage.startGame())

  const bobGalaxyPage = await test.step("Open the game from the participant's game details page", async () => {
    const bobGameDetailsPage = new GameDetailsPage(bob.page)
    await bobGameDetailsPage.reload()
    return await bobGameDetailsPage.openGame()
  })

  await test.step("Distinguish each player's own and opponent-owned systems", async () => {
    await expect(aliceGalaxyPage.ownStars).toHaveCount(1)
    await expect(aliceGalaxyPage.opponentStars).toHaveCount(1)
    await expect(aliceGalaxyPage.sharedStars).toHaveCount(0)

    await expect(bobGalaxyPage.ownStars).toHaveCount(1)
    await expect(bobGalaxyPage.opponentStars).toHaveCount(1)
    await expect(bobGalaxyPage.sharedStars).toHaveCount(0)

    await aliceGalaxyPage.openStarSystem(aliceGalaxyPage.ownStar(0))
    await expect(aliceGalaxyPage.systemHeading).toBeVisible()
    const aliceSystemName = await aliceGalaxyPage.systemHeading.innerText()
    await expect(bobGalaxyPage.opponentSystem(aliceSystemName)).toBeVisible()
  })

  await test.step("Label Planets with their owner or Unclaimed", async () => {
    await expect(aliceGalaxyPage.ownedPlanets).toHaveCount(1)
    await expect(aliceGalaxyPage.planetOwnershipLabel(aliceGalaxyPage.ownedPlanet(0))).toHaveText(alice.alias)
    await expect(aliceGalaxyPage.unclaimedPlanets).not.toHaveCount(0)
    await expect(aliceGalaxyPage.planetOwnershipLabel(aliceGalaxyPage.unclaimedPlanet(0))).toHaveText("Unclaimed")
  })
})

test("the galaxy view can be navigated and the star system view can inspect planets", async ({ alice }) => {
  const gameDetailsPage = await test.step("Create a game", async () => await CreateGamePage.createGame({ creator: alice }))
  const galaxyPage = await test.step("Start the game", async () => await gameDetailsPage.startGame())

  const selectedStar = galaxyPage.starNamed("star 35076")

  await test.step("Open a Star System and inspect its Planet profiles", async () => {
    await galaxyPage.openStarSystem(selectedStar)
    await expect(galaxyPage.starSystemMap).toBeVisible()

    await galaxyPage.openPlanetProfile(galaxyPage.planet("planet 415673"))
    await expect(galaxyPage.planetProfileHeading("planet 415673")).toBeVisible()
    await expect(galaxyPage.planetDetailsPane).toContainText("Planet attributes")
    await expect(galaxyPage.planetAttribute("Metal production per mine per turn")).toHaveText("0")
    await expect(galaxyPage.planetAttribute("Remaining metal deposit")).toHaveText("0")
    await expect(galaxyPage.planetDetailsPane).toContainText("Coordinates")

    await galaxyPage.openPlanetProfile(galaxyPage.planet("planet 272683"))
    await expect(galaxyPage.planetProfileHeading("planet 272683")).toBeVisible()
    await expect(galaxyPage.planetAttribute("Metal production per mine per turn")).toHaveText("4")
    await expect(galaxyPage.planetAttribute("Remaining metal deposit")).toHaveText("19")

    await galaxyPage.clickOnTheMap()
    await expect(galaxyPage.planetDetailsPane).not.toBeVisible()
  })

  await test.step("Return to the Galaxy and reopen the Star System", async () => {
    await galaxyPage.returnToGalaxy()
    await expect(galaxyPage.heading).toBeVisible()
    await expect(galaxyPage.starSystemMap).toHaveCount(0)

    await expect(selectedStar).toBeVisible()
    await galaxyPage.openStarSystem(selectedStar)
    await expect(galaxyPage.starSystemMap).toBeVisible()

    await galaxyPage.returnToGalaxy()
    await expect(galaxyPage.heading).toBeVisible()
    await expect(galaxyPage.starSystemMap).toHaveCount(0)
  })
})
