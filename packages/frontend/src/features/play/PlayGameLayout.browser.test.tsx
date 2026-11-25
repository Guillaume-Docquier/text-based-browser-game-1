import { Assert, Logger } from "@guillaume-docquier/tools-ts"
import { focusManager, onlineManager } from "@tanstack/react-query"
import { http, HttpResponse } from "msw"
import { afterEach, describe, expect, it } from "vitest"
import { page } from "vitest/browser"
import { LoggerProvider } from "@/lib/LoggerContext.tsx"
import { setupBrowserApiWorker } from "@/testing/browserApiWorker.ts"
import { renderApplicationPage } from "@/testing/renderApplicationPage.tsx"
import { createPlayGameContextStub } from "./PlayContext.stub.ts"
import { PlayGameLayout } from "./PlayGameLayout.tsx"

describe("PlayGameLayout", () => {
  const worker = setupBrowserApiWorker()

  afterEach(() => {
    focusManager.setFocused(undefined)
    onlineManager.setOnline(true)
  })

  it("should reuse the world across readiness updates and wait for a matching world after a turn change", async () => {
    const { gameDetails, playerView, turnState } = createPlayGameContextStub()
    const nextWorld = Promise.withResolvers<number>()
    let worldRequests = 0
    let liveTurn = 2
    let isReady = false
    const worlds = [Promise.resolve(1), nextWorld.promise]
    const queries: Record<string, () => unknown> = {
      "games.getDetails": () => gameDetails,
      "gameplay.turnState": () => ({
        ...turnState,
        turn: liveTurn,
        turnEndsAt: "2099-01-01T00:00:00Z",
        readinessByPlayerId: { [playerView.player.id]: isReady },
      }),
      "gameplay.getPlayerView": async () => {
        const world = worlds[worldRequests++]
        Assert.isDefined(world)
        return { ...playerView, turn: await world }
      },
    }
    worker.use(
      http.get(/\/trpc\//, async ({ request }) => {
        const procedures = new URL(request.url).pathname.slice("/trpc/".length).split(",")
        const results = await Promise.all(
          procedures.map(async (procedure) => {
            const query = queries[procedure]
            Assert.isDefined(query)
            return { result: { data: await query() } }
          }),
        )
        return HttpResponse.json(results)
      }),
      http.post("*/trpc/gameplay.updateReadiness", () => {
        isReady = true
        return HttpResponse.json([{ result: {} }])
      }),
    )
    await renderApplicationPage(
      <LoggerProvider logger={Logger.get()}>
        <PlayGameLayout gameId={gameDetails.id} />
      </LoggerProvider>,
    )
    const lockIn = page.getByRole("button", { name: "Lock in", exact: true })
    const cancel = page.getByRole("button", { name: "Cancel lock in" })

    await page.mark("Receive an older initial world and wait through another turn-state poll", async () => {
      await expect.element(lockIn).toBeDisabled()
      await expect.poll(() => worldRequests).toBe(2)
      liveTurn = 3
      await expect.element(page.getByText("Turn 3", { exact: true })).toBeVisible()
      await expect.element(lockIn).toBeDisabled()
      expect(worldRequests).toBe(2)
      nextWorld.resolve(3)
      await expect.element(lockIn).toBeEnabled()
    })
    await page.mark("Lock in and receive the updated readiness without loading the world", async () => {
      await lockIn.click()
      await expect.element(cancel).toBeEnabled()
      expect(worldRequests).toBe(2)
    })
    await page.mark("Reconnect on the same turn and receive a fresh readiness snapshot", async () => {
      onlineManager.setOnline(false)
      await expect.element(cancel).toBeDisabled()
      isReady = false
      onlineManager.setOnline(true)
      focusManager.setFocused(false)
      focusManager.setFocused(true)
      await expect.element(lockIn).toBeEnabled()
      expect(worldRequests).toBe(2)
    })
  })
})
