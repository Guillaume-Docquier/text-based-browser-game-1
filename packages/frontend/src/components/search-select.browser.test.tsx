import { composeStories } from "@storybook/react-vite"
import type { ReactElement } from "react"
import { describe, expect, it } from "vitest"
import { page, userEvent } from "vitest/browser"
import * as stories from "./search-select.stories.tsx"

const { Interactive, LargeList, Disabled } = composeStories(stories, {
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

describe("search-select", () => {
  it("should filter without case sensitivity and choose matches by pointer or keyboard", async () => {
    await Interactive.run()
    const fleet = page.getByRole("combobox", { name: "Fleet target" })
    await page.mark("Narrow the list and choose a fleet", async () => {
      await expect.element(fleet).toHaveValue("")
      await fleet.click()
      await expect.element(page.getByRole("option", { name: "Home Guard" })).toBeVisible()
      await fleet.fill("eXpEdItIoNaRy")
      await expect.element(page.getByRole("option", { name: "Home Guard" })).not.toBeInTheDocument()
      await page.getByRole("option", { name: "Expeditionary Fleet" }).click()
      await expect.element(fleet).toHaveValue("Expeditionary Fleet")
      await expect.element(page.getByRole("listbox")).not.toBeInTheDocument()
    })
    await page.mark("Recover from an empty result and navigate the list boundaries", async () => {
      await fleet.click()
      await fleet.fill("unknown")
      await expect.element(page.getByRole("status")).toHaveTextContent("No matching options")
      await fleet.fill("")
      await userEvent.keyboard("{ArrowUp}{Enter}")
      await expect.element(fleet).toHaveValue("Home Guard")
      await fleet.click()
      await userEvent.keyboard("{ArrowDown}{ArrowDown}{ArrowDown}{Enter}")
      await expect.element(fleet).toHaveValue("Reserve Fleet")
    })
  })

  it.each([
    { key: "Escape", focus: page.getByRole("combobox", { name: "Fleet target" }) },
    { key: "Tab", focus: page.getByRole("button", { name: "After control" }) },
  ])("should discard the search and preserve selection on $key", async ({ key, focus }) => {
    await Interactive.run()
    const fleet = page.getByRole("combobox", { name: "Fleet target" })
    await page.mark("Select a fleet and search for a different one", async () => {
      await fleet.click()
      await page.getByRole("option", { name: "Expeditionary Fleet" }).click()
      await expect.element(fleet).toHaveValue("Expeditionary Fleet")
      await fleet.click()
      await fleet.fill("reserve")
      await expect.element(page.getByRole("option", { name: "Reserve Fleet" })).toBeVisible()
    })
    await page.mark("Leave without choosing the match", async () => {
      await userEvent.keyboard(`{${key}}`)
      await expect.element(page.getByRole("listbox")).not.toBeInTheDocument()
      await expect.element(fleet).toHaveValue("Expeditionary Fleet")
      await expect.element(focus).toHaveFocus()
    })
  })

  it("should limit visible results and search all 3000 planets", async () => {
    await LargeList.run()
    const planet = page.getByRole("combobox", { name: "Planet target" })
    await page.mark("Open the first fifty results", async () => {
      await planet.click()
      await expect.poll(() => page.getByRole("option").length).toBe(50)
      await expect.element(page.getByRole("option").first()).toHaveTextContent("Planet 0001")
      await expect.element(page.getByRole("option").last()).toHaveTextContent("Planet 0050")
      await expect.element(page.getByText("Showing first 50 of 3000. Keep typing to narrow the list.")).toBeVisible()
    })
    await page.mark("Choose a planet outside the initial list", async () => {
      await planet.fill("planet 2999")
      await expect.poll(() => page.getByRole("option").length).toBe(1)
      await page.getByRole("option", { name: "Planet 2999" }).click()
      await expect.element(planet).toHaveValue("Planet 2999")
      await expect.element(page.getByRole("listbox")).not.toBeInTheDocument()
    })
  })

  it("should disable the fleet search", async () => {
    await Disabled.run()
    await expect.element(page.getByRole("combobox", { name: "Fleet target" })).toBeDisabled()
  })
})
