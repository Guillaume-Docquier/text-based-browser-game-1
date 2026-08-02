import { authenticatedUser } from "../authenticatedUser.ts"
import { expect, test } from "../fixtures.ts"
import { CreateGamePage } from "../pages/CreateGamePage.ts"
import { LobbyPage } from "../pages/LobbyPage.ts"
import { SignInPage } from "../pages/SignInPage.ts"
import { StarSystemPage } from "../pages/StarSystemPage.ts"

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

  test("creates and starts a game with a deterministic star system", async ({ page }) => {
    const createGamePage = await CreateGamePage.goto(page)
    const gameName = `Playwright game ${Date.now()}`

    await test.step("Configure the game and star system", async () => {
      await createGamePage.setGameName(gameName)
      await createGamePage.setMaxPlayers(3)
      await createGamePage.setTurnLength({ value: 2, unit: "hours" })
      await createGamePage.setRange({ label: "Planets", min: 1, max: 2 })
      await createGamePage.setRange({ label: "Planet density", min: 0.85, max: 1 })
      await createGamePage.setRange({ label: "Moons per planet", min: 1, max: 1 })
      await createGamePage.setRange({ label: "Asteroid belts", min: 1, max: 1 })
      await createGamePage.setRange({ label: "Asteroids per sector", min: 1, max: 1 })
      await createGamePage.setGenerationSeed(0)
    })

    await test.step("Create the game", async () => {
      await createGamePage.submit()
    })

    const lobbyPage = new LobbyPage(page)
    await test.step("Verify the lobby configuration", async () => {
      await expect(lobbyPage.gameNameHeading).toHaveText(gameName)
      await expect(lobbyPage.configurationValue("Number of seats")).toHaveText("3 players")
      await expect(lobbyPage.configurationValue("Time per turn")).toHaveText("2 hr")
      await expect(lobbyPage.configurationValue("Planets")).toHaveText("1–2")
      await expect(lobbyPage.configurationValue("Planet density")).toHaveText("0.85–1")
      await expect(lobbyPage.configurationValue("Moons per planet")).toHaveText("1")
      await expect(lobbyPage.configurationValue("Asteroid belts")).toHaveText("1")
      await expect(lobbyPage.configurationValue("Asteroids per sector")).toHaveText("1")
      await expect(lobbyPage.configurationValue("Generation seed")).toHaveText("0")
    })

    await test.step("Start and open the game", async () => {
      await lobbyPage.startGame()
      await lobbyPage.openGame()
    })

    await test.step("Verify the generated star system", async () => {
      const starSystemPage = new StarSystemPage(page)
      await expect(page).toHaveURL(StarSystemPage.urlPattern)
      await expect(starSystemPage.summary).toHaveText("2 orbits · 6 sectors · 6 bodies")
    })
  })
})
