import { Time, UnitOfTime } from "@guillaume-docquier/tools-ts"
import { expect, test } from "../fixtures.ts"
import { CreateGamePage } from "../pages/CreateGamePage.ts"
import { FleetsPage } from "../pages/FleetsPage.ts"
import { GalaxyPage } from "../pages/GalaxyPage.ts"
import { LobbyPage } from "../pages/LobbyPage.ts"

test("fleet origin and destination links open their planets in the galaxy view", async ({ alice, bob }) => {
  const lobbyPage = await test.step("Create a game", async () =>
    await CreateGamePage.createGame({
      creator: alice,
      participants: [bob],
      settings: { maxPlayers: 2, turnLength: Time.create(1, UnitOfTime.DAYS) },
    }))
  const galaxyPage = await test.step("Start the game", async () => {
    await lobbyPage.reload()
    return await lobbyPage.startGame()
  })
  const bobPlayersPage = await test.step("Open the game for Bob", async () => {
    const bobLobbyPage = new LobbyPage(bob.page)
    await bobLobbyPage.reload()
    const bobGalaxyPage = await bobLobbyPage.openGame()
    return await bobGalaxyPage.openPlayers()
  })

  const fleetsPage = await test.step("Build a fleet and finish the turn", async () => {
    const actionsPage = await galaxyPage.openActions()
    await actionsPage.toggleActionSelection("Build Fleet", "Standard Directive")
    await actionsPage.toggleActionSelection("Political Campaign")
    const playersPage = await actionsPage.openPlayers()
    await playersPage.toggleReady()
    await bobPlayersPage.toggleReady()
    await expect(playersPage.turn).toHaveText("Turn 2", { timeout: 15000 })
    await expect(bobPlayersPage.turn).toHaveText("Turn 2", { timeout: 15000 })
    return await playersPage.openFleets()
  })

  await test.step("Open the fleet's origin planet and return to Fleets", async () => {
    const row = fleetsPage.row(0)
    const name = await fleetsPage.getOriginPlanet(row)
    const coordinates = await fleetsPage.getCoordinate(row)
    const originGalaxyPage = await fleetsPage.openOriginPlanet(row)
    expect(GalaxyPage.urlPattern.test(alice.page.url())).toBe(true)
    await expect(originGalaxyPage.starSystemMap).toBeVisible()
    await expect(originGalaxyPage.planetDetailsPane).toContainText(name)
    await expect(originGalaxyPage.planetDetailsPane).toContainText(coordinates)
    await originGalaxyPage.goBack()
    expect(FleetsPage.urlPattern.test(alice.page.url())).toBe(true)
    await expect(fleetsPage.heading).toBeVisible()
  })

  await test.step("Send the fleet toward a destination and finish the turn", async () => {
    const actionsPage = await fleetsPage.openActions()
    await actionsPage.searchTarget("Move Fleet", "Standard Directive", "Planet", "991659")
    await actionsPage.chooseTarget("Planet", "planet 991659")
    await actionsPage.toggleActionSelection("Move Fleet", "Standard Directive")
    const playersPage = await actionsPage.openPlayers()
    await playersPage.toggleReady()
    await bobPlayersPage.toggleReady()
    await expect(playersPage.turn).toHaveText("Turn 3", { timeout: 15000 })
    await expect(bobPlayersPage.turn).toHaveText("Turn 3", { timeout: 15000 })
    await playersPage.openFleets()
  })

  await test.step("Open the destination planet in the galaxy view", async () => {
    const row = fleetsPage.row(0)
    const destinationLink = fleetsPage.destinationPlanetLink(row)
    await expect(destinationLink).toContainText("planet 991659")
    const destinationUrl = await destinationLink.getAttribute("href")
    const destinationGalaxyPage = await fleetsPage.openDestinationPlanet(row)
    expect(GalaxyPage.urlPattern.test(alice.page.url())).toBe(true)
    expect(new URL(alice.page.url()).pathname + new URL(alice.page.url()).search).toBe(destinationUrl)
    await expect(destinationGalaxyPage.starSystemMap).toBeVisible()
    await expect(destinationGalaxyPage.planetDetailsPane).toContainText("planet 991659")
  })
})
