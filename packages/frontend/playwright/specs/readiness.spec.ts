import { Time, UnitOfTime } from "@guillaume-docquier/tools-ts"
import { expect, test } from "../fixtures.ts"
import { CreateGamePage } from "../pages/CreateGamePage.ts"
import { GameDetailsPage } from "../pages/GameDetailsPage.ts"

test("an empty turn resolves when all players are ready and resets readiness", async ({ alice, bob }) => {
  const aliceGameDetailsPage = await test.step("Create a game for Alice and Bob", async () => {
    return await CreateGamePage.createGame({
      creator: alice,
      participants: [bob],
      // long turn length to make sure the turn doesn't progress by itself
      settings: { maxPlayers: 2, turnLength: Time.create(1, UnitOfTime.DAYS) },
    })
  })
  const bobGameDetailsPage = new GameDetailsPage(bob.page)

  const alicePlayersPage = await test.step("Alice starts the game and opens the Players tab", async () => {
    await aliceGameDetailsPage.reload()
    const galaxyPage = await aliceGameDetailsPage.startGame()
    return await galaxyPage.openPlayers()
  })

  const bobPlayersPage = await test.step("Bob opens the Players tab", async () => {
    await bobGameDetailsPage.reload()
    const galaxyPage = await bobGameDetailsPage.openGame()
    const playersPage = await galaxyPage.openPlayers()
    await expect(playersPage.readyButton).toHaveAttribute("aria-pressed", "false")
    await expect(playersPage.opponentNotReady).toBeVisible()
    return playersPage
  })

  await test.step("Alice locks in from the top bar and Bob sees her public status", async () => {
    await alicePlayersPage.toggleLockIn()
    await expect(alicePlayersPage.readyButton).toHaveAttribute("aria-pressed", "true")
    await expect(bobPlayersPage.opponentReady).toBeVisible({ timeout: 15000 })
  })

  await test.step("Alice cancels lock-in and Bob sees her public status change", async () => {
    await alicePlayersPage.toggleLockIn()
    await expect(alicePlayersPage.readyButton).toHaveAttribute("aria-pressed", "false")
    await expect(bobPlayersPage.opponentNotReady).toBeVisible({ timeout: 15000 })
  })

  await test.step("Alice readies", async () => {
    await alicePlayersPage.toggleReady()
    await expect(alicePlayersPage.readyButton).toHaveAttribute("aria-pressed", "true")
  })

  await test.step("Bob readies", async () => {
    await bobPlayersPage.toggleReady()
  })

  await test.step("Both players advance with readiness reset", async () => {
    await expect(bobPlayersPage.turn).toHaveText("Turn 2", { timeout: 15000 })
    await expect(alicePlayersPage.turn).toHaveText("Turn 2", { timeout: 15000 })
    await expect(alicePlayersPage.readyButton).toHaveAttribute("aria-pressed", "false")
    await expect(bobPlayersPage.readyButton).toHaveAttribute("aria-pressed", "false")
    await expect(alicePlayersPage.opponentNotReady).toBeVisible()
  })
})
