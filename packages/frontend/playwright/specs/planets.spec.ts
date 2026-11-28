import { expect, test } from "../fixtures.ts"
import { CreateGamePage } from "../pages/CreateGamePage.ts"
import { GalaxyPage } from "../pages/GalaxyPage.ts"
import { PlanetsPage } from "../pages/PlanetsPage.ts"

test("the planets view opens the selected planet in the galaxy view and supports Back navigation", async ({ alice, bob }) => {
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

  const galaxyPage = await test.step("Follow a planet's coordinates to its Galaxy profile", async () => {
    const galaxyPage = await planetsPage.openCoordinate("53:25:25")
    await expect(alice.page).toHaveURL((url) => GalaxyPage.urlPattern.test(url) && url.searchParams.has("planetId"))
    await expect(galaxyPage.starSystemMap).toBeVisible()
    await expect(galaxyPage.planetProfileHeading("planet 775905")).toBeVisible()
    await expect(galaxyPage.planetDetailsPane).toContainText("53:25:25")
    return galaxyPage
  })

  await test.step("Go back to the Planets list", async () => {
    await galaxyPage.goBack()
    await expect(alice.page).toHaveURL(PlanetsPage.urlPattern)
    await expect(planetsPage.heading).toBeVisible()
  })
})
