import { composeStories } from "@storybook/react-vite"
import type { ReactElement } from "react"
import { describe, expect, it } from "vitest"
import { page, userEvent } from "vitest/browser"
import * as stories from "./RangeSlider.stories.tsx"

const { Disabled, Interactive } = composeStories(stories, {
  decorators: [
    (Story): ReactElement => (
      <div>
        <button type="button">Previous control</button>
        <Story />
      </div>
    ),
  ],
})

describe("RangeSlider", () => {
  it("should change each endpoint independently and stops at the range limits", async () => {
    await Interactive.run()
    const minimum = page.getByRole("slider", { name: "Minimum" })
    const maximum = page.getByRole("slider", { name: "Maximum" })

    await page.mark("Raise the minimum one step", async () => {
      await page.getByRole("button", { name: "Previous control" }).click()
      await userEvent.tab()
      await expect.element(minimum).toHaveFocus()
      await userEvent.keyboard("{ArrowRight}")
      await expect.element(minimum).toHaveAttribute("aria-valuenow", "26")
      await expect.element(maximum).toHaveAttribute("aria-valuenow", "75")
    })

    await page.mark("Lower the maximum one step", async () => {
      await userEvent.tab()
      await expect.element(maximum).toHaveFocus()
      await userEvent.keyboard("{ArrowLeft}")
      await expect.element(minimum).toHaveAttribute("aria-valuenow", "26")
      await expect.element(maximum).toHaveAttribute("aria-valuenow", "74")
    })

    await page.mark("Try to move beyond both limits", async () => {
      await userEvent.tab({ shift: true })
      await expect.element(minimum).toHaveFocus()
      await userEvent.keyboard("{Home}{ArrowLeft}")
      await expect.element(minimum).toHaveAttribute("aria-valuenow", "0")

      await userEvent.tab()
      await expect.element(maximum).toHaveFocus()
      await userEvent.keyboard("{End}{ArrowRight}")
      await expect.element(maximum).toHaveAttribute("aria-valuenow", "100")
    })
  })

  it("should disable both thumbs when the range is disabled", async () => {
    await Disabled.run()

    await page.mark("Inspect the two disabled endpoints", async () => {
      await expect.element(page.getByRole("slider", { name: "Minimum" })).toBeDisabled()
      await expect.element(page.getByRole("slider", { name: "Maximum" })).toBeDisabled()
    })
  })
})
