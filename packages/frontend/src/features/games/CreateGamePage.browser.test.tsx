import { QueryClient } from "@tanstack/react-query"
import { describe, expect, it } from "vitest"
import { page } from "vitest/browser"
import { ApiTestProvider } from "@/lib/api/ApiTestProvider.test-support.tsx"
import { renderRoute } from "@/lib/renderRoute.test-support.tsx"
import { CreateGamePage } from "./CreateGamePage.tsx"

describe("CreateGamePage", () => {
  it("should allow sixteen seats and reject seventeen", async () => {
    const queryClient = new QueryClient()
    renderRoute(() => (
      <ApiTestProvider queryClient={queryClient}>
        <CreateGamePage mapGenerationSeed={undefined} />
      </ApiTestProvider>
    ))
    const seats = page.getByRole("spinbutton", { name: "Max number of players" })
    const create = page.getByRole("button", { name: "Create" })
    await page.mark("Exceed the seat limit", async () => {
      await page.getByRole("textbox", { name: "Game name" }).fill("Test lobby")
      await seats.fill("17")
      await expect.element(create).toBeDisabled()
    })
    await page.mark("Return to the maximum allowed size", async () => {
      await seats.fill("16")
      await expect.element(create).toBeEnabled()
    })
  })
})
