import { useMutation } from "@tanstack/react-query"
import { http, HttpResponse } from "msw"
import { setupWorker } from "msw/browser"
import { type ReactElement, useState } from "react"
import { describe, onTestFinished, expect, it } from "vitest"
import { page } from "vitest/browser"
import { useBackendApiClient } from "@/lib/api/BackendApiClientContext.tsx"
import { renderApiRoute } from "@/lib/api/renderApiRoute.test-support.tsx"
import { Onboarding } from "./Onboarding.tsx"

function Session(): ReactElement {
  const [mounted, setMounted] = useState(true)
  const api = useBackendApiClient()
  const create = useMutation(api.games.create.mutationOptions())
  return (
    <>
      <button
        type="button"
        onClick={() => {
          setMounted(!mounted)
        }}
      >
        {mounted ? "Leave page" : "Return to page"}
      </button>
      {mounted && (
        <Onboarding isSignedIn>
          <button
            type="button"
            onClick={() => {
              create.mutate({ configuration: { name: "Lobby", nbSeats: 2, turnIntervalSeconds: 3600, mapGenerationSeed: undefined } })
            }}
          >
            Create game
          </button>
        </Onboarding>
      )}
      {create.isSuccess && <p>Created game {create.data.createdGameId}</p>}
    </>
  )
}

describe("Onboarding", () => {
  it("should keep the page usable and stop retrying onboarding after three retries", async () => {
    let requests = 0
    const response = Promise.withResolvers<undefined>()
    const worker = setupWorker(
      http.get("*/trpc/accounts.isOnboarded", async () => {
        requests++
        await response.promise
        return HttpResponse.json(
          [{ error: { message: "Status unavailable", code: -32603, data: { code: "INTERNAL_SERVER_ERROR", httpStatus: 500 } } }],
          { status: 500 },
        )
      }),
      http.post("*/trpc/games.create", () => HttpResponse.json([{ result: { data: { createdGameId: 42 } } }])),
    )
    await worker.start({ quiet: true, onUnhandledRequest: "bypass" })
    onTestFinished(() => {
      worker.stop()
    })
    const client = renderApiRoute(<Session />)
    await page.mark("Use the page while the first status request is pending", async () => {
      await expect.poll(() => requests).toBe(1)
      await expect.element(page.getByRole("button", { name: "Create game" })).toBeEnabled()
      await expect.element(page.getByRole("dialog")).not.toBeInTheDocument()
      response.resolve(undefined)
    })
    await page.mark("Wait for the retry budget to be exhausted", async () => {
      await expect.poll(() => requests, { timeout: 12000 }).toBe(4)
      await expect.poll(() => client.isFetching()).toBe(0)
      await expect.element(page.getByRole("dialog")).not.toBeInTheDocument()
    })
    await page.mark("Return focus, leave the page and mount onboarding again", async () => {
      window.dispatchEvent(new Event("visibilitychange"))
      await page.getByRole("button", { name: "Leave page" }).click()
      await expect.element(page.getByRole("button", { name: "Create game" })).not.toBeInTheDocument()
      await page.getByRole("button", { name: "Return to page" }).click()
      await expect.element(page.getByRole("button", { name: "Create game" })).toBeVisible()
      expect(client.isFetching()).toBe(0)
      expect(requests).toBe(4)
    })
    await page.mark("Complete a different mutation without refetching onboarding", async () => {
      await page.getByRole("button", { name: "Create game" }).click()
      await expect.element(page.getByText("Created game 42")).toBeVisible()
      expect(client.isFetching()).toBe(0)
      expect(requests).toBe(4)
    })
  }, 30000)
})
