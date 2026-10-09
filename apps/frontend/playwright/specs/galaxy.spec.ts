import { Assert, Time, UnitOfTime } from "@guillaume-docquier/tools-ts"
import { expect, test } from "../fixtures.ts"
import { CreateGamePage } from "../pages/CreateGamePage.ts"
import { GameDetailsPage } from "../pages/GameDetailsPage.ts"

test("stationed fleet markers show each player's strength and color in the system view", async ({ alice, bob }) => {
  const aliceGameDetailsPage = await test.step("Create a game for Alice and Bob", async () =>
    await CreateGamePage.createGame({
      creator: alice,
      participants: [bob],
      settings: { maxPlayers: 2, turnLength: Time.create(1, UnitOfTime.DAYS) },
    }))
  const bobGameDetailsPage = new GameDetailsPage(bob.page)

  const aliceGalaxyPage = await test.step("Start the game", async () => {
    await aliceGameDetailsPage.reload()
    return await aliceGameDetailsPage.startGame()
  })

  await test.step("Both players build a Fleet and finish the turn", async () => {
    const aliceActionsPage = await aliceGalaxyPage.openActions()
    await aliceActionsPage.toggleActionSelection("Build Fleet", "Standard Directive")
    await aliceActionsPage.toggleActionSelection("Political Campaign")
    const alicePlayersPage = await aliceActionsPage.openPlayers()
    await alicePlayersPage.toggleReady()

    await bobGameDetailsPage.reload()
    const bobGalaxyPage = await bobGameDetailsPage.openGame()
    const bobActionsPage = await bobGalaxyPage.openActions()
    await bobActionsPage.toggleActionSelection("Build Fleet", "Standard Directive")
    await bobActionsPage.toggleActionSelection("Political Campaign")
    const bobPlayersPage = await bobActionsPage.openPlayers()
    await bobPlayersPage.toggleReady()

    await expect(alicePlayersPage.turn).toHaveText("Turn 2", { timeout: 15000 })
    await expect(bobPlayersPage.turn).toHaveText("Turn 2", { timeout: 15000 })
  })

  await test.step("Show each player's Fleet beneath its Planet in the system view", async () => {
    const galaxyPage = await aliceGalaxyPage.openGalaxy()
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
})

test("the galaxy view distinguishes systems with claimed planets and system view labels claimed planets", async ({ alice, bob }) => {
  const aliceGameDetailsPage = await test.step("Create a game for Alice and Bob", async () => {
    return await CreateGamePage.createGame({
      creator: alice,
      participants: [bob],
      settings: { maxPlayers: 2 },
    })
  })

  const aliceGalaxyPage = await test.step("Start the game", async () => await aliceGameDetailsPage.startGame())

  const bobGalaxyPage = await test.step("Open the game from the participant's game details page", async () => {
    const bobGameDetailsPage = new GameDetailsPage(bob.page)
    await bobGameDetailsPage.reload()
    return await bobGameDetailsPage.openGame()
  })

  await test.step("Distinguish each player's own and opponent-owned systems", async () => {
    await expect(aliceGalaxyPage.ownStars).toHaveCount(1)
    await expect(aliceGalaxyPage.opponentStars).toHaveCount(1)
    await expect(aliceGalaxyPage.sharedStars).toHaveCount(0)

    await expect(bobGalaxyPage.ownStars).toHaveCount(1)
    await expect(bobGalaxyPage.opponentStars).toHaveCount(1)
    await expect(bobGalaxyPage.sharedStars).toHaveCount(0)
  })

  await test.step("Label Planets with their owner or Unclaimed", async () => {
    await aliceGalaxyPage.openStarSystem(aliceGalaxyPage.ownStar(0))
    await expect(aliceGalaxyPage.ownedPlanets).toHaveCount(1)
    await expect(aliceGalaxyPage.planetOwnershipLabel(aliceGalaxyPage.ownedPlanet(0))).toHaveText(alice.alias)
    await expect(aliceGalaxyPage.unclaimedPlanets).not.toHaveCount(0)
    await expect(aliceGalaxyPage.planetOwnershipLabel(aliceGalaxyPage.unclaimedPlanet(0))).toHaveText("Unclaimed")
  })

  await test.step("Bring hovered bodies above other map content", async () => {
    await aliceGalaxyPage.leaveBodies()
    const planet = aliceGalaxyPage.ownedPlanet(0)
    const planetLabel = await planet.getAttribute("aria-label")
    const starLabel = await aliceGalaxyPage.starSystemStar.getAttribute("aria-label")
    const originalForeground = await aliceGalaxyPage.foregroundBody.getAttribute("aria-label")

    Assert.isDefined(planetLabel)
    Assert.isDefined(starLabel)
    Assert.isDefined(originalForeground)

    await aliceGalaxyPage.hoverBody(planet)
    await expect(aliceGalaxyPage.foregroundBody).toHaveAttribute("aria-label", planetLabel)
    await aliceGalaxyPage.hoverBody(aliceGalaxyPage.starSystemStar)
    await expect(aliceGalaxyPage.foregroundBody).toHaveAttribute("aria-label", starLabel)
    await aliceGalaxyPage.leaveBodies()
    await expect(aliceGalaxyPage.foregroundBody).toHaveAttribute("aria-label", originalForeground)
  })
})

test("the galaxy view can be navigated and the star system view can inspect planets", async ({ alice }) => {
  const gameDetailsPage = await test.step("Create a game", async () => await CreateGamePage.createGame({ creator: alice }))
  const galaxyPage = await test.step("Start the game", async () => await gameDetailsPage.startGame())

  await test.step("Center and fit a Galaxy region", async () => {
    const selectedRegion = galaxyPage.region("last")

    await galaxyPage.centerRegion(selectedRegion)
    await expect.poll(async () => await galaxyPage.getGalaxyRegionDistanceFromCenter(selectedRegion)).toBeLessThan(1)
    await expect.poll(async () => await galaxyPage.getGalaxyCameraScale()).toBeLessThanOrEqual(10.5)
    await expect(galaxyPage.map).toHaveAttribute("aria-busy", "false")

    await galaxyPage.zoomGalaxyOut()
    await expect.poll(async () => await galaxyPage.getGalaxyCameraScale()).toBeGreaterThan(10.5)

    await galaxyPage.centerRegion(selectedRegion)
    await expect.poll(async () => await galaxyPage.getGalaxyCameraScale()).toBeLessThanOrEqual(10.5)
    await expect(galaxyPage.map).toHaveAttribute("aria-busy", "false")

    await galaxyPage.resetView()
    await expect.poll(async () => await galaxyPage.getGalaxyCameraScale()).toBe(1)
  })

  const cameraScaleBeforeInspecting = await test.step("Zoom the Galaxy before inspecting a Star System", async () => {
    const initialCameraScale = await galaxyPage.getGalaxyCameraScale()
    await galaxyPage.zoomGalaxyOut()
    await expect.poll(async () => await galaxyPage.getGalaxyCameraScale()).not.toBe(initialCameraScale)
    return await galaxyPage.getGalaxyCameraScale()
  })

  const selectedStar = galaxyPage.star(1)

  await test.step("Open a Star System and inspect its Planet profiles", async () => {
    await galaxyPage.openStarSystem(selectedStar)
    await expect(galaxyPage.starSystemMap).toBeVisible()

    const firstPlanet = galaxyPage.planet("planet 72231")
    const firstPlanetName = await galaxyPage.getPlanetName(firstPlanet)
    await galaxyPage.openPlanetProfile(firstPlanet)
    expect(firstPlanetName).toBe("planet 72231")
    await expect(galaxyPage.planetDetailsPane).toBeVisible()
    await expect(galaxyPage.planetDetailsPane.getByRole("heading", { name: firstPlanetName })).toBeVisible()
    await expect(galaxyPage.planetDetailsPane).toContainText("Planet attributes")
    await expect(galaxyPage.planetDetailsPane).toContainText("Fertility")
    await expect(galaxyPage.planetDetailsPane).toContainText("Max population")
    await expect(galaxyPage.planetDetailsPane).toContainText("Coordinates")

    const secondPlanet = galaxyPage.planet("planet 73768")
    const secondPlanetName = await galaxyPage.getPlanetName(secondPlanet)
    await galaxyPage.openPlanetProfile(secondPlanet)
    expect(secondPlanetName).toBe("planet 73768")
    await expect(galaxyPage.planetDetailsPane.getByRole("heading", { name: secondPlanetName })).toBeVisible()

    await galaxyPage.clickOnTheMap()
    await expect(galaxyPage.planetDetailsPane).not.toBeVisible()
  })

  await test.step("Pan, recenter, and reopen the Star System", async () => {
    await galaxyPage.panStarSystem({ deltaX: 60, deltaY: 40 })
    expect(await galaxyPage.getStarSystemStarDistanceFromCenter()).toBeGreaterThan(20)

    await galaxyPage.returnToGalaxy()
    await expect(galaxyPage.starSystemMap).toHaveAttribute("aria-busy", "true")
    await expect(galaxyPage.heading).not.toBeVisible()
    await expect.poll(async () => await galaxyPage.getStarSystemStarDistanceFromCenter()).toBeLessThan(1)
    await expect(galaxyPage.heading).toBeVisible()
    expect(await galaxyPage.getGalaxyCameraScale()).toBeCloseTo(cameraScaleBeforeInspecting)
    expect(await galaxyPage.getGalaxyStarDistanceFromCenter(selectedStar)).toBeLessThan(1)

    await galaxyPage.openStarSystem(selectedStar)
    await expect(galaxyPage.starSystemMap).toHaveCount(1)
    await expect(galaxyPage.starSystemMap).toBeVisible()

    await galaxyPage.returnToGalaxy()
    await expect(galaxyPage.starSystemMap).not.toHaveAttribute("aria-busy", "true")
    await expect(galaxyPage.heading).toBeVisible()
  })
})
