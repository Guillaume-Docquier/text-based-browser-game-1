import { EventEmitter, once } from "node:events"
import { Time, UnitOfTime } from "@guillaume-docquier/tools-ts"
import type { Page } from "@playwright/test"
import { expect, test } from "../fixtures.ts"
import { CreateGamePage } from "../pages/CreateGamePage.ts"
import { GameDetailsPage } from "../pages/GameDetailsPage.ts"

test("an empty turn resolves when all players are ready and resets readiness", async ({ alice, bob }) => {
  const aliceGameDetailsPage = await test.step("Create a game for Alice and Bob", async () => {
    return await CreateGamePage.createGame({
      creator: alice,
      participants: [bob],
      settings: { maxPlayers: 2, turnLength: Time.create(1, UnitOfTime.DAYS) },
    })
  })
  const bobGameDetailsPage = new GameDetailsPage(bob.page)
  const aliceWorldRequests = countPlayerViewRequests(alice.page)
  const bobWorldRequests = countPlayerViewRequests(bob.page)

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

  await test.step("Both players fetch the initial world once", async () => {
    await expect(alicePlayersPage.turn).toHaveText("Turn 1")
    await expect(bobPlayersPage.turn).toHaveText("Turn 1")
    expect(aliceWorldRequests()).toBe(1)
    expect(bobWorldRequests()).toBe(1)
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
    expect(aliceWorldRequests()).toBe(1)
    expect(bobWorldRequests()).toBe(1)
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
    await expect(alicePlayersPage.readyButton).toBeEnabled()
    await expect(bobPlayersPage.readyButton).toBeEnabled()
    expect(aliceWorldRequests()).toBe(2)
    expect(bobWorldRequests()).toBe(2)
  })
})

test("a newer live turn disables readiness until the matching world loads", async ({ alice, bob }) => {
  const aliceGameDetails = await test.step("Create and start the game", async () => {
    const details = await CreateGamePage.createGame({
      creator: alice,
      participants: [bob],
      settings: { maxPlayers: 2, turnLength: Time.create(1, UnitOfTime.DAYS) },
    })
    await details.reload()
    return details
  })
  const gameId = await aliceGameDetails.getGameId()
  const aliceGalaxy = await aliceGameDetails.startGame()

  const deliveries = new EventEmitter()
  const initialWorld = once(deliveries, "initialWorld")
  const releaseInitialWorld = once(deliveries, "releaseInitialWorld")
  const releaseNextWorld = once(deliveries, "releaseNextWorld")
  const liveTurnTwo = once(deliveries, "liveTurnTwo")
  let worldRequests = 0
  const bobGameDetails = await GameDetailsPage.goto(bob.page, gameId)

  await bob.page.route(isPlayerViewRequest, async (route) => {
    worldRequests += 1
    const requestNumber = worldRequests
    const response = await route.fetch()
    if (requestNumber === 1) {
      deliveries.emit("initialWorld")
      await releaseInitialWorld
    } else if (requestNumber === 2) {
      await releaseNextWorld
    }
    await route.fulfill({ response })
  })
  bob.page.on("websocket", (socket) => {
    if (!new URL(socket.url()).pathname.endsWith("/trpc")) {
      return
    }
    socket.on("framereceived", ({ payload }) => {
      if (typeof payload === "string" && /"turn":2[,}]/.test(payload)) {
        deliveries.emit("liveTurnTwo")
      }
    })
  })

  try {
    const bobGalaxy = await bobGameDetails.openGame()
    await test.step("Hold Bob's initial world response while both players lock in", async () => {
      await initialWorld

      const bobOtherTab = await bob.page.context().newPage()
      try {
        const gameDetails = await GameDetailsPage.goto(bobOtherTab, gameId)
        const bobOtherGalaxy = await gameDetails.openGame()
        await aliceGalaxy.toggleLockIn()
        await bobOtherGalaxy.toggleLockIn()
        await liveTurnTwo
      } finally {
        await bobOtherTab.close()
      }
    })

    const players = await test.step("Show the old world with disabled readiness controls", async () => {
      deliveries.emit("releaseInitialWorld")
      const players = await bobGalaxy.openPlayers()
      await expect(players.turn).toHaveText("Turn 2")
      await expect(players.turnButton).toBeDisabled()
      await expect(players.readyButton).toBeDisabled()
      return players
    })

    await test.step("Enable readiness after fetching the new world once", async () => {
      deliveries.emit("releaseNextWorld")
      await expect(players.readyButton).toBeEnabled()
      expect(worldRequests).toBe(2)
    })
  } finally {
    deliveries.emit("releaseInitialWorld")
    deliveries.emit("releaseNextWorld")
  }
})

function isPlayerViewRequest(url: URL): boolean {
  return url.pathname.split("/").at(-1)?.split(",").includes("gameplay.getPlayerView") ?? false
}

function countPlayerViewRequests(page: Page): () => number {
  let requests = 0
  page.on("request", (request) => {
    if (isPlayerViewRequest(new URL(request.url()))) {
      requests += 1
    }
  })
  return () => requests
}
