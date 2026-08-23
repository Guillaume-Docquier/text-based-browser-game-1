import { aliceUser } from "../auth.ts"
import { expect, test } from "../fixtures.ts"
import { ActionsPage } from "../pages/ActionsPage.ts"
import { CreateGamePage } from "../pages/CreateGamePage.ts"
import { GalaxyPage } from "../pages/GalaxyPage.ts"
import { SignInPage } from "../pages/SignInPage.ts"

const DETERMINISTIC_GALAXY_SEED = 1234

test.describe("anonymous user", () => {
  test("must sign in to create a game", async ({ page }) => {
    await CreateGamePage.goto(page)

    await test.step("Verify the sign-in redirect", async () => {
      await expect(page).toHaveURL(SignInPage.urlPattern)
      const signInPage = new SignInPage(page)
      await expect(signInPage.heading).toBeVisible()
    })
  })
})

test.describe("authenticated user", () => {
  test.use(aliceUser)

  test("enforces the maximum number of players", async ({ page }) => {
    const createGamePage = await CreateGamePage.goto(page)
    await createGamePage.setGameName(`Playwright game ${Date.now()}`)

    await createGamePage.setMaxPlayers(17)
    await expect(createGamePage.createButton).toBeDisabled()

    await createGamePage.setMaxPlayers(16)
    await expect(createGamePage.createButton).toBeEnabled()
  })

  test("creates and starts a game", async ({ page }) => {
    const createGamePage = await CreateGamePage.goto(page, { mapGenerationSeed: DETERMINISTIC_GALAXY_SEED })
    const gameName = `Playwright game ${Date.now()}`

    const lobbyPage = await test.step("Configure and create the game", async () => {
      await createGamePage.setGameName(gameName)
      await createGamePage.setMaxPlayers(3)
      await createGamePage.setTurnLength({ value: 2, unit: "hours" })
      return await createGamePage.submit()
    })

    await test.step("Verify the lobby configuration", async () => {
      await expect(lobbyPage.gameNameHeading).toHaveText(gameName)
      await expect(lobbyPage.configurationValue("Number of seats")).toHaveText("3 players")
      await expect(lobbyPage.configurationValue("Time per turn")).toHaveText("2 hr")
    })

    const galaxyPage = await test.step("Start and open the game", async () => {
      await lobbyPage.startGame()
      return await lobbyPage.openGame()
    })

    await test.step("Verify the Galaxy opens", async () => {
      await expect(page).toHaveURL(GalaxyPage.urlPattern)
      await expect(galaxyPage.heading).toBeVisible()
      await expect(galaxyPage.map).toBeVisible()
    })

    await test.step("Display resources in their canonical order", async () => {
      const topBarResources = galaxyPage.resources

      const resourceLabels = await Promise.all(
        (await topBarResources.all()).map(async (resource) => await resource.getAttribute("aria-label")),
      )

      expect(resourceLabels).toEqual([
        "3 available of 3 Influence",
        "2 available of 2 Metal",
        "0 available of 0 Energy",
        "1 available of 1 Fuel",
        "0 available of 0 Colony",
      ])
    })

    await test.step("Display resource availability details on hover", async () => {
      await galaxyPage.showResourceDetails()

      const influenceDetails = galaxyPage.resourceDetails("Influence")
      await expect(influenceDetails).toBeVisible()
      await expect(influenceDetails).toContainText("3 available of 3")
    })

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

    await test.step("Open a Star System with the mouse", async () => {
      await galaxyPage.openStarSystem(selectedStar)
      await expect(galaxyPage.starSystemMap).toBeVisible()
    })

    await test.step("Open the first Planet profile with the mouse", async () => {
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
    })

    await test.step("Switch to the second Planet profile with the mouse", async () => {
      const secondPlanet = galaxyPage.planet(1)
      const secondPlanetName = await galaxyPage.getPlanetName(secondPlanet)
      await galaxyPage.openPlanetProfile(secondPlanet)
      expect(secondPlanetName).toBe("planet 983117")
      await expect(galaxyPage.planetDetailsPane.getByRole("heading", { name: secondPlanetName })).toBeVisible()
    })

    await test.step("Close the Planet profile by clicking the map", async () => {
      await galaxyPage.clickOnTheMap()
      await expect(galaxyPage.planetDetailsPane).not.toBeVisible()
    })

    await test.step("Pan the Star System away from its center", async () => {
      await galaxyPage.panStarSystem({ deltaX: 60, deltaY: 40 })
      expect(await galaxyPage.getStarSystemStarDistanceFromCenter()).toBeGreaterThan(20)
    })

    await test.step("Recenter and return to the Galaxy from a panned Star System", async () => {
      await galaxyPage.returnToGalaxy()
      await expect(galaxyPage.starSystemMap).toHaveAttribute("aria-busy", "true")
      await expect(galaxyPage.heading).not.toBeVisible()
      await expect.poll(async () => await galaxyPage.getStarSystemStarDistanceFromCenter()).toBeLessThan(1)
      await expect(galaxyPage.heading).toBeVisible()
      expect(await galaxyPage.getGalaxyCameraScale()).toBeCloseTo(cameraScaleBeforeInspecting)
      expect(await galaxyPage.getGalaxyStarDistanceFromCenter(selectedStar)).toBeLessThan(1)
    })

    await test.step("Reopen the same Star System with the mouse", async () => {
      await galaxyPage.openStarSystem(selectedStar)
      await expect(galaxyPage.starSystemMap).toHaveCount(1)
      await expect(galaxyPage.starSystemMap).toBeVisible()
    })

    await test.step("Return to the Galaxy from a centered Star System", async () => {
      await galaxyPage.returnToGalaxy()
      await expect(galaxyPage.starSystemMap).not.toHaveAttribute("aria-busy", "true")
      await expect(galaxyPage.heading).toBeVisible()
    })

    const actionsPage = await galaxyPage.openActions()
    await expect(page).toHaveURL(ActionsPage.urlPattern)
    await expect(actionsPage.heading).toBeVisible()

    await test.step("Choose an Action and reserve its resources", async () => {
      const extractMetal = actionsPage.action("Extract Metal")
      await expect(extractMetal).toContainText("Standard Directive")
      await expect(extractMetal).toContainText("1 Influence")
      await expect(extractMetal).toContainText("Gain 5 Metal.")

      const winTheGame = actionsPage.action("Win The Game")
      await expect(winTheGame).toContainText("Exceptional Program")
      await expect(winTheGame).toContainText("10 Influence")
      await expect(winTheGame).toContainText("Win the game.")
      await expect(winTheGame).toHaveAttribute("aria-disabled", "true")
      await expect(winTheGame.locator("[data-unaffordable-overlay]")).toBeVisible()
      await expect(winTheGame.locator('[aria-label="10 Influence, cannot afford"]')).toHaveClass(/text-red-400/)

      const generatePower = actionsPage.action("Generate Power")
      await actionsPage.toggleAction("Generate Power")
      await expect(generatePower).toHaveAttribute("aria-pressed", "true")
      await expect(generatePower).toHaveAttribute("aria-disabled", "false")
      await expect(generatePower.locator("[data-unaffordable-overlay]")).not.toBeVisible()
      await expect(generatePower.locator('[aria-label="3 Influence"]')).not.toHaveClass(/text-red-400/)
      await expect(generatePower.locator('[aria-label="1 Fuel"]')).not.toHaveClass(/text-red-400/)

      await expect(actionsPage.resource("Influence")).toHaveAttribute("aria-label", "0 available of 3 Influence")
      await expect(extractMetal).toHaveAttribute("aria-disabled", "true")

      await actionsPage.toggleAction("Generate Power")
      await expect(generatePower).toHaveAttribute("aria-pressed", "false")
      await expect(actionsPage.resource("Influence")).toHaveAttribute("aria-label", "3 available of 3 Influence")
    })

    await test.step("Display Action costs in their canonical order", async () => {
      const actionCosts = actionsPage.action("Win The Game").locator('[aria-label="Costs"] > [aria-label]')

      const costLabels = await Promise.all((await actionCosts.all()).map(async (cost) => await cost.getAttribute("aria-label")))

      expect(costLabels).toEqual([
        "10 Influence, cannot afford",
        "5 Metal, cannot afford",
        "5 Energy, cannot afford",
        "5 Fuel, cannot afford",
      ])
    })
  })
})
