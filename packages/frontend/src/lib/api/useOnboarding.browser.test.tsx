import { focusManager, QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { createRoot } from "react-dom/client"
import { afterAll, describe, expect, it, onTestFinished } from "vitest"
import { page } from "vitest/browser"
import { createOnboardingOutageApiMock } from "./BackendApiClient.mock.ts"
import { BackendApiClientProvider } from "./BackendApiClientContext.tsx"
import { useGameListingsQuery } from "./useGameListingsQuery.ts"
import { useOnboarding } from "./useOnboarding.ts"

function OnboardingAndListings(): null {
  useOnboarding({ enabled: true })
  useGameListingsQuery()
  return null
}

describe("useOnboarding", () => {
  afterAll(() => {
    focusManager.setFocused(undefined)
  })

  it("should refresh listings on focus without restarting exhausted onboarding retries", async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const { backendApiClient, requests } = createOnboardingOutageApiMock(queryClient)
    const onboardingKey = backendApiClient.accounts.isOnboarded.queryKey()
    const listingsKey = backendApiClient.games.getListings.queryKey()
    const container = document.createElement("div")
    const root = createRoot(container)
    onTestFinished(() => {
      root.unmount()
      queryClient.clear()
    })

    focusManager.setFocused(true)
    root.render(
      <QueryClientProvider client={queryClient}>
        <BackendApiClientProvider backendApiClient={backendApiClient}>
          <OnboardingAndListings />
        </BackendApiClientProvider>
      </QueryClientProvider>,
    )

    await page.mark("Load listings and wait for onboarding retries to end", async () => {
      await expect.poll(() => queryClient.getQueryState(listingsKey)).toMatchObject({ status: "success", fetchStatus: "idle" })
      await expect
        .poll(() => queryClient.getQueryState(onboardingKey), { timeout: 12_000 })
        .toMatchObject({
          status: "error",
          fetchStatus: "idle",
        })
      expect(requests.listings).toBe(1)
      expect(requests.onboarding).toBe(4)
    })

    await page.mark("Restore query focus and observe which data refreshes", async () => {
      focusManager.setFocused(false)
      focusManager.setFocused(true)

      await expect.poll(() => requests.listings).toBe(2)
      expect(requests.onboarding).toBe(4)
      expect(queryClient.getQueryState(onboardingKey)).toMatchObject({ status: "error", fetchStatus: "idle" })
    })
  })
})
