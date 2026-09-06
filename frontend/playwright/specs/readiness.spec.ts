import { expect, test } from "../fixtures.ts"
import { CreateGamePage } from "../pages/CreateGamePage.ts"
import { LobbyPage } from "../pages/LobbyPage.ts"

test("Alice and Bob can lock their choices and resolve a turn early", async ({ alice, bob }) => {
  const aliceLobby = await test.step("Alice creates a two-player game with a long turn interval", async () => {
    const create = await CreateGamePage.goto(alice.page)
    await create.setGameName(`Readiness ${Date.now()}`)
    await create.setMaxPlayers(2)
    await create.setTurnLength({ value: 1, unit: "days" })
    await create.selectRuleset("Test")
    return await create.submit()
  })
  const bobLobby = await test.step("Bob joins Alice's lobby", async () => {
    const lobby = await LobbyPage.goto(bob.page, await aliceLobby.getGameId())
    await lobby.joinGame()
    return lobby
  })
  const alicePlayers = await test.step("Alice starts the game and selects an action", async () => {
    await aliceLobby.reload()
    await aliceLobby.startGame()
    const galaxy = await aliceLobby.openGame()
    const actions = await galaxy.openActions()
    await actions.toggleAction("Extract Metal")
    await expect(actions.action("Extract Metal")).toHaveAttribute("aria-pressed", "true")
    return await actions.openPlayers()
  })
  const bobPlayers = await test.step("Bob opens the Players tab", async () => {
    await bobLobby.reload()
    const galaxy = await bobLobby.openGame()
    const players = await galaxy.openPlayers()
    await expect(players.readyButton).toHaveAttribute("aria-pressed", "false")
    await expect(players.opponentNotReady).toBeVisible()
    return players
  })
  await test.step("Alice readies and Bob sees her public status", async () => {
    await alicePlayers.toggleReady()
    await expect(alicePlayers.readyButton).toHaveAttribute("aria-pressed", "true")
    await expect(bobPlayers.opponentReady).toBeVisible({ timeout: 15000 })
    const actions = await alicePlayers.openActions()
    await expect(actions.action("Extract Metal")).toHaveAttribute("aria-disabled", "true")
    await expect(actions.action("Extract Metal")).toHaveAttribute("aria-pressed", "true")
  })
  await test.step("Alice unreadies and can change her choices again", async () => {
    await alicePlayers.openPlayers()
    await alicePlayers.toggleReady()
    await expect(alicePlayers.readyButton).toHaveAttribute("aria-pressed", "false")
    const actions = await alicePlayers.openActions()
    await expect(actions.action("Extract Metal")).toHaveAttribute("aria-disabled", "false")
    await actions.toggleAction("Extract Metal")
    await expect(actions.action("Extract Metal")).toHaveAttribute("aria-pressed", "false")
    await actions.openPlayers()
    await alicePlayers.toggleReady()
    await expect(alicePlayers.readyButton).toHaveAttribute("aria-pressed", "true")
  })
  await test.step("Bob readies and both players advance with readiness reset", async () => {
    await bobPlayers.toggleReady()
    await expect(bobPlayers.turn).toHaveText("Turn1", { timeout: 15000 })
    await expect(alicePlayers.turn).toHaveText("Turn1", { timeout: 15000 })
    await expect(alicePlayers.readyButton).toHaveAttribute("aria-pressed", "false")
    await expect(bobPlayers.readyButton).toHaveAttribute("aria-pressed", "false")
    await expect(alicePlayers.opponentNotReady).toBeVisible()
    const actions = await alicePlayers.openActions()
    await expect(actions.action("Extract Metal")).toHaveAttribute("aria-disabled", "false")
  })
})
