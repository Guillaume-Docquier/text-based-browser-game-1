import { expect, test } from "../fixtures.ts"
import { CreateGamePage } from "../pages/CreateGamePage.ts"
import { GalaxyPage } from "../pages/GalaxyPage.ts"
import { PlanetsPage } from "../pages/PlanetsPage.ts"

test("a player can open a Galaxy profile from Planets, reload it, and go back to Planets", async ({ alice, bob }) => {
  const planetsPage = await test.step("Start a game for Alice and Bob and open Planets", async () => {
    const gameDetails = await CreateGamePage.createGame({
      creator: alice,
      participants: [bob],
      settings: { maxPlayers: 2 },
    })
    const galaxy = await gameDetails.startGame()
    const planets = await galaxy.openPlanets()
    await expect(alice.page).toHaveURL(PlanetsPage.urlPattern)
    return planets
  })

  const galaxyPage = await test.step("Follow the link to planet 991659", async () => {
    const galaxy = await planetsPage.openPlanetAt("44:96:25")
    await expect(alice.page).toHaveURL(GalaxyPage.urlPattern)
    await expect(galaxy.planetDetails("planet 991659")).toContainText("44:96:25")
    return galaxy
  })

  await test.step("Reload the shared URL and see the same planet profile", async () => {
    await galaxyPage.reload()
    await expect(galaxyPage.planetDetails("planet 991659")).toContainText("44:96:25")
  })

  await test.step("Use browser Back to return to Planets", async () => {
    await galaxyPage.goBack()
    await expect(alice.page).toHaveURL(PlanetsPage.urlPattern)
    await expect(planetsPage.heading).toBeVisible()
  })
})
