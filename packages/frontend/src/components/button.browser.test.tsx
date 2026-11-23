import { composeStories } from "@storybook/react-vite"
import type { ReactElement } from "react"
import { describe, expect, it } from "vitest"
import { page, userEvent } from "vitest/browser"
import * as stories from "./button.stories.tsx"

const { RenderLink } = composeStories(stories, {
  decorators: [
    (Story): ReactElement => (
      <div>
        <button type="button">Previous control</button>
        <Story />
      </div>
    ),
  ],
})

describe("Button rendered as a link", () => {
  it("should expose the destination and receive keyboard focus", async () => {
    await RenderLink.run()
    await page.getByRole("button", { name: "Previous control" }).click()

    await page.mark("Tab to fleet details", async () => {
      await userEvent.tab()
      const link = page.getByRole("link", { name: "Fleet details" })
      await expect.element(link).toHaveFocus()
      await expect.element(link).toHaveAttribute("href", "#fleet-details")
    })
  })
})
