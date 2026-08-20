import { authenticatedUser } from "../authenticatedUser.ts"
import { expect, test } from "../fixtures.ts"
import { ActionsPage } from "../pages/ActionsPage.ts"
import { CreateGamePage } from "../pages/CreateGamePage.ts"
import { GalaxyPage } from "../pages/GalaxyPage.ts"
import { LobbyPage } from "../pages/LobbyPage.ts"
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
  test.use(authenticatedUser)

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

    await test.step("Configure the game", async () => {
      await createGamePage.setGameName(gameName)
      await createGamePage.setMaxPlayers(3)
      await createGamePage.setTurnLength({ value: 2, unit: "hours" })
    })

    await test.step("Create the game", async () => {
      await createGamePage.submit()
    })

    const lobbyPage = new LobbyPage(page)
    await test.step("Verify the lobby configuration", async () => {
      await expect(lobbyPage.gameNameHeading).toHaveText(gameName)
      await expect(lobbyPage.configurationValue("Number of seats")).toHaveText("3 players")
      await expect(lobbyPage.configurationValue("Time per turn")).toHaveText("2 hr")
    })

    await test.step("Start and open the game", async () => {
      await lobbyPage.startGame()
      await lobbyPage.openGame()
    })

    await test.step("Verify the Galaxy opens", async () => {
      const galaxyPage = new GalaxyPage(page)
      await expect(page).toHaveURL(GalaxyPage.urlPattern)
      await expect(galaxyPage.heading).toBeVisible()
      await expect(galaxyPage.map).toBeVisible()
    })

    await test.step("Center and fit a Galaxy region", async () => {
      const galaxyPage = new GalaxyPage(page)
      const selectedRegion = galaxyPage.regions.last()

      await selectedRegion.click()
      expect(await galaxyPage.map.getAttribute("aria-busy")).toBe("true")
      await expect.poll(async () => await galaxyPage.getGalaxyRegionDistanceFromCenter(selectedRegion)).toBeLessThan(1)
      await expect.poll(async () => await galaxyPage.getGalaxyCameraScale()).toBeLessThanOrEqual(10.5)

      await galaxyPage.zoomGalaxyOut()
      await expect.poll(async () => await galaxyPage.getGalaxyCameraScale()).toBeGreaterThan(10.5)
      await selectedRegion.click()
      expect(await galaxyPage.map.getAttribute("aria-busy")).toBe("true")
      await expect.poll(async () => await galaxyPage.getGalaxyCameraScale()).toBeLessThanOrEqual(10.5)

      await galaxyPage.resetViewButton.click()
      await expect.poll(async () => await galaxyPage.getGalaxyCameraScale()).toBe(1)
    })

    await test.step("Inspect a Star System", async () => {
      const galaxyPage = new GalaxyPage(page)
      const selectedStar = galaxyPage.stars.first()
      const initialCameraScale = await galaxyPage.getGalaxyCameraScale()
      await galaxyPage.zoomGalaxyOut()
      await expect.poll(async () => await galaxyPage.getGalaxyCameraScale()).not.toBe(initialCameraScale)
      const cameraScaleBeforeInspecting = await galaxyPage.getGalaxyCameraScale()

      await selectedStar.press("Enter")
      await expect(galaxyPage.starSystemMap).toBeVisible()

      const firstPlanet = galaxyPage.planets.first()
      const secondPlanet = galaxyPage.planets.nth(1)
      const firstPlanetName = await galaxyPage.getPlanetName(firstPlanet)
      const secondPlanetName = await galaxyPage.getPlanetName(secondPlanet)
      expect(firstPlanetName).toBe("planet 122350")
      expect(secondPlanetName).toBe("planet 983117")

      await firstPlanet.press("Enter")
      await expect(galaxyPage.planetDetailsPane).toBeVisible()
      await expect(galaxyPage.planetDetailsPane.getByRole("heading", { name: firstPlanetName })).toBeVisible()
      await expect(galaxyPage.planetDetailsPane).toContainText("Planet attributes")
      await expect(galaxyPage.planetDetailsPane).toContainText("Fertility")
      await expect(galaxyPage.planetDetailsPane).toContainText("Max population")
      await expect(galaxyPage.planetDetailsPane).toContainText("Coordinates")

      await secondPlanet.click()
      await expect(galaxyPage.planetDetailsPane.getByRole("heading", { name: secondPlanetName })).toBeVisible()

      await galaxyPage.starSystemMap.click({ position: { x: 10, y: 10 } })
      await expect(galaxyPage.planetDetailsPane).not.toBeVisible()

      await galaxyPage.panStarSystem({ deltaX: 60, deltaY: 40 })
      expect(await galaxyPage.getStarSystemStarDistanceFromCenter()).toBeGreaterThan(20)
      await galaxyPage.starSystemStar.click()
      expect(await galaxyPage.starSystemMap.getAttribute("aria-busy")).toBe("true")
      await expect(galaxyPage.heading).not.toBeVisible()
      await expect.poll(async () => await galaxyPage.getStarSystemStarDistanceFromCenter()).toBeLessThan(1)

      await expect(galaxyPage.heading).toBeVisible()
      expect(await galaxyPage.getGalaxyCameraScale()).toBeCloseTo(cameraScaleBeforeInspecting)
      expect(await galaxyPage.getGalaxyStarDistanceFromCenter(selectedStar)).toBeLessThan(1)

      await selectedStar.press("Enter")
      expect(await galaxyPage.starSystemMap.count()).toBe(1)
      await expect(galaxyPage.starSystemMap).toBeVisible()
      await galaxyPage.starSystemStar.click()
      expect(await galaxyPage.starSystemMap.getAttribute("aria-busy")).not.toBe("true")
      await expect(galaxyPage.heading).toBeVisible()
    })

    await test.step("Choose an Action from the Ruleset", async () => {
      const actionsPage = new ActionsPage(page)
      await actionsPage.open()

      await expect(page).toHaveURL(ActionsPage.urlPattern)
      await expect(actionsPage.heading).toBeVisible()

      const makeMoreMoney = actionsPage.action("Make More Money")
      await expect(makeMoreMoney).toContainText("Standard Directive")
      await expect(makeMoreMoney).toContainText("2 Money")
      await expect(makeMoreMoney).toContainText("Gain 5 Money.")

      const winTheGame = actionsPage.action("Win The Game")
      await expect(winTheGame).toContainText("Exceptional Directive")
      await expect(winTheGame).toContainText("10 Money")
      await expect(winTheGame).toContainText("Win the game.")
      await expect(winTheGame).toHaveAttribute("aria-disabled", "true")

      await makeMoreMoney.click()
      await expect(makeMoreMoney).toHaveAttribute("aria-pressed", "true")

      await makeMoreMoney.click()
      await expect(makeMoreMoney).toHaveAttribute("aria-pressed", "false")
    })
  })

  test("opens, switches, and closes the Planet profile pane", async ({ page }) => {
    const createGamePage = await CreateGamePage.goto(page)
    await createGamePage.setGameName(`Planet profile ${Date.now()}`)
    await createGamePage.submit()

    const lobbyPage = new LobbyPage(page)
    await lobbyPage.startGame()
    await lobbyPage.openGame()

    const galaxyPage = new GalaxyPage(page)
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
})
