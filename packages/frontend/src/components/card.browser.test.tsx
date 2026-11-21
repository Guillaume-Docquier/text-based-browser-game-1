import { composeStories } from "@storybook/react-vite"
import { describe, expect, it } from "vitest"
import { page } from "vitest/browser"
import * as stories from "./card.stories.tsx"

const { Interactive } = composeStories(stories)

describe("card", () => {
  it("should present the colony title, description, badge, content and footer action", async () => {
    await Interactive.run()
    for (const text of ["Kepler-186", "Terran colony · Population 2.4B", "Stable", "Mineral production is operating at 84% capacity."]) {
      await expect.element(page.getByText(text, { exact: true })).toBeVisible()
    }
    await expect.element(page.getByRole("button", { name: "Open colony" })).toBeEnabled()
  })
})
