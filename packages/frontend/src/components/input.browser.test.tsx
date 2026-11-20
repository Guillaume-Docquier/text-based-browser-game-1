import { composeStories } from "@storybook/react-vite"
import { describe, expect, it } from "vitest"
import { page, userEvent } from "vitest/browser"
import * as stories from "./input.stories.tsx"

const { WithLabel, Invalid, Disabled } = composeStories(stories)

describe("input", () => {
  it("should associate the text field with its label and accept edits", async () => {
    await WithLabel.run()
    await page.mark("Focus and edit the labeled field", async () => {
      await page.getByText("Colony name", { exact: true }).click()
      const input = page.getByRole("textbox", { name: "Colony name" })
      await expect.element(input).toHaveFocus()
      await userEvent.keyboard("Kepler-186")
      await expect.element(input).toHaveValue("Kepler-186")
    })
  })

  it("should expose the invalid value and disabled state", async () => {
    await page.mark("Read the invalid value", async () => {
      await Invalid.run()
      const input = page.getByRole("textbox")
      await expect.element(input).toHaveValue("Already claimed")
      await expect.element(input).toHaveAttribute("aria-invalid", "true")
    })
    await page.mark("Inspect the disabled field", async () => {
      await Disabled.run()
      await expect.element(page.getByRole("textbox")).toBeDisabled()
    })
  })
})
