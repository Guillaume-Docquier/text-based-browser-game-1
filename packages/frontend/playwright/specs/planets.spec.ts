import { expect, test } from "../fixtures.ts"
import { CreateGamePage } from "../pages/CreateGamePage.ts"
import { GalaxyPage } from "../pages/GalaxyPage.ts"
import { PlanetsPage } from "../pages/PlanetsPage.ts"

test("players can open an owned planet from the planets list and return", async ({ alice, bob }) => {
  const aliceGameDetailsPage = await test.step("Create a game for Alice and Bob", async () => {
    return await CreateGamePage.createGame({
      creator: alice,
      participants: [bob],
      settings: { maxPlayers: 2 },
    })
  })

  const planetsPage = await test.step("Alice starts the game and opens Planets", async () => {
    const galaxyPage = await aliceGameDetailsPage.startGame()
    return await galaxyPage.openPlanets()
  })

  await test.step("Inspect one of the two owned planets", async () => {
    await expect(planetsPage.coordinates).toHaveCount(2)
    await expect(planetsPage.owner(alice.alias)).toBeVisible()
    await expect(planetsPage.owner(bob.alias)).toBeVisible()
    const planetName = "planet 919309"
    const coordinate = "46:93:25"
    await expect(planetsPage.coordinate(planetName)).toHaveText(coordinate)
    const galaxyPage = await planetsPage.openPlanet(planetName)
    await expect(alice.page).toHaveURL(GalaxyPage.urlPattern)
    await expect(alice.page).toHaveURL(/[?&]planetId=[^&]+/)
    await expect(galaxyPage.starSystemMap).toBeVisible()
    await expect(galaxyPage.planetDetailsPane.getByRole("heading", { name: planetName })).toBeVisible()
    await expect(galaxyPage.planetDetailsPane).toContainText(coordinate)

    await galaxyPage.goBack()
    await expect(alice.page).toHaveURL(PlanetsPage.urlPattern)
    await expect(planetsPage.heading).toBeVisible()
  })
})
