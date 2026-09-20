import { Time, UnitOfTime } from "@guillaume-docquier/tools-ts"
import { expect, test } from "../fixtures.ts"
import { CreateGamePage } from "../pages/CreateGamePage.ts"
import { LobbyPage } from "../pages/LobbyPage.ts"

test("the galaxy view distinguishes systems with claimed planets and system view labels claimed planets", async ({ alice, bob }) => {
  const aliceLobbyPage = await CreateGamePage.createGame({
    creator: alice,
    participants: [bob],
    settings: { maxPlayers: 2 },
  })

  const aliceGalaxyPage = await test.step("Start the game", async () => {
    return await aliceLobbyPage.startGame()
  })

  const bobGalaxyPage = await test.step("Open the game from the participant lobby", async () => {
    const bobLobbyPage = new LobbyPage(bob.page)
    await bobLobbyPage.reload()
    return await bobLobbyPage.openGame()
  })

  await test.step("Distinguish each player's own and opponent-owned systems", async () => {
    await expect(aliceGalaxyPage.ownStars).toHaveCount(1)
    await expect(aliceGalaxyPage.opponentStars).toHaveCount(1)
    await expect(aliceGalaxyPage.sharedStars).toHaveCount(0)

    await expect(bobGalaxyPage.ownStars).toHaveCount(1)
    await expect(bobGalaxyPage.opponentStars).toHaveCount(1)
    await expect(bobGalaxyPage.sharedStars).toHaveCount(0)
  })

  await test.step("Show the owner name only beneath claimed Planets", async () => {
    await aliceGalaxyPage.openStarSystem(aliceGalaxyPage.ownStars.first())
    await expect(aliceGalaxyPage.ownedPlanets).toHaveCount(1)
    await expect(aliceGalaxyPage.planetOwnerName(aliceGalaxyPage.ownedPlanets.first())).toHaveText(/.+/)
    await expect(aliceGalaxyPage.unclaimedPlanets).not.toHaveCount(0)
    await expect(aliceGalaxyPage.planetOwnerName(aliceGalaxyPage.unclaimedPlanets.first())).toHaveCount(0)
  })
})

test("the galaxy view can be navigated and the star system view can inspect planets", async ({ alice }) => {
  const lobbyPage = await CreateGamePage.createGame({
    creator: alice,
    settings: { maxPlayers: 3, turnLength: Time.create(2, UnitOfTime.HOURS) },
  })

  const galaxyPage = await test.step("Start the game", async () => await lobbyPage.startGame())
  await test.step("Center and fit a Galaxy region", async () => {
    const selectedRegion = galaxyPage.region("last")
    await galaxyPage.centerRegion(selectedRegion)
    await expect(galaxyPage.map).toHaveAttribute("aria-busy", "true")
    await expect.poll(async () => await galaxyPage.getGalaxyRegionDistanceFromCenter(selectedRegion)).toBeLessThan(1)
    await expect.poll(async () => await galaxyPage.getGalaxyCameraScale()).toBeLessThanOrEqual(10.5)
    await galaxyPage.zoomGalaxyOut()
    await expect.poll(async () => await galaxyPage.getGalaxyCameraScale()).toBeGreaterThan(10.5)
    await galaxyPage.centerRegion(selectedRegion)
    await expect(galaxyPage.map).toHaveAttribute("aria-busy", "true")
    await expect.poll(async () => await galaxyPage.getGalaxyCameraScale()).toBeLessThanOrEqual(10.5)
    await galaxyPage.resetView()
    await expect.poll(async () => await galaxyPage.getGalaxyCameraScale()).toBe(1)
  })

  const cameraScaleBeforeInspecting = await test.step("Zoom the Galaxy before inspecting a Star System", async () => {
    const initialCameraScale = await galaxyPage.getGalaxyCameraScale()
    await galaxyPage.zoomGalaxyOut()
    await expect.poll(async () => await galaxyPage.getGalaxyCameraScale()).not.toBe(initialCameraScale)
    return await galaxyPage.getGalaxyCameraScale()
  })
  const selectedStar = galaxyPage.star(0)

  await test.step("Open a Star System and inspect its Planet profiles", async () => {
    await galaxyPage.openStarSystem(selectedStar)
    await expect(galaxyPage.starSystemMap).toBeVisible()

    const firstPlanet = galaxyPage.planet(0)
    const firstPlanetName = await galaxyPage.getPlanetName(firstPlanet)
    await galaxyPage.openPlanetProfile(firstPlanet)
    expect(firstPlanetName).toBe("planet 122350")
    await expect(galaxyPage.planetDetailsPane).toBeVisible()
    await expect(galaxyPage.planetDetailsPane.getByRole("heading", { name: firstPlanetName })).toBeVisible()
    await expect(galaxyPage.planetDetailsPane).toContainText("Planet attributes")
    await expect(galaxyPage.planetDetailsPane).toContainText("Fertility")
    await expect(galaxyPage.planetDetailsPane).toContainText("Max population")
    await expect(galaxyPage.planetDetailsPane).toContainText("Coordinates")

    const secondPlanet = galaxyPage.planet(1)
    const secondPlanetName = await galaxyPage.getPlanetName(secondPlanet)
    await galaxyPage.openPlanetProfile(secondPlanet)
    expect(secondPlanetName).toBe("planet 983117")
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
