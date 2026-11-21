import { composeStories } from "@storybook/react-vite"
import type { ReactElement } from "react"
import { describe, expect, it } from "vitest"
import { page, userEvent } from "vitest/browser"
import * as stories from "./RangeSlider.stories.tsx"

const { Interactive, Disabled } = composeStories(stories, {
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

describe("RangeSlider", () => {
  it("should adjust each thumb independently and stop at the range limits", async () => {
    await Interactive.run()
    const minimum = page.getByRole("slider", { name: "Minimum" })
    const maximum = page.getByRole("slider", { name: "Maximum" })
    await page.mark("Adjust the minimum", async () => {
      await page.getByRole("button", { name: "Before control" }).click()
      await userEvent.tab()
      await expect.element(minimum).toHaveFocus()
      await expect.element(minimum).toHaveAttribute("aria-valuenow", "25")
      await userEvent.keyboard("{ArrowRight}")
      await expect.element(page.getByText("26", { exact: true })).toBeVisible()
      await userEvent.keyboard("{ArrowLeft>30/}")
      await expect.element(minimum).toHaveAttribute("aria-valuenow", "0")
      await expect.element(page.getByText("0", { exact: true })).toBeVisible()
    })
    await page.mark("Adjust the maximum", async () => {
      await userEvent.tab()
      await expect.element(maximum).toHaveFocus()
      await expect.element(maximum).toHaveAttribute("aria-valuenow", "75")
      await userEvent.keyboard("{ArrowLeft}")
      await expect.element(page.getByText("74", { exact: true })).toBeVisible()
      await userEvent.keyboard("{ArrowRight>30/}")
      await expect.element(maximum).toHaveAttribute("aria-valuenow", "100")
      await expect.element(page.getByText("100", { exact: true })).toBeVisible()
    })
  })

  it("should skip both disabled thumbs in the tab order", async () => {
    await Disabled.run()
    await page.mark("Tab past the disabled slider", async () => {
      await page.getByRole("button", { name: "Before control" }).click()
      await userEvent.tab()
      await expect.element(page.getByRole("button", { name: "After control" })).toHaveFocus()
      await expect.element(page.getByRole("slider", { name: "Minimum" })).toBeDisabled()
      await expect.element(page.getByRole("slider", { name: "Maximum" })).toBeDisabled()
    })
  })
})
