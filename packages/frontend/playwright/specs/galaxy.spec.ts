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
  })

  await test.step("Label Planets with their owner or Unclaimed", async () => {
    await aliceGalaxyPage.openStarSystem(aliceGalaxyPage.ownStar(0))
    await bobGalaxyPage.openStarSystem(bobGalaxyPage.ownStar(0))
    await expect(bobGalaxyPage.planetOwnershipLabel(bobGalaxyPage.ownedPlanet(0))).toHaveText(bob.alias)
    await expect(aliceGalaxyPage.ownedPlanets).toHaveCount(1)
    await expect(aliceGalaxyPage.planetOwnershipLabel(aliceGalaxyPage.ownedPlanet(0))).toHaveText(alice.alias)
    await expect(aliceGalaxyPage.unclaimedPlanets).not.toHaveCount(0)
    await expect(aliceGalaxyPage.planetOwnershipLabel(aliceGalaxyPage.unclaimedPlanet(0))).toHaveText("Unclaimed")
  })
})
