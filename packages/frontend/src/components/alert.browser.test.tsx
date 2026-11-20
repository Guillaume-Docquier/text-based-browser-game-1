import { composeStories } from "@storybook/react-vite"
import { describe, expect, it } from "vitest"
import { page } from "vitest/browser"
import * as stories from "./alert.stories.tsx"

const { Destructive } = composeStories(stories)

describe("alert", () => {
  it("should expose the error message and its action inside the alert", async () => {
    await Destructive.run()
    const alert = page.getByRole("alert")
    await expect.element(alert.getByText("Insufficient resources")).toBeVisible()
    await expect.element(alert.getByText("This action costs more minerals than the colony has available.")).toBeVisible()
    await expect.element(alert.getByRole("button", { name: "Dismiss" })).toBeEnabled()
  })
})
