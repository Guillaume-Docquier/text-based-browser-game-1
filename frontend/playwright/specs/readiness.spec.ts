import { expect, test } from "../fixtures.ts"
import { CreateGamePage } from "../pages/CreateGamePage.ts"
import { LobbyPage } from "../pages/LobbyPage.ts"

test("lets two players lock in and resolve a turn early", async ({ alice, bob }) => {
  const createGamePage = await CreateGamePage.goto(alice.page)
  const gameName = "Readiness game " + Date.now()

  const aliceLobbyPage = await test.step("Create a two-player game with a long turn interval", async () => {
    await createGamePage.setGameName(gameName)
    await createGamePage.setMaxPlayers(2)
    await createGamePage.setTurnLength({ value: 1, unit: "days" })
    await createGamePage.selectRuleset("Test")
    const lobbyPage = await createGamePage.submit()
    await expect(lobbyPage.gameNameHeading).toHaveText(gameName)
    return lobbyPage
  })

  const gameId = Number(new URL(alice.page.url()).pathname.split("/").at(-1))
  const bobLobbyPage = await LobbyPage.goto(bob.page, gameId)

  await test.step("Join and start the game", async () => {
    await bobLobbyPage.joinGame()
    await aliceLobbyPage.startGame()
    await bobLobbyPage.goto(gameId)
  })

  const aliceGalaxyPage = await aliceLobbyPage.openGame()
  const bobGalaxyPage = await bobLobbyPage.openGame()
  const alicePlayersPage = await aliceGalaxyPage.openPlayers()
  const bobPlayersPage = await bobGalaxyPage.openPlayers()

  await test.step("Show both players as not ready", async () => {
    await expect(alicePlayersPage.heading).toBeVisible()
    await expect(alicePlayersPage.playerRows).toHaveCount(2)
    await expect(alicePlayersPage.readinessControl).toHaveAttribute("aria-pressed", "false")
    await expect(alicePlayersPage.opponentNotReadyStatus()).toBeVisible()
    await expect(bobPlayersPage.readinessControl).toHaveAttribute("aria-pressed", "false")
    await expect(bobPlayersPage.opponentNotReadyStatus()).toBeVisible()
  })

  await test.step("Let Alice toggle readiness and lock her actions", async () => {
    await alicePlayersPage.toggleReadiness()
    await expect(alicePlayersPage.readinessControl).toHaveAttribute("aria-pressed", "true")

    const aliceActionsPage = await alicePlayersPage.openActions()
    await expect(aliceActionsPage.action("Generate Power")).toBeDisabled()

    const playersPageAfterUnready = await aliceActionsPage.openPlayers()
    await playersPageAfterUnready.toggleReadiness()
    await expect(playersPageAfterUnready.readinessControl).toHaveAttribute("aria-pressed", "false")
    await playersPageAfterUnready.toggleReadiness()
    await expect(playersPageAfterUnready.readinessControl).toHaveAttribute("aria-pressed", "true")
  })

  await test.step("Show Alice's readiness to Bob and resolve the turn", async () => {
    await bobPlayersPage.refresh()
    await expect(bobPlayersPage.opponentReadyStatus()).toBeVisible()
    await bobPlayersPage.toggleReadiness()
    await expect(bobPlayersPage.readinessControl).toHaveAttribute("aria-pressed", "true")

    await expect
      .poll(
        async () => {
          await bobPlayersPage.refresh()
          return await bobPlayersPage.turn.textContent()
        },
        { timeout: 15_000 },
      )
      .toBe("1")
  })

  await test.step("Reset readiness for the new turn", async () => {
    await expect(bobPlayersPage.turnStatus).toHaveText("Collecting actions")
    await expect(bobPlayersPage.readinessControl).toHaveAttribute("aria-pressed", "false")
    await expect(bobPlayersPage.opponentNotReadyStatus()).toBeVisible()
  })
})
