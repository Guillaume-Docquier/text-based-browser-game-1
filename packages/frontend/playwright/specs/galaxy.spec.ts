import { expect, test } from "../fixtures.ts"
import { CreateGamePage } from "../pages/CreateGamePage.ts"
import { GameDetailsPage } from "../pages/GameDetailsPage.ts"

test("players see which Star Systems and Planets they own", async ({ alice, bob }) => {
  const aliceGalaxy = await test.step("Alice starts a game with Bob", async () => {
    const gameDetails = await CreateGamePage.createGame({
      creator: alice,
      participants: [bob],
      settings: { maxPlayers: 2 },
    })
    return await gameDetails.startGame()
  })

  await test.step("Alice and Bob each see their own and their opponent's Star System", async () => {
    const bobGameDetails = new GameDetailsPage(bob.page)
    await bobGameDetails.reload()
    const bobGalaxy = await bobGameDetails.openGame()

    await expect(aliceGalaxy.ownStars).toHaveCount(1)
    await expect(aliceGalaxy.opponentStars).toHaveCount(1)
    await expect(bobGalaxy.ownStars).toHaveCount(1)
    await expect(bobGalaxy.opponentStars).toHaveCount(1)
  })

  await test.step("Alice sees her alias and the unclaimed planets in her Star System", async () => {
    await aliceGalaxy.openStarSystem(aliceGalaxy.ownStar())
    await expect(aliceGalaxy.starSystemMap.getByText(alice.alias, { exact: true })).toBeVisible()
    await expect(aliceGalaxy.starSystemMap.getByText("Unclaimed", { exact: true }).first()).toBeVisible()
  })
})

test("a player can inspect a planet and return to the Galaxy", async ({ alice }) => {
  const galaxyPage = await test.step("Start a game and open a Star System", async () => {
    const gameDetails = await CreateGamePage.createGame({ creator: alice })
    const galaxy = await gameDetails.startGame()
    await galaxy.openStarSystem(galaxy.star("star 83697"))
    await expect(galaxy.starSystemMap).toHaveAccessibleName("star 83697 Star System map")
    return galaxy
  })

  await test.step("Inspect planet 72231 and then switch to planet 73768", async () => {
    await galaxyPage.openPlanetProfile(galaxyPage.planet("planet 72231"))
    await expect(galaxyPage.planetDetails("planet 72231")).toContainText("63:50:10")
    await galaxyPage.openPlanetProfile(galaxyPage.planet("planet 73768"))
    await expect(galaxyPage.planetDetails("planet 73768")).toBeVisible()
    await expect(galaxyPage.planetDetails("planet 72231")).not.toBeVisible()
  })

  await test.step("Return to the Galaxy and reopen the same Star System", async () => {
    await galaxyPage.returnToGalaxy()
    await expect(galaxyPage.starSystemMap).toHaveCount(0)
    await galaxyPage.openStarSystem(galaxyPage.star("star 83697"))
    await expect(galaxyPage.starSystemMap).toHaveAccessibleName("star 83697 Star System map")
    await expect(galaxyPage.planet("planet 73768")).toBeVisible()
  })
})
