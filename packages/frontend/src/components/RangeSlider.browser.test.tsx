import { composeStories } from "@storybook/react-vite"
import type { ReactElement } from "react"
import { describe, expect, it } from "vitest"
import { page, userEvent } from "vitest/browser"
import * as stories from "./RangeSlider.stories.tsx"

const { Interactive, Disabled } = composeStories(stories, {
  decorators: [
    (Story): ReactElement => (
      <div>
        <button type="button">Previous control</button>
        <Story />
        <button type="button">Next control</button>
      </div>
    ),
  ],
})

describe("RangeSlider", () => {
  it("should step each thumb independently and stop at its bound", async () => {
    await Interactive.run({ args: { ...Interactive.args, value: [1, 99] } })
    await page.getByRole("button", { name: "Previous control" }).click()
    const minimum = page.getByRole("slider", { name: "Minimum" })
    const maximum = page.getByRole("slider", { name: "Maximum" })

    await page.mark("Lower the minimum to zero and try one more step", async () => {
      await userEvent.tab()
      await expect.element(minimum).toHaveFocus()
      await userEvent.keyboard("{ArrowRight}")
      await expect.element(minimum).toHaveAttribute("aria-valuenow", "2")
      await userEvent.keyboard("{ArrowLeft}{ArrowLeft}{ArrowLeft}")
      await expect.element(minimum).toHaveAttribute("aria-valuenow", "0")
      await expect.element(page.getByText("0", { exact: true })).toBeVisible()
      await expect.element(maximum).toHaveAttribute("aria-valuenow", "99")
    })

    await page.mark("Raise the maximum to one hundred and try one more step", async () => {
      await userEvent.tab()
      await expect.element(maximum).toHaveFocus()
      await userEvent.keyboard("{ArrowLeft}")
      await expect.element(maximum).toHaveAttribute("aria-valuenow", "98")
      await userEvent.keyboard("{ArrowRight}{ArrowRight}{ArrowRight}")
      await expect.element(maximum).toHaveAttribute("aria-valuenow", "100")
      await expect.element(page.getByText("100", { exact: true })).toBeVisible()
      await expect.element(minimum).toHaveAttribute("aria-valuenow", "0")
    })
  })

  it("should skip both disabled thumbs in the tab order", async () => {
    await Disabled.run()
    await page.getByRole("button", { name: "Previous control" }).click()

    await page.mark("Tab past the disabled range", async () => {
      await expect.element(page.getByRole("slider", { name: "Minimum" })).toBeDisabled()
      await expect.element(page.getByRole("slider", { name: "Maximum" })).toBeDisabled()
      await userEvent.tab()
      await expect.element(page.getByRole("button", { name: "Next control" })).toHaveFocus()
    })
  })
})
