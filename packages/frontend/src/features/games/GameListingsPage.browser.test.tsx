import type { GameListing } from "@api-types"
import { http, HttpResponse } from "msw"
import { GameIdSchema } from "shared/domain/games/GameId.ts"
import { GameStatus } from "shared/domain/games/GameStatus.ts"
import { describe, expect, it } from "vitest"
import { page } from "vitest/browser"
import { setupBrowserApiWorker } from "@/testing/browserApiWorker.test-support.ts"
import { renderApplicationPage } from "@/testing/renderApplicationPage.test-support.tsx"
import { GameListingsPage } from "./GameListingsPage.tsx"

describe("GameListingsPage", () => {
  const worker = setupBrowserApiWorker()

  it("should combine the game name and membership filters and restore results when cleared", async () => {
    const lobby = {
      nbPlayers: 1,
      nbSeats: 2,
      status: GameStatus.WAITING_FOR_PLAYERS,
      createdAt: "2026-01-01T00:00:00Z",
      startedAt: null,
      endedAt: null,
    }
    const games: GameListing[] = [
      { ...lobby, id: GameIdSchema.parse(1), name: "Outer Sol", hasJoined: true },
      { ...lobby, id: GameIdSchema.parse(2), name: "Inner Sol", hasJoined: false },
      { ...lobby, id: GameIdSchema.parse(3), name: "Orion", hasJoined: true },
    ]
    worker.use(http.get("*/trpc/games.getListings", () => HttpResponse.json([{ result: { data: games } }])))
    await renderApplicationPage(<GameListingsPage isSignedIn />)
    const search = page.getByRole("textbox")
    const outerSol = page.getByRole("link", { name: /Outer Sol/ })
    const innerSol = page.getByRole("link", { name: /Inner Sol/ })
    const orion = page.getByRole("link", { name: /Orion/ })
    await page.mark("Search for Sol games", async () => {
      await search.fill("Sol")
      await expect.element(outerSol).toBeVisible()
      await expect.element(innerSol).toBeVisible()
      await expect.element(orion).not.toBeInTheDocument()
    })
    await page.mark("Limit matching games to my memberships", async () => {
      await page.getByRole("button", { name: "My games" }).click()
      await expect.element(outerSol).toBeVisible()
      await expect.element(innerSol).not.toBeInTheDocument()
      await expect.element(orion).not.toBeInTheDocument()
    })
    await page.mark("Clear the search and keep the membership filter", async () => {
      await search.fill("")
      await expect.element(outerSol).toBeVisible()
      await expect.element(orion).toBeVisible()
      await expect.element(innerSol).not.toBeInTheDocument()
    })
  })
})
