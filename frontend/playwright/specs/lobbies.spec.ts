import { authenticatedUser } from "../authenticatedUser.ts"
import { expect, test } from "../fixtures.ts"
import { CreateGamePage } from "../pages/CreateGamePage.ts"
import { GalaxyPage } from "../pages/GalaxyPage.ts"
import { LobbyPage } from "../pages/LobbyPage.ts"
import { SignInPage } from "../pages/SignInPage.ts"

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
    const createGamePage = await CreateGamePage.goto(page)
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

    await test.step("Inspect a Star System", async () => {
      const galaxyPage = new GalaxyPage(page)
      const selectedStar = galaxyPage.stars.first()
      const initialCameraScale = await galaxyPage.getGalaxyCameraScale()
      await galaxyPage.zoomGalaxyIn()
      await expect.poll(async () => await galaxyPage.getGalaxyCameraScale()).not.toBe(initialCameraScale)
      const cameraScaleBeforeInspecting = await galaxyPage.getGalaxyCameraScale()

      await selectedStar.press("Enter")
      await expect(galaxyPage.starSystemMap).not.toBeVisible()
      await expect(galaxyPage.starSystemMap).toBeVisible()

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
  })
})
