import { authenticatedUser } from "../authenticatedUser.ts"
import { expect, test } from "../fixtures.ts"
import { CreateGamePage } from "../pages/CreateGamePage.ts"
import { LobbyPage } from "../pages/LobbyPage.ts"

test.use(authenticatedUser)

test("opens, switches, and closes the Planet profile pane", async ({ page }) => {
  const createGamePage = await CreateGamePage.goto(page)
  await createGamePage.setGameName(`Planet profile ${Date.now()}`)
  await createGamePage.submit()

  const lobbyPage = new LobbyPage(page)
  await lobbyPage.startGame()
  const galaxyPage = await lobbyPage.openGame()

  await galaxyPage.stars.first().click()
  await expect(galaxyPage.starSystemMap).toBeVisible()

  const firstPlanet = galaxyPage.planets.first()
  const secondPlanet = galaxyPage.planets.nth(1)
  const firstPlanetName = await galaxyPage.getPlanetName(firstPlanet)
  const secondPlanetName = await galaxyPage.getPlanetName(secondPlanet)

  await firstPlanet.click()
  await expect(galaxyPage.planetDetailsPane).toBeVisible()
  await expect(galaxyPage.planetDetailsPane.getByRole("heading", { name: firstPlanetName })).toBeVisible()

  await secondPlanet.press("Enter")
  await expect(galaxyPage.planetDetailsPane.getByRole("heading", { name: secondPlanetName })).toBeVisible()

  await galaxyPage.starSystemMap.click({ position: { x: 10, y: 10 } })
  await expect(galaxyPage.planetDetailsPane).not.toBeVisible()
})
