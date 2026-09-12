import { expect, test } from "../fixtures.ts"
import { CreateGamePage } from "../pages/CreateGamePage.ts"
import { LobbyPage } from "../pages/LobbyPage.ts"

const DETERMINISTIC_GALAXY_SEED = 1234

test("shows claimed systems and Planet owners", async ({ alice, bob }) => {
  const aliceLobbyPage = await test.step("Alice creates a two-player game", async () => {
    const createGamePage = await CreateGamePage.goto(alice.page, { mapGenerationSeed: DETERMINISTIC_GALAXY_SEED })
    await createGamePage.setGameName(`Galaxy ownership ${Date.now()}`)
    await createGamePage.setMaxPlayers(2)
    await createGamePage.selectRuleset("Test")
    return await createGamePage.submit()
  })

  const bobLobbyPage = await test.step("Bob joins Alice's lobby", async () => {
    const lobbyPage = await LobbyPage.goto(bob.page, await aliceLobbyPage.getGameId())
    await lobbyPage.joinGame()
    return lobbyPage
  })

  const aliceGalaxyPage = await test.step("Alice starts the game", async () => {
    await aliceLobbyPage.reload()
    return await aliceLobbyPage.startGame()
  })

  const bobGalaxyPage = await test.step("Bob opens the game", async () => {
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

  await test.step("Show the owner name only beneath claimed Planets", async () => {
    await aliceGalaxyPage.openStarSystem(aliceGalaxyPage.ownStars)
    await expect(aliceGalaxyPage.ownedPlanets).toHaveCount(1)
    await expect(aliceGalaxyPage.planetOwnerName(aliceGalaxyPage.ownedPlanets)).toHaveText(/.+/)
    await expect(aliceGalaxyPage.unclaimedPlanets).not.toHaveCount(0)
    await expect(aliceGalaxyPage.planetOwnerName(aliceGalaxyPage.unclaimedPlanets.first())).toHaveCount(0)
  })
})
