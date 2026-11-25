import { Time, UnitOfTime } from "@guillaume-docquier/tools-ts"
import type { CDPSession, Page } from "@playwright/test"
import { z } from "zod"
import { expect, test } from "../fixtures.ts"
import { CreateGamePage } from "../pages/CreateGamePage.ts"
import { GameDetailsPage } from "../pages/GameDetailsPage.ts"

test("an empty turn resolves when all players are ready and resets readiness", async ({ alice, bob }) => {
  const aliceNetwork = await alice.page.context().newCDPSession(alice.page)
  const turnStateProtocols: Array<string | undefined> = []
  await alice.page.clock.install()
  aliceNetwork.on("Network.responseReceived", ({ response }) => {
    if (new URL(response.url).pathname.endsWith("/gameplay.turnState")) {
      turnStateProtocols.push(response.protocol)
    }
  })
  await aliceNetwork.send("Network.enable")

  const worldRequests = { alice: 0, bob: 0 }
  const sessions = { alice, bob }
  for (const player of ["alice", "bob"] as const) {
    sessions[player].page.on("request", (request) => {
      if (isPlayerViewUrl(new URL(request.url()))) {
        worldRequests[player]++
      }
    })
  }
  const aliceGameDetailsPage = await test.step("Create a game for Alice and Bob", async () => {
    return await CreateGamePage.createGame({
      creator: alice,
      participants: [bob],
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

  await test.step("Both players receive turn 1 with one world request per tab", async () => {
    await expect(alicePlayersPage.turn).toHaveText("Turn 1")
    await expect(bobPlayersPage.turn).toHaveText("Turn 1")
    expect(turnStateProtocols).toEqual(["h2"])
    expect(worldRequests).toEqual({ alice: 1, bob: 1 })
  })

  await test.step("Alice keeps the game open past the former polling interval", async () => {
    await alice.page.clock.runFor(6_000)
    expect(worldRequests).toEqual({ alice: 1, bob: 1 })
  })

  await test.step("Alice reconnects during the same turn and reuses her world", async () => {
    const requestId = await pauseTurnStateReconnect(alice.page, aliceNetwork)
    await expect(alicePlayersPage.turnButton).toBeDisabled()
    await resumeTurnStateReconnect(aliceNetwork, requestId)
    await expect(alicePlayersPage.turnButton).toBeEnabled()
    expect(worldRequests).toEqual({ alice: 1, bob: 1 })
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
    expect(worldRequests).toEqual({ alice: 1, bob: 1 })
  })

  await test.step("Alice readies", async () => {
    await alicePlayersPage.toggleReady()
    await expect(alicePlayersPage.readyButton).toHaveAttribute("aria-pressed", "true")
  })

  await test.step("Bob advances the turn while Alice's reconnect is waiting", async () => {
    const requestId = await pauseTurnStateReconnect(alice.page, aliceNetwork)
    await expect(alicePlayersPage.turnButton).toBeDisabled()
    await bobPlayersPage.toggleReady()
    await expect(bobPlayersPage.turn).toHaveText("Turn 2", { timeout: 15000 })
    await expect(alicePlayersPage.turn).toHaveText("Turn 1")
    await resumeTurnStateReconnect(aliceNetwork, requestId)
  })

  await test.step("Both players advance with readiness reset", async () => {
    await expect(bobPlayersPage.turn).toHaveText("Turn 2", { timeout: 15000 })
    await expect(alicePlayersPage.turn).toHaveText("Turn 2", { timeout: 15000 })
    await expect(alicePlayersPage.readyButton).toHaveAttribute("aria-pressed", "false")
    await expect(bobPlayersPage.readyButton).toHaveAttribute("aria-pressed", "false")
    await expect(alicePlayersPage.opponentNotReady).toBeVisible()
    await expect(alicePlayersPage.turnButton).toBeEnabled()
    await expect(bobPlayersPage.turnButton).toBeEnabled()
    expect(worldRequests).toEqual({ alice: 2, bob: 2 })
    expect(turnStateProtocols).toEqual(["h2", "h2", "h2"])
  })
})

test("a newer live turn gates readiness while the first world request is in flight", async ({ alice, bob }) => {
  const aliceDetails = await test.step("Create a game for Alice and Bob", async () => {
    return await CreateGamePage.createGame({
      creator: alice,
      participants: [bob],
      settings: { maxPlayers: 2, turnLength: Time.create(1, UnitOfTime.DAYS) },
    })
  })
  const bobDetails = new GameDetailsPage(bob.page)

  const { alicePlayers, bobPlayers } = await test.step("Open the game and have Bob lock in", async () => {
    await aliceDetails.reload()
    const alicePlayers = await (await aliceDetails.startGame()).openPlayers()
    await bobDetails.reload()
    const bobPlayers = await (await bobDetails.openGame()).openPlayers()
    await bobPlayers.toggleLockIn()
    await expect(alicePlayers.opponentReady).toBeVisible()
    return { alicePlayers, bobPlayers }
  })

  const firstWorldReceived = Promise.withResolvers<string>()
  const nextWorldReceived = Promise.withResolvers<string>()
  let worldRequests = 0
  const network = await bob.page.context().newCDPSession(bob.page)
  network.on("Fetch.requestPaused", ({ requestId }) => {
    worldRequests++
    if (worldRequests === 1) {
      firstWorldReceived.resolve(requestId)
    } else {
      nextWorldReceived.resolve(requestId)
    }
  })
  await network.send("Network.enable")
  await network.send("Fetch.enable", {
    patterns: [{ urlPattern: "*/trpc/*gameplay.getPlayerView*", requestStage: "Response" }],
  })
  const liveTurnTwo = Promise.withResolvers<undefined>()
  const liveTurnSchema = z.object({ turn: z.literal(2) })
  network.on("Network.eventSourceMessageReceived", ({ eventName, data }) => {
    if (eventName === "message" && liveTurnSchema.safeParse(JSON.parse(data)).success) {
      liveTurnTwo.resolve(undefined)
    }
  })

  try {
    await test.step("Bob reopens the game and Alice advances the turn while Bob's world response waits", async () => {
      await bob.page.reload({ waitUntil: "domcontentloaded" })
      await firstWorldReceived.promise
      await alicePlayers.toggleLockIn()
      await liveTurnTwo.promise
    })

    await test.step("Bob sees turn 2 and can lock in only once the new world arrives", async () => {
      await network.send("Fetch.continueResponse", { requestId: await firstWorldReceived.promise })
      await expect(bobPlayers.turn).toHaveText("Turn 2")
      await expect(bobPlayers.turnButton).toBeDisabled()
      await expect(bobPlayers.readyButton).toBeDisabled()

      await network.send("Fetch.continueResponse", { requestId: await nextWorldReceived.promise })
      await expect(bobPlayers.turnButton).toBeEnabled()
      await expect(bobPlayers.readyButton).toBeEnabled()
      expect(worldRequests).toBe(2)
    })
  } finally {
    await network.send("Fetch.disable")
  }
})

async function pauseTurnStateReconnect(page: Page, network: CDPSession): Promise<string> {
  const reconnect = Promise.withResolvers<string>()
  network.once("Fetch.requestPaused", ({ requestId }) => {
    reconnect.resolve(requestId)
  })
  await network.send("Fetch.enable", {
    patterns: [{ urlPattern: "*/trpc/gameplay.turnState?*", requestStage: "Request" }],
  })
  await page.clock.fastForward(46_000)
  await page.clock.setSystemTime(new Date())
  return await reconnect.promise
}

async function resumeTurnStateReconnect(network: CDPSession, requestId: string): Promise<void> {
  await network.send("Fetch.continueRequest", { requestId })
  await network.send("Fetch.disable")
}

function isPlayerViewUrl(url: URL): boolean {
  return url.pathname.split("/").at(-1)?.split(",").includes("gameplay.getPlayerView") === true
}
