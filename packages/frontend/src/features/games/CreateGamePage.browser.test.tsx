import { describe, expect, it } from "vitest"
import { page } from "vitest/browser"
import { renderApplicationPage } from "@/testing/renderApplicationPage.tsx"
import { CreateGamePage } from "./CreateGamePage.tsx"

describe("CreateGamePage", () => {
  it("should enable game creation when a player corrects the seat limit from 17 to 16", async () => {
    await renderApplicationPage(<CreateGamePage mapGenerationSeed={undefined} />)
    const seats = page.getByRole("spinbutton", { name: "Max number of players" })
    const create = page.getByRole("button", { name: "Create", exact: true })

    await page.mark("Enter a game name and exceed the seat limit", async () => {
      await page.getByRole("textbox", { name: "Game name" }).fill("Orion")
      await seats.fill("17")
      await expect.element(create).toBeDisabled()
    })
    await page.mark("Correct the seat count to the maximum", async () => {
      await seats.fill("16")
      await expect.element(create).toBeEnabled()
    })
  })
})
