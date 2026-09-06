import { expect, test } from "../fixtures.ts"
import { CreateGamePage } from "../pages/CreateGamePage.ts"
import { LobbyPage } from "../pages/LobbyPage.ts"

test("Alice and Bob can lock their choices and resolve a turn early", async ({ alice, bob }) => {
  test.setTimeout(60_000)
  const aliceLobbyPage = await test.step("Alice creates a two-player game with a long turn interval", async () => {
    const createGamePage = await CreateGamePage.goto(alice.page)
    await createGamePage.setGameName(`Readiness ${Date.now()}`)
    await createGamePage.setMaxPlayers(2)
    await createGamePage.setTurnLength({ value: 1, unit: "days" })
    await createGamePage.selectRuleset("Test")
    return await createGamePage.submit()
  })

  const bobLobbyPage = await test.step("Bob joins Alice's lobby", async () => {
    const lobbyPage = await LobbyPage.goto(bob.page, await aliceLobbyPage.getGameId())
    await lobbyPage.joinGame()
    return lobbyPage
  })

  const alicePlayersPage = await test.step("Alice starts the game and targets a fleet build", async () => {
    await aliceLobbyPage.reload()
    await aliceLobbyPage.startGame()
    const galaxyPage = await aliceLobbyPage.openGame()
    const actionsPage = await galaxyPage.openActions()
    await actionsPage.selectTarget("Build Fleet (Standard)")
    await actionsPage.toggleAction("Build Fleet (Standard)")
    await expect(actionsPage.action("Build Fleet (Standard)")).toHaveAttribute("aria-pressed", "true")
    return await actionsPage.openPlayers()
  })

  const bobPlayersPage = await test.step("Bob opens the Players tab", async () => {
    await bobLobbyPage.reload()
    const galaxyPage = await bobLobbyPage.openGame()
    const playersPage = await galaxyPage.openPlayers()
    await expect(playersPage.readyButton).toHaveAttribute("aria-pressed", "false")
    await expect(playersPage.opponentNotReady).toBeVisible()
    return playersPage
  })

  await test.step("Alice readies and Bob sees her public status", async () => {
    await alicePlayersPage.toggleReady()
    await expect(alicePlayersPage.readyButton).toHaveAttribute("aria-pressed", "true")
    await expect(bobPlayersPage.opponentReady).toBeVisible({ timeout: 15000 })
  })

  const aliceActionsPage = await test.step("Alice cannot change her targeted action while ready", async () => {
    const actionsPage = await alicePlayersPage.openActions()
    await expect(actionsPage.action("Build Fleet (Standard)")).toHaveAttribute("aria-disabled", "true")
    await expect(actionsPage.action("Build Fleet (Standard)")).toHaveAttribute("aria-pressed", "true")
    await expect(actionsPage.target("Build Fleet (Standard)")).toBeDisabled()
    await expect(actionsPage.target("Build Fleet (Standard)")).toHaveValue(/\d+/)
    return actionsPage
  })

  await test.step("Alice unreadies and can change her choices again", async () => {
    await aliceActionsPage.openPlayers()
    await alicePlayersPage.toggleReady()
    await expect(alicePlayersPage.readyButton).toHaveAttribute("aria-pressed", "false")

    await alicePlayersPage.openActions()
    await expect(aliceActionsPage.action("Build Fleet (Standard)")).toHaveAttribute("aria-disabled", "false")
    await aliceActionsPage.toggleAction("Build Fleet (Standard)")
    await expect(aliceActionsPage.action("Build Fleet (Standard)")).toHaveAttribute("aria-pressed", "false")
  })

  await test.step("Alice readies", async () => {
    await aliceActionsPage.selectTarget("Build Fleet (Standard)")
    await aliceActionsPage.toggleAction("Build Fleet (Standard)")
    await expect(aliceActionsPage.action("Build Fleet (Standard)")).toHaveAttribute("aria-pressed", "true")
    await aliceActionsPage.openPlayers()
    await alicePlayersPage.toggleReady()
    await expect(alicePlayersPage.readyButton).toHaveAttribute("aria-pressed", "true")
  })

  await test.step("Bob selects an action and readies", async () => {
    const actionsPage = await bobPlayersPage.openActions()
    await actionsPage.selectTarget("Build Fleet (Standard)")
    await actionsPage.toggleAction("Build Fleet (Standard)")
    await expect(actionsPage.action("Build Fleet (Standard)")).toHaveAttribute("aria-pressed", "true")

    await actionsPage.openPlayers()
    await bobPlayersPage.toggleReady()
    await expect(bobPlayersPage.readyButton).toHaveAttribute("aria-pressed", "true")
  })

  await test.step("Both players advance with readiness reset", async () => {
    await expect(bobPlayersPage.turn).toHaveText("Turn1", { timeout: 30000 })
    await expect(alicePlayersPage.turn).toHaveText("Turn1", { timeout: 30000 })
    await expect(alicePlayersPage.readyButton).toHaveAttribute("aria-pressed", "false")
    await expect(bobPlayersPage.readyButton).toHaveAttribute("aria-pressed", "false")
    await expect(alicePlayersPage.opponentNotReady).toBeVisible()

    await alicePlayersPage.openActions()
    await expect(aliceActionsPage.action("Build Fleet (Standard)")).toHaveAttribute("aria-pressed", "false")
  })

  await test.step("Both players see the resolved fleets and paid costs", async () => {
    const aliceFleetsPage = await aliceActionsPage.openFleets()
    const bobFleetsPage = await bobPlayersPage.openFleets()
    await expect(aliceFleetsPage.heading).toBeVisible()
    await expect(aliceFleetsPage.fleetRows).toHaveCount(2)
    await expect(aliceFleetsPage.fleetRows).toContainText(["10", "planet"])
    await expect(bobFleetsPage.fleetRows).toHaveCount(2)

    await expect(bobFleetsPage.resource("Influence")).toHaveAttribute("aria-label", "1 available of 1 Influence")
    await expect(bobFleetsPage.resource("Metal")).toHaveAttribute("aria-label", "1 available of 1 Metal")
    await expect(aliceFleetsPage.resource("Influence")).toHaveAttribute("aria-label", "1 available of 1 Influence")
    await expect(aliceFleetsPage.resource("Metal")).toHaveAttribute("aria-label", "1 available of 1 Metal")
  })
})
