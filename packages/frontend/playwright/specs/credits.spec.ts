import { expect, test } from "../fixtures.ts"
import { CreateGamePage } from "../pages/CreateGamePage.ts"

test("GTB-0001 When a player enters or reloads the game, they can see their own saved global credit balance. Visiting another planet or colony shows the same balance for that player.", async ({
  alice,
}) => {
  const details = await test.step("Create a solo game", async () => await CreateGamePage.createGame({ creator: alice }))
  const galaxy = await test.step("Start the game and read the opening balance", async () => {
    const started = await details.startGame()
    await expect(started.credits).toHaveText("100")
    return started
  })

  const home = await test.step("Open the home world and read the same credits", async () => {
    await galaxy.openStarSystem(galaxy.ownStar(0))
    const planet = await galaxy.openPlanetProfile(galaxy.ownedPlanet(0))
    await expect(planet.credits).toHaveText("100")
    return planet
  })

  await test.step("Visit another planet and reload its address", async () => {
    const system = await home.returnToSystem()
    const neighbor = await system.openPlanetProfile(system.unclaimedPlanet(0))
    await expect(neighbor.credits).toHaveText("100")
    await neighbor.reload()
    await expect(neighbor.credits).toHaveText("100")
  })
})
