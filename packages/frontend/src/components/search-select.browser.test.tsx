import { composeStories } from "@storybook/react-vite"
import type { ReactElement } from "react"
import { describe, expect, it } from "vitest"
import { page, userEvent } from "vitest/browser"
import * as stories from "./search-select.stories.tsx"

const { Interactive, LargeList } = composeStories(stories, {
  decorators: [
    (Story): ReactElement => (
      <div>
        <Story />
        <button type="button">Next control</button>
      </div>
    ),
  ],
})

describe("SearchSelect", () => {
  it("should filter case-insensitively and commit a keyboard selection", async () => {
    await Interactive.run()
    const input = page.getByRole("combobox", { name: "Fleet target" })
    const expeditionary = page.getByRole("option", { name: "Expeditionary Fleet" })
    const reserve = page.getByRole("option", { name: "Reserve Fleet" })

    await page.mark("Search for a fleet that does not exist", async () => {
      await input.click()
      await input.fill("unknown")
      await expect.element(page.getByRole("status")).toHaveTextContent("No matching options")
    })

    await page.mark("Filter to the two fleet matches", async () => {
      await input.fill("fLeEt")
      await expect.element(expeditionary).toBeVisible()
      await expect.element(reserve).toBeVisible()
      await expect.element(page.getByRole("option", { name: "Home Guard" })).not.toBeInTheDocument()
      await expect.element(input).toHaveAttribute("aria-activedescendant", expeditionary.element().id)
    })

    await page.mark("Move to Reserve Fleet and commit the selection", async () => {
      await userEvent.keyboard("{ArrowDown}")
      await expect.element(input).toHaveAttribute("aria-activedescendant", reserve.element().id)
      await userEvent.keyboard("{Enter}")
      await expect.element(input).toHaveValue("Reserve Fleet")
      await expect.element(page.getByRole("listbox")).not.toBeInTheDocument()
    })
  })

  it("should restore the selected fleet when search is dismissed with Escape or Tab", async () => {
    await Interactive.run()
    const input = page.getByRole("combobox", { name: "Fleet target" })
    const menu = page.getByRole("listbox")

    await page.mark("Select Expeditionary Fleet by pointer", async () => {
      await input.click()
      await page.getByRole("option", { name: "Expeditionary Fleet" }).click()
      await expect.element(input).toHaveValue("Expeditionary Fleet")
      await expect.element(menu).not.toBeInTheDocument()
    })

    await page.mark("Search for Reserve Fleet and cancel with Escape", async () => {
      await input.click()
      await input.fill("reserve")
      await expect.element(page.getByRole("option", { name: "Reserve Fleet" })).toBeVisible()
      await userEvent.keyboard("{Escape}")
      await expect.element(menu).not.toBeInTheDocument()
      await expect.element(input).toHaveValue("Expeditionary Fleet")
    })

    await page.mark("Search again and Tab to the next control", async () => {
      await input.click()
      await input.fill("reserve")
      await expect.element(page.getByRole("option", { name: "Reserve Fleet" })).toBeVisible()
      await userEvent.tab()
      await expect.element(menu).not.toBeInTheDocument()
      await expect.element(page.getByRole("button", { name: "Next control" })).toHaveFocus()
      await expect.element(input).toHaveValue("Expeditionary Fleet")
    })
  })

  it("should limit the menu to the first 50 options and still find a later option", async () => {
    await LargeList.run()
    const input = page.getByRole("combobox", { name: "Planet target" })
    const options = page.getByRole("option")

    await page.mark("Inspect the limited menu", async () => {
      await expect.poll(() => options.all()).toHaveLength(50)
      await expect.element(options.first()).toHaveTextContent("Planet 0001")
      await expect.element(options.last()).toHaveTextContent("Planet 0050")
      await expect.element(page.getByText("Showing first 50 of 3000. Keep typing to narrow the list.")).toBeVisible()
    })

    await page.mark("Find and choose a planet outside the first 50", async () => {
      await input.fill("planet 2999")
      await expect.poll(() => options.all()).toHaveLength(1)
      await page.getByRole("option", { name: "Planet 2999" }).click()
      await expect.element(input).toHaveValue("Planet 2999")
    })
  })
})
