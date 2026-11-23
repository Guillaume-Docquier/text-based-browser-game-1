import { composeStories } from "@storybook/react-vite"
import type { ReactElement } from "react"
import { describe, expect, it } from "vitest"
import { page, userEvent } from "vitest/browser"
import * as stories from "./search-select.stories.tsx"

const { Interactive, LargeList, Disabled } = composeStories(stories, {
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

describe("SearchSelect", () => {
  const fleet = page.getByRole("combobox", { name: "Fleet target" })
  const list = page.getByRole("listbox")

  it("should recover from no matches and select a case-insensitive match", async () => {
    await Interactive.run()

    await page.mark("Search for an unknown fleet", async () => {
      await fleet.click()
      await fleet.fill("unknown")
      await expect.element(page.getByRole("status")).toHaveTextContent("No matching options")
    })

    await page.mark("Select the only matching fleet", async () => {
      await fleet.fill("eXpEdItIoNaRy")
      await expect.element(page.getByRole("option", { name: "Home Guard" })).not.toBeInTheDocument()
      await page.getByRole("option", { name: "Expeditionary Fleet" }).click()
      await expect.element(fleet).toHaveValue("Expeditionary Fleet")
      await expect.element(list).not.toBeInTheDocument()
    })
  })

  it("should stop keyboard navigation at the first and last fleets", async () => {
    await Interactive.run()
    await page.getByRole("button", { name: "Previous control" }).click()

    await page.mark("Commit the first option with the keyboard", async () => {
      await userEvent.tab()
      await expect.element(list).toBeVisible()
      await userEvent.keyboard("{ArrowUp}{Enter}")
      await expect.element(fleet).toHaveValue("Home Guard")
      await expect.element(list).not.toBeInTheDocument()
    })

    await page.mark("Reopen and advance to the last option", async () => {
      await fleet.click()
      await userEvent.keyboard("{ArrowDown}{ArrowDown}{ArrowDown}{Enter}")
      await expect.element(fleet).toHaveValue("Reserve Fleet")
      await expect.element(list).not.toBeInTheDocument()
    })
  })

  it.each(["Escape", "Tab"] as const)("should preserve the selected fleet on %s", async (key) => {
    await Interactive.run()
    await page.mark("Choose a fleet and search for a replacement", async () => {
      await fleet.click()
      await page.getByRole("option", { name: "Expeditionary Fleet" }).click()
      await expect.element(fleet).toHaveValue("Expeditionary Fleet")
      await fleet.click()
      await fleet.fill("reserve")
      await expect.element(page.getByRole("option", { name: "Reserve Fleet" })).toBeVisible()
    })

    await page.mark("Leave the search without committing the replacement", async () => {
      await userEvent.keyboard(`{${key}}`)
      await expect.element(list).not.toBeInTheDocument()
      await expect.element(fleet).toHaveValue("Expeditionary Fleet")
      const focusAfterDismissal = { Escape: fleet, Tab: page.getByRole("button", { name: "Next control" }) }
      await expect.element(focusAfterDismissal[key]).toHaveFocus()
    })
  })

  it("should cap the open list and search all 3000 planets", async () => {
    await LargeList.run()
    const planet = page.getByRole("combobox", { name: "Planet target" })
    const options = page.getByRole("option")

    await page.mark("Inspect the first fifty planets", async () => {
      await expect.poll(() => options.elements().length).toBe(50)
      await expect.element(options.first()).toHaveTextContent("Planet 0001")
      await expect.element(options.last()).toHaveTextContent("Planet 0050")
      await expect.element(page.getByText("Showing first 50 of 3000. Keep typing to narrow the list.")).toBeVisible()
    })

    await page.mark("Choose a planet outside the initial fifty", async () => {
      await planet.fill("planet 2999")
      await expect.poll(() => options.elements().length).toBe(1)
      await page.getByRole("option", { name: "Planet 2999" }).click()
      await expect.element(planet).toHaveValue("Planet 2999")
      await expect.element(list).not.toBeInTheDocument()
    })
  })

  it("should keep the disabled search closed", async () => {
    await Disabled.run()
    await page.mark("Try to open the disabled fleet list", async () => {
      await expect.element(fleet).toBeDisabled()
      await fleet.click({ force: true })
      await expect.element(list).not.toBeInTheDocument()
      await expect.element(fleet).toHaveValue("")
    })
  })
})
