import { Assert, Logger } from "@guillaume-docquier/tools-ts"
import { http, HttpResponse } from "msw"
import { sse } from "msw/sse"
import { describe, expect, it } from "vitest"
import { page } from "vitest/browser"
import { LoggerProvider } from "@/lib/LoggerContext.tsx"
import { setupBrowserApiWorker } from "@/testing/browserApiWorker.ts"
import { renderApplicationPage } from "@/testing/renderApplicationPage.tsx"
import { createPlayGameContextStub } from "./PlayContext.stub.ts"
import { PlayGameLayout } from "./PlayGameLayout.tsx"

describe("PlayGameLayout", () => {
  const worker = setupBrowserApiWorker()

  it("should reuse the world across readiness updates and wait for a matching world after a turn change", async () => {
    const { gameDetails, playerView, turnState } = createPlayGameContextStub()
    const turnEndsAt = new Date(Date.now() + 86_400_000).toISOString()
    const nextWorld = Promise.withResolvers<number>()
    let worldRequests = 0
    let liveTurn = 2
    let isReady = false
    let readinessRequest: unknown
    let sendSnapshot: () => void
    let disconnect: () => void
    let connections = 0
    const worlds = [Promise.resolve(1), nextWorld.promise, Promise.resolve(8)]
    const queries: Record<string, () => unknown> = {
      "games.getDetails": () => gameDetails,
      "gameplay.getPlayerView": async () => {
        const world = worlds[worldRequests++]
        Assert.isDefined(world)
        return { ...playerView, turn: await world }
      },
    }
    worker.use(
      sse<{ connected: string; message: string }>("*/trpc/gameplay.turnState", ({ client }) => {
        connections++
        disconnect = (): void => {
          client.close()
        }
        sendSnapshot = (): void => {
          client.send({
            data: JSON.stringify({ ...turnState, turn: liveTurn, turnEndsAt, readinessByPlayerId: { [playerView.player.id]: isReady } }),
          })
        }
        client.send({ retry: 20 })
        client.send({ event: "connected", data: "{}" })
      }),
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
      http.post("*/trpc/gameplay.updateReadiness", async ({ request }) => {
        readinessRequest = await request.json()
        isReady = true
        sendSnapshot()
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

    await page.mark("Receive an older initial world and wait for the matching world", async () => {
      await expect.poll(() => connections).toBe(1)
      sendSnapshot()
      await expect.element(lockIn).toBeDisabled()
      await expect.poll(() => worldRequests).toBe(2)
      liveTurn = 3
      sendSnapshot()
      await expect.element(page.getByText("Turn 3", { exact: true })).toBeVisible()
      await expect.element(lockIn).toBeDisabled()
      expect(worldRequests).toBe(2)
      nextWorld.resolve(3)
      await expect.element(lockIn).toBeEnabled()
    })
    await page.mark("Lock in and receive the updated readiness without loading the world", async () => {
      await lockIn.click()
      await expect.element(cancel).toBeEnabled()
      expect(readinessRequest).toStrictEqual({ 0: { gameId: playerView.gameId, turn: 3, isReady: true } })
      expect(worldRequests).toBe(2)
    })
    await page.mark("Receive updated readiness on the same turn without loading the world again", async () => {
      disconnect()
      await expect.poll(() => connections).toBe(2)
      isReady = false
      sendSnapshot()
      await expect.element(lockIn).toBeEnabled()
      expect(worldRequests).toBe(2)
    })
    await page.mark("Reconnect after several turns and fetch the current world once", async () => {
      disconnect()
      liveTurn = 8
      await expect.poll(() => connections).toBe(3)
      sendSnapshot()
      await expect.element(page.getByText("Turn 8", { exact: true })).toBeVisible()
      await expect.element(lockIn).toBeEnabled()
      expect(worldRequests).toBe(3)
    })
  })
})
