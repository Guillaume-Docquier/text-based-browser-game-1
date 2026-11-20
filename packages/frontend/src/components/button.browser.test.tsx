import { composeStories } from "@storybook/react-vite"
import type { ReactElement } from "react"
import { describe, expect, it } from "vitest"
import { page, userEvent } from "vitest/browser"
import * as stories from "./button.stories.tsx"

const { Interactive, Disabled, RenderLink } = composeStories(stories, {
  decorators: [
    (Story): ReactElement => (
      <>
        <button type="button">Before control</button>
        <Story />
        <button type="button">After control</button>
      </>
    ),
  ],
})

describe("button", () => {
  it("should accept keyboard focus as a button or link", async () => {
    await page.mark("Tab to the enabled button", async () => {
      await Interactive.run()
      await page.getByRole("button", { name: "Before control" }).click()
      await userEvent.tab()
      await expect.element(page.getByRole("button", { name: "Launch fleet" })).toHaveFocus()
    })
    await page.mark("Tab to the rendered link", async () => {
      await RenderLink.run()
      await page.getByRole("button", { name: "Before control" }).click()
      await userEvent.tab()
      const link = page.getByRole("link", { name: "Fleet details" })
      await expect.element(link).toHaveFocus()
      await expect.element(link).toHaveAttribute("href", "#fleet-details")
    })
  })

  it("should disable the button when requested", async () => {
    await Disabled.run()
    await expect.element(page.getByRole("button", { name: "Launch fleet" })).toBeDisabled()
  })
})
