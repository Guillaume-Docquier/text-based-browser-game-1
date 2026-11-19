import { composeStories } from "@storybook/react-vite"
import { describe, expect, it } from "vitest"
import { page, userEvent } from "vitest/browser"
import * as stories from "./select.stories.tsx"

const { Interactive } = composeStories(stories)

describe("Select", () => {
  it("should commit a keyboard selection and preserve it when the menu is dismissed", async () => {
    await Interactive.run()
    const trigger = page.getByRole("combobox", { name: "Fleet" })
    const menu = page.getByRole("listbox")

    await page.mark("Choose Home Guard from the keyboard", async () => {
      await trigger.click()
      await expect.element(menu).toBeVisible()
      await userEvent.keyboard("{ArrowDown}{ArrowDown}{Enter}")
      await expect.element(trigger.getByText("Home Guard", { exact: true })).toBeVisible()
      await expect.element(menu).not.toBeInTheDocument()
    })

    await page.mark("Reopen the selection, move to another option, and press Escape", async () => {
      await expect.element(trigger).toHaveFocus()
      await userEvent.keyboard("{Enter}")
      await expect.element(page.getByRole("option", { name: "Home Guard" })).toHaveAttribute("aria-selected", "true")
      await userEvent.keyboard("{ArrowDown}{Escape}")
      await expect.element(menu).not.toBeInTheDocument()
      await expect.element(trigger).toHaveFocus()
      await expect.element(trigger.getByText("Home Guard", { exact: true })).toBeVisible()
    })
  })
})
