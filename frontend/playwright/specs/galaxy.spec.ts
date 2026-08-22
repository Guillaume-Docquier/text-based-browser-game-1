import { authenticatedUser } from "../authenticatedUser.ts"
import { expect, test } from "../fixtures.ts"
import { CreateGamePage } from "../pages/CreateGamePage.ts"

test.use(authenticatedUser)

test("opens, switches, and closes the Planet profile pane", async ({ page }) => {
  const galaxyPage = await test.step("Create and start the game", async () => {
    const createGamePage = await CreateGamePage.goto(page)
    await createGamePage.setGameName(`Planet profile ${Date.now()}`)
    const lobbyPage = await createGamePage.submit()
    await lobbyPage.startGame()
    return await lobbyPage.openGame()
  })

  await test.step("open a star system", async () => {
    await galaxyPage.stars.first().click()
    await expect(galaxyPage.starSystemMap).toBeVisible()
  })

  await test.step("open planet details", async () => {
    const firstPlanet = galaxyPage.planets.first()
    const firstPlanetName = await galaxyPage.getPlanetName(firstPlanet)
    await firstPlanet.click()
    await expect(galaxyPage.planetDetailsPane).toBeVisible()
    await expect(galaxyPage.planetDetailsPane.getByRole("heading", { name: firstPlanetName })).toBeVisible()
  })

  await test.step("open another planet details", async () => {
    const secondPlanet = galaxyPage.planets.nth(1)
    const secondPlanetName = await galaxyPage.getPlanetName(secondPlanet)
    await secondPlanet.click()
    await expect(galaxyPage.planetDetailsPane).toBeVisible()
    await expect(galaxyPage.planetDetailsPane.getByRole("heading", { name: secondPlanetName })).toBeVisible()
  })

  await test.step("close planet details", async () => {
    await galaxyPage.starSystemMap.click({ position: { x: 10, y: 10 } })
    await expect(galaxyPage.planetDetailsPane).not.toBeVisible()
  })
})
