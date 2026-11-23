import { focusManager, QueryClient, useMutation } from "@tanstack/react-query"
import { http, HttpResponse } from "msw"
import { type ReactElement, useState } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { page } from "vitest/browser"
import { useBackendApiClient } from "@/lib/api/BackendApiClientContext.tsx"
import { setupBrowserApiWorker } from "@/testing/browserApiWorker.ts"
import { renderApplicationPage } from "@/testing/renderApplicationPage.tsx"
import { Onboarding } from "./Onboarding.tsx"

function OnboardingVisit(): ReactElement {
  const [visit, setVisit] = useState(0)
  const api = useBackendApiClient()
  const createGame = useMutation(api.games.create.mutationOptions())
  return (
    <Onboarding key={visit} isSignedIn>
      <button
        onClick={() => {
          setVisit(visit + 1)
        }}
      >
        Reopen page
      </button>
      <button
        onClick={() => {
          createGame.mutate({ configuration: { name: "Orion", nbSeats: 2, turnIntervalSeconds: 3600 } })
        }}
      >
        Create game
      </button>
      {createGame.isSuccess && <output>Game created</output>}
    </Onboarding>
  )
}

describe("Onboarding", () => {
  const worker = setupBrowserApiWorker()
  const statusEndpoint = "*/trpc/accounts.isOnboarded"
  const dialog = page.getByRole("dialog", { name: "Welcome, commander" })

  afterEach(() => {
    focusManager.setFocused(undefined)
    vi.useRealTimers()
  })

  it("should keep the page usable until the first status response opens onboarding", async () => {
    const status = Promise.withResolvers<boolean>()
    let requests = 0
    worker.use(
      http.get(statusEndpoint, async () => {
        requests++
        return HttpResponse.json([{ result: { data: await status.promise } }])
      }),
    )
    await renderApplicationPage(
      <Onboarding isSignedIn>
        <input aria-label="Game name" />
      </Onboarding>,
    )

    await page.mark("Use the page while onboarding status is pending", async () => {
      await expect.poll(() => requests).toBe(1)
      await expect.element(dialog).not.toBeInTheDocument()
      const name = page.getByRole("textbox", { name: "Game name" })
      await name.fill("Orion")
      await expect.element(name).toHaveValue("Orion")
    })
    await page.mark("Receive the first response and see the alias prompt", async () => {
      status.resolve(false)
      await expect.element(dialog).toBeVisible()
      expect(requests).toBe(1)
    })
  })

  it("should stop after three retries and keep the failed status query idle across subsequent visits", async () => {
    let requests = 0
    worker.use(
      http.get(statusEndpoint, () => {
        requests++
        return HttpResponse.json([{ error: { message: "Status unavailable", code: -32603 } }], { status: 500 })
      }),
      http.post("*/trpc/games.create", () => HttpResponse.json([{ result: { data: { createdGameId: 1 } } }])),
    )
    const queryClient = new QueryClient()
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"], shouldAdvanceTime: true })
    await renderApplicationPage(<OnboardingVisit />, queryClient)
    await page.mark("Exhaust the retry budget and keep using the page", async () => {
      await expect.poll(() => requests).toBe(1)
      await expect
        .poll(async () => {
          await vi.advanceTimersByTimeAsync(30_000)
          return queryClient.isFetching()
        })
        .toBe(0)
      expect(requests).toBe(4)
      await expect.element(dialog).not.toBeInTheDocument()
    })
    await page.mark("Return focus and reopen the page", async () => {
      focusManager.setFocused(false)
      focusManager.setFocused(true)
      await page.getByRole("button", { name: "Reopen page" }).click()
      await vi.advanceTimersByTimeAsync(30_000)
      expect(queryClient.isFetching()).toBe(0)
      expect(requests).toBe(4)
    })
    await page.mark("Complete an unrelated mutation without restarting onboarding", async () => {
      await page.getByRole("button", { name: "Create game" }).click()
      await expect.element(page.getByRole("status")).toHaveTextContent("Game created")
      await vi.advanceTimersByTimeAsync(30_000)
      expect(queryClient.isFetching()).toBe(0)
      expect(requests).toBe(4)
    })
  })
})
