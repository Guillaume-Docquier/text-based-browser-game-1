import { expect, test } from "../fixtures.ts"
import { CreateGamePage } from "../pages/CreateGamePage.ts"
import { PlanetPage } from "../pages/PlanetPage.ts"
import { PlanetsPage } from "../pages/PlanetsPage.ts"

test("PV-0001 When a player selects a planet on the system map or through the planet list, the same full planet view opens in the main play area for that game and planet.", async ({
  alice,
  bob,
}) => {
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

  const planet = await test.step("Follow the coordinate to the full planet view", async () => {
    const selected = await planetsPage.openCoordinate("43:75:15")
    await expect(alice.page).toHaveURL(PlanetPage.urlPattern)
    await expect(selected.heading).toHaveText("planet 965452")
    await expect(selected.attribute("Coordinates")).toHaveText("43:75:15")
    return selected
  })
  const planetAddress = alice.page.url()

  await test.step("Go back to the Planets list", async () => {
    await planet.goBack()
    await expect(alice.page).toHaveURL(PlanetsPage.urlPattern)
    await expect(planetsPage.heading).toBeVisible()
  })

  await test.step("Select the same planet on its system map", async () => {
    const selected = await planetsPage.openCoordinate("43:75:15")
    const system = await selected.returnToSystem()
    const fromMap = await system.openPlanetProfile(system.planet("planet 965452"))
    await expect(alice.page).toHaveURL(planetAddress)
    await expect(fromMap.heading).toHaveText("planet 965452")
    await expect(fromMap.attribute("Coordinates")).toHaveText("43:75:15")
  })
})

test("PV-0003 When a player reloads a planet view or returns to its address, the same game and planet reopen.", async ({ alice }) => {
  const details = await test.step("Create a game", async () => await CreateGamePage.createGame({ creator: alice }))
  const galaxy = await test.step("Start the game", async () => await details.startGame())
  const earth = await test.step("Open Earth from Sol", async () => {
    await galaxy.openStarSystem(galaxy.starNamed("Sol"))
    return await galaxy.openPlanetProfile(galaxy.planet("Earth"))
  })
  await expect(earth.heading).toHaveText("Earth")
  const address = alice.page.url()

  await test.step("Reload Earth and return to Sol", async () => {
    await earth.reload()
    await expect(alice.page).toHaveURL(address)
    await expect(earth.heading).toHaveText("Earth")
    await expect(earth.attribute("Coordinates")).toHaveText("44:76:01")
    const sol = await earth.returnToSystem()
    await expect(sol.planet("Earth")).toBeVisible()
  })

  await test.step("Use browser Back to reopen the same planet", async () => {
    await galaxy.goBack()
    await expect(alice.page).toHaveURL(address)
    await expect(earth.heading).toHaveText("Earth")
  })
})
