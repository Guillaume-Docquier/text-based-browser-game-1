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
      const initialCameraTransform = await galaxyPage.getGalaxyCameraTransform()
      await galaxyPage.zoomGalaxyIn()
      await expect.poll(async () => galaxyPage.getGalaxyCameraTransform()).not.toBe(initialCameraTransform)
      const cameraTransformBeforeInspecting = await galaxyPage.getGalaxyCameraTransform()

      await galaxyPage.stars.first().press("Enter")
      await expect(galaxyPage.starSystemMap).toBeVisible()

      await galaxyPage.starSystemStar.click()
      await expect(galaxyPage.heading).toBeVisible()
      await expect.poll(async () => galaxyPage.getGalaxyCameraTransform()).toBe(cameraTransformBeforeInspecting)
    })
  })
})
