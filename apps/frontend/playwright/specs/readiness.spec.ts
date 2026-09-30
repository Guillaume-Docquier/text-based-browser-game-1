import { Time, UnitOfTime } from "@guillaume-docquier/tools-ts"
import { expect, test } from "../fixtures.ts"
import { CreateGamePage } from "../pages/CreateGamePage.ts"
import { LobbyPage } from "../pages/LobbyPage.ts"

test("being ready locks selected actions and the turn resolves when all players are ready", async ({ alice, bob }) => {
  const aliceLobbyPage = await test.step("Create a game for Alice and Bob", async () => {
    return await CreateGamePage.createGame({
      creator: alice,
      participants: [bob],
      // long turn length to make sure the turn doesn't progress by itself
      settings: { maxPlayers: 2, turnLength: Time.create(1, UnitOfTime.DAYS) },
    })
  })
  const bobLobbyPage = new LobbyPage(bob.page)

  const alicePlayersPage = await test.step("Alice starts the game and selects an action", async () => {
    await aliceLobbyPage.reload()
    const galaxyPage = await aliceLobbyPage.startGame()
    const actionsPage = await galaxyPage.openActions()
    await actionsPage.toggleActionSelection("Extract Metal")
    await expect(actionsPage.selectActionButton("Extract Metal")).toHaveAttribute("aria-pressed", "true")
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

  await test.step("Alice locks in from the top bar and Bob sees her public status", async () => {
    await expect(alicePlayersPage.turnButton).toHaveAttribute("aria-pressed", "false")
    await expect(alicePlayersPage.turnButton).toContainText("Next turn")
    await alicePlayersPage.hoverTurnButton()
    await expect(alicePlayersPage.turnAction).toBeVisible()
    await expect(alicePlayersPage.turnAction).toHaveText("Lock in")
    await alicePlayersPage.toggleLockIn()
    await expect(alicePlayersPage.turnButton).toHaveAttribute("aria-pressed", "true")
    await expect(alicePlayersPage.turnButton).toContainText("Locked in")
    await expect(alicePlayersPage.readyButton).toHaveAttribute("aria-pressed", "true")
    await expect(bobPlayersPage.opponentReady).toBeVisible({ timeout: 15000 })
  })

  const aliceActionsPage = await test.step("Alice cannot change her actions while ready", async () => {
    const actionsPage = await alicePlayersPage.openActions()
    await expect(actionsPage.selectActionButton("Extract Metal")).toHaveAttribute("aria-disabled", "true")
    await expect(actionsPage.selectActionButton("Extract Metal")).toHaveAttribute("aria-pressed", "true")
    return actionsPage
  })

  await test.step("Alice cancels lock-in from Actions and can change her choices again", async () => {
    await aliceActionsPage.hoverTurnButton()
    await expect(aliceActionsPage.turnAction).toBeVisible()
    await expect(aliceActionsPage.turnAction).toHaveText("Cancel")
    await aliceActionsPage.toggleLockIn()
    await expect(aliceActionsPage.turnButton).toHaveAttribute("aria-pressed", "false")
    await expect(aliceActionsPage.selectActionButton("Extract Metal")).toHaveAttribute("aria-disabled", "false")
    await aliceActionsPage.toggleActionSelection("Extract Metal")
    await expect(aliceActionsPage.selectActionButton("Extract Metal")).toHaveAttribute("aria-pressed", "false")
  })

  await test.step("Alice readies", async () => {
    await aliceActionsPage.openPlayers()
    await alicePlayersPage.toggleReady()
    await expect(alicePlayersPage.readyButton).toHaveAttribute("aria-pressed", "true")
  })

  await test.step("Bob selects an action and readies", async () => {
    const actionsPage = await bobPlayersPage.openActions()
    await actionsPage.toggleActionSelection("Extract Metal")
    await expect(actionsPage.selectActionButton("Extract Metal")).toHaveAttribute("aria-pressed", "true")

    await actionsPage.openPlayers()
    await bobPlayersPage.toggleReady()
    await expect(bobPlayersPage.readyButton).toHaveAttribute("aria-pressed", "true")
  })

  await test.step("Both players advance with readiness reset", async () => {
    await expect(bobPlayersPage.turn).toHaveText("Turn 1", { timeout: 15000 })
    await expect(alicePlayersPage.turn).toHaveText("Turn 1", { timeout: 15000 })
    await expect(alicePlayersPage.turnButton).toHaveAttribute("aria-pressed", "false")
    await expect(bobPlayersPage.turnButton).toHaveAttribute("aria-pressed", "false")
    await expect(alicePlayersPage.readyButton).toHaveAttribute("aria-pressed", "false")
    await expect(bobPlayersPage.readyButton).toHaveAttribute("aria-pressed", "false")
    await expect(alicePlayersPage.opponentNotReady).toBeVisible()

    await alicePlayersPage.openActions()
    await expect(aliceActionsPage.selectActionButton("Extract Metal")).toHaveAttribute("aria-disabled", "false")
  })

  await test.step("Bob receives his action resources while Alice's resources remain unchanged", async () => {
    await expect(bobPlayersPage.resource("Influence")).toHaveAttribute("aria-label", "2 available of 2 Influence")
    await expect(bobPlayersPage.resource("Metal")).toHaveAttribute("aria-label", "7 available of 7 Metal")

    await expect(aliceActionsPage.resource("Influence")).toHaveAttribute("aria-label", "3 available of 3 Influence")
    await expect(aliceActionsPage.resource("Metal")).toHaveAttribute("aria-label", "2 available of 2 Metal")
  })
})
