import { composeStories } from "@storybook/react-vite"
import { describe, expect, it } from "vitest"
import { page } from "vitest/browser"
import * as stories from "./label.stories.tsx"

const { Interactive } = composeStories(stories)

describe("Label", () => {
  it("should focus its associated input when clicked", async () => {
    await Interactive.run()
    const input = page.getByRole("textbox", { name: "Fleet name" })

    await page.mark("Click the fleet name label", async () => {
      await expect.element(input).not.toHaveFocus()
      await page.getByText("Fleet name", { exact: true }).click()
      await expect.element(input).toHaveFocus()
    })
  })
})
