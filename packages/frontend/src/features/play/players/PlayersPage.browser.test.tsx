import { describe, expect, it, vi } from "vitest"
import { page } from "vitest/browser"
import { renderApplicationPage } from "@/testing/renderApplicationPage.tsx"
import { createPlayGameContextStub } from "../PlayContext.stub.ts"
import { PlayGameContextProvider } from "../PlayContext.tsx"
import { PlayersPage } from "./PlayersPage.tsx"

describe("PlayersPage", () => {
  it("should disable readiness at the deadline even if the last turn state is still collecting actions", async ({ onTestFinished }) => {
    const data = createPlayGameContextStub()
    vi.useFakeTimers({ now: new Date("2026-01-01T00:00:00Z"), toFake: ["Date", "setTimeout", "clearTimeout"], shouldAdvanceTime: true })
    onTestFinished(() => {
      vi.useRealTimers()
    })
    await renderApplicationPage(
      <PlayGameContextProvider {...data} hasLiveSnapshot={true}>
        <PlayersPage />
      </PlayGameContextProvider>,
    )
    const ready = page.getByRole("button", { name: "Ready", exact: true })
    await expect.element(ready).toBeEnabled()
    await vi.advanceTimersByTimeAsync(Date.parse(data.turnState.turnEndsAt) - Date.now())
    await expect.element(ready).toBeDisabled()
  })
})
