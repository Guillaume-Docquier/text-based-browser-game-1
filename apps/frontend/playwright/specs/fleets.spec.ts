import { Time, UnitOfTime } from "@guillaume-docquier/tools-ts"
import { expect, test } from "../fixtures.ts"
import { CreateGamePage } from "../pages/CreateGamePage.ts"
import { FleetsPage } from "../pages/FleetsPage.ts"
import { GalaxyPage } from "../pages/GalaxyPage.ts"
import { LobbyPage } from "../pages/LobbyPage.ts"

test("fleet origin and destination links open their planets in the galaxy view", async ({ alice, bob }) => {
  const aliceLobbyPage = await test.step("Create a game", async () =>
    await CreateGamePage.createGame({
      creator: alice,
      participants: [bob],
      settings: { maxPlayers: 2, turnLength: Time.create(1, UnitOfTime.DAYS) },
    }))
  const aliceGalaxyPage = await test.step("Start the game", async () => {
    await aliceLobbyPage.reload()
    return await aliceLobbyPage.startGame()
  })
  const bobPlayersPage = await test.step("Open the game for Bob", async () => {
    const bobLobbyPage = new LobbyPage(bob.page)
    await bobLobbyPage.reload()
    const bobGalaxyPage = await bobLobbyPage.openGame()
    return await bobGalaxyPage.openPlayers()
  })

  const aliceFleetsPage = await test.step("Build a fleet and finish the turn", async () => {
    const aliceActionsPage = await aliceGalaxyPage.openActions()
    await aliceActionsPage.toggleActionSelection("Build Fleet", "Standard Directive")
    await aliceActionsPage.toggleActionSelection("Political Campaign")
    const alicePlayersPage = await aliceActionsPage.openPlayers()
    await alicePlayersPage.toggleReady()
    await bobPlayersPage.toggleReady()
    await expect(alicePlayersPage.turn).toHaveText("Turn 2", { timeout: 15000 })
    await expect(bobPlayersPage.turn).toHaveText("Turn 2", { timeout: 15000 })
    return await alicePlayersPage.openFleets()
  })

  const originPlanetName = await test.step("Open the fleet's origin planet and return to Fleets", async () => {
    const row = aliceFleetsPage.row(0)
    const name = await aliceFleetsPage.getOriginPlanet(row)
    expect(name).toMatch(/^planet (919309|991659)$/)
    const coordinates = await aliceFleetsPage.getCoordinate(row)
    const aliceOriginGalaxyPage = await aliceFleetsPage.openOriginPlanet(row)
    expect(GalaxyPage.urlPattern.test(alice.page.url())).toBe(true)
    await expect(aliceOriginGalaxyPage.starSystemMap).toBeVisible()
    await expect(aliceOriginGalaxyPage.planetDetailsPane).toContainText(name)
    await expect(aliceOriginGalaxyPage.planetDetailsPane).toContainText(coordinates)
    await aliceOriginGalaxyPage.goBack()
    expect(FleetsPage.urlPattern.test(alice.page.url())).toBe(true)
    await expect(aliceFleetsPage.heading).toBeVisible()
    return name
  })

  // The map seed fixes the home planets, but generated account IDs determine their owners.
  // Moving to the other home planet keeps the fleet in transit after one turn.
  const destinationPlanetName = originPlanetName === "planet 991659" ? "planet 919309" : "planet 991659"

  await test.step("Send the fleet toward a destination and finish the turn", async () => {
    const aliceActionsPage = await aliceFleetsPage.openActions()
    await aliceActionsPage.searchTarget("Move Fleet", "Standard Directive", "Planet", destinationPlanetName)
    await aliceActionsPage.chooseTarget("Planet", destinationPlanetName)
    await aliceActionsPage.toggleActionSelection("Move Fleet", "Standard Directive")
    await expect(aliceActionsPage.selectActionButton("Move Fleet", "Standard Directive")).toHaveAttribute("aria-pressed", "true")
    const alicePlayersPage = await aliceActionsPage.openPlayers()
    await alicePlayersPage.toggleReady()
    await bobPlayersPage.toggleReady()
    await expect(alicePlayersPage.turn).toHaveText("Turn 3", { timeout: 15000 })
    await expect(bobPlayersPage.turn).toHaveText("Turn 3", { timeout: 15000 })
    await alicePlayersPage.openFleets()
  })

  await test.step("Open the destination planet in the galaxy view", async () => {
    const row = aliceFleetsPage.row(0)
    const destinationLink = aliceFleetsPage.destinationPlanetLink(row)
    await expect(destinationLink).toContainText(destinationPlanetName)
    const destinationUrl = await destinationLink.getAttribute("href")
    const aliceDestinationGalaxyPage = await aliceFleetsPage.openDestinationPlanet(row)
    expect(GalaxyPage.urlPattern.test(alice.page.url())).toBe(true)
    expect(new URL(alice.page.url()).pathname + new URL(alice.page.url()).search).toBe(destinationUrl)
    await expect(aliceDestinationGalaxyPage.starSystemMap).toBeVisible()
    await expect(aliceDestinationGalaxyPage.planetDetailsPane).toContainText(destinationPlanetName)
  })
})
