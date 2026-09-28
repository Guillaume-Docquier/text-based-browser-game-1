import { Time, UnitOfTime } from "@guillaume-docquier/tools-ts"
import { expect, test } from "../fixtures.ts"
import { CreateGamePage } from "../pages/CreateGamePage.ts"
import { FleetsPage } from "../pages/FleetsPage.ts"
import { GalaxyPage } from "../pages/GalaxyPage.ts"
import { LobbyPage } from "../pages/LobbyPage.ts"

test("the fleets view shows built fleets and supports filtering, sorting, and planet navigation", async ({ alice, bob }) => {
  const aliceLobbyPage = await test.step("Create a game for Alice and Bob", async () =>
    await CreateGamePage.createGame({
      creator: alice,
      participants: [bob],
      settings: { maxPlayers: 2, turnLength: Time.create(1, UnitOfTime.DAYS) },
    }))
  const bobLobbyPage = new LobbyPage(bob.page)

  const aliceFleetsPage = await test.step("Start the game and open the empty Fleets view", async () => {
    await aliceLobbyPage.reload()
    const galaxyPage = await aliceLobbyPage.startGame()
    const fleetsPage = await galaxyPage.openFleets()
    await expect(fleetsPage.heading).toBeVisible()
    await expect(fleetsPage.emptyMessage).toHaveText("No fleets")
    await expect(fleetsPage.sortHeader("Owner")).toHaveAttribute("aria-sort", "ascending")
    await fleetsPage.selectOwner(bob.alias)
    await expect(fleetsPage.emptyMessage).toHaveText("No fleets")
    await fleetsPage.selectOwner("All players")
    return fleetsPage
  })

  await test.step("Both players build a Fleet and finish the turn", async () => {
    const aliceActionsPage = await aliceFleetsPage.openActions()
    await aliceActionsPage.toggleActionSelection("Build Fleet", "Standard Directive")
    const alicePlayersPage = await aliceActionsPage.openPlayers()
    await alicePlayersPage.toggleReady()

    await bobLobbyPage.reload()
    const bobGalaxyPage = await bobLobbyPage.openGame()
    const bobActionsPage = await bobGalaxyPage.openActions()
    await bobActionsPage.toggleActionSelection("Build Fleet", "Standard Directive")
    const bobPlayersPage = await bobActionsPage.openPlayers()
    await bobPlayersPage.toggleReady()

    await expect(alicePlayersPage.turn).toHaveText("Turn1", { timeout: 15000 })
    await expect(bobPlayersPage.turn).toHaveText("Turn1", { timeout: 15000 })
  })

  await test.step("Show each player's Fleet beneath its Planet in the system view", async () => {
    const galaxyPage = await aliceFleetsPage.openGalaxy()
    await expect(galaxyPage.galaxyFleetMarkers).toHaveCount(0)

    await galaxyPage.openStarSystem(galaxyPage.ownStar(0))
    const ownPlanet = galaxyPage.ownedPlanet(0)
    const ownFleet = galaxyPage.fleetMarkersOnPlanet(ownPlanet)
    await expect(ownFleet).toHaveCount(1)
    await expect(galaxyPage.fleetIcon(ownFleet)).toBeVisible()
    await expect(galaxyPage.fleetIcon(ownFleet)).toHaveAttribute("data-fleet-color", /^#[0-9A-Fa-f]{6}$/)
    await expect(galaxyPage.fleetStrength(ownFleet)).toHaveText("10")
    await galaxyPage.hoverFleet(ownFleet)
    await expect(galaxyPage.fleetMarkersOnPlanet(galaxyPage.foregroundPlanet)).toHaveCount(1)
    await expect(galaxyPage.planetOwnershipLabel(galaxyPage.foregroundPlanet)).toHaveText(alice.alias)
    const ownColor = await galaxyPage.fleetIcon(ownFleet).getAttribute("data-fleet-color")

    await galaxyPage.returnToGalaxy()
    await expect(galaxyPage.heading).toBeVisible()
    await galaxyPage.openStarSystem(galaxyPage.opponentStar(0))
    const opponentFleet = galaxyPage.fleetMarkersOnPlanet(galaxyPage.ownedPlanet(0))
    await expect(opponentFleet).toHaveCount(1)
    await expect(galaxyPage.fleetIcon(opponentFleet)).toBeVisible()
    await expect(galaxyPage.fleetIcon(opponentFleet)).toHaveAttribute("data-fleet-color", /^#[0-9A-Fa-f]{6}$/)
    await expect(galaxyPage.fleetStrength(opponentFleet)).toHaveText("10")
    expect(await galaxyPage.fleetIcon(opponentFleet).getAttribute("data-fleet-color")).not.toBe(ownColor)

    await galaxyPage.openFleets()
  })

  await test.step("Show both Fleets sorted by owner and filter by owner and Fleet ID", async () => {
    await aliceFleetsPage.openFleets()
    await expect(aliceFleetsPage.rows).toHaveCount(2)
    await expect(aliceFleetsPage.columnHeaders).toHaveText(["Fleet", "Owner", "Strength", "Origin planet"])
    await expect(aliceFleetsPage.sortHeader("Owner")).toHaveAttribute("aria-sort", "ascending")
    expect(await aliceFleetsPage.getColumnValues("OWNER_NAME")).toStrictEqual([alice.alias, bob.alias])
    expect(await aliceFleetsPage.getColumnValues("STRENGTH")).toStrictEqual(["10", "10"])

    await aliceFleetsPage.selectOwner(bob.alias)
    await expect(aliceFleetsPage.rows).toHaveCount(1)
    expect(await aliceFleetsPage.getColumnValues("OWNER_NAME")).toStrictEqual([bob.alias])
    await aliceFleetsPage.selectOwner("All players")

    const fleetName = await aliceFleetsPage.getFleetName(aliceFleetsPage.row(0))
    await aliceFleetsPage.search(fleetName)
    await expect(aliceFleetsPage.rows).toHaveCount(1)
    await aliceFleetsPage.search("unknown fleet")
    await expect(aliceFleetsPage.emptyMessage).toHaveText("No matching fleets")
    await aliceFleetsPage.search("")
  })

  await test.step("Sort Fleet columns and open the origin Planet from its name", async () => {
    await aliceFleetsPage.sortBy("Owner")
    await expect(aliceFleetsPage.sortHeader("Owner")).toHaveAttribute("aria-sort", "descending")
    expect(await aliceFleetsPage.getColumnValues("OWNER_NAME")).toStrictEqual([bob.alias, alice.alias])

    for (const column of ["Fleet", "Strength", "Origin planet"]) {
      await aliceFleetsPage.sortBy(column)
      await expect(aliceFleetsPage.sortHeader(column)).toHaveAttribute("aria-sort", "ascending")
      await aliceFleetsPage.sortBy(column)
      await expect(aliceFleetsPage.sortHeader(column)).toHaveAttribute("aria-sort", "descending")
    }

    const firstRow = aliceFleetsPage.row(0)
    const originPlanet = await aliceFleetsPage.getOriginPlanet(firstRow)
    const coordinates = await aliceFleetsPage.getCoordinate(firstRow)
    await expect(aliceFleetsPage.originPlanetLink(firstRow)).toHaveText(`${originPlanet} (${coordinates})`)
    const galaxyPage = await aliceFleetsPage.openOriginPlanet(firstRow)

    expect(GalaxyPage.urlPattern.test(alice.page.url())).toBe(true)
    expect(new URL(alice.page.url()).searchParams.has("planetId")).toBe(true)
    await expect(galaxyPage.starSystemMap).toBeVisible()
    await expect(galaxyPage.planetDetailsPane).toContainText(originPlanet)
    await expect(galaxyPage.planetDetailsPane).toContainText(coordinates)

    await galaxyPage.goBack()
    expect(FleetsPage.urlPattern.test(alice.page.url())).toBe(true)
    await expect(aliceFleetsPage.heading).toBeVisible()
  })
})
