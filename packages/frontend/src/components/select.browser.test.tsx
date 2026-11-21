import { composeStories } from "@storybook/react-vite"
import type { ReactElement } from "react"
import { describe, expect, it } from "vitest"
import { page, userEvent } from "vitest/browser"
import * as stories from "./select.stories.tsx"

const { Interactive, InitialSelection, Disabled } = composeStories(stories, {
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

describe("select", () => {
  it("should choose a fleet with the keyboard and change it with the pointer", async () => {
    await Interactive.run()
    const fleet = page.getByRole("combobox", { name: "Fleet" })
    await page.mark("Choose Home Guard with the arrow keys", async () => {
      await expect.element(fleet.getByText("Choose a fleet", { exact: true })).toBeVisible()
      await fleet.click()
      await expect.element(page.getByRole("option", { name: "Expeditionary Fleet" })).toBeVisible()
      await userEvent.keyboard("{Home}{ArrowDown}{Enter}")
      await expect.element(fleet.getByText("Home Guard", { exact: true })).toBeVisible()
      await expect.element(page.getByRole("listbox")).not.toBeInTheDocument()
    })
    await page.mark("Change to Reserve Fleet", async () => {
      await fleet.click()
      await page.getByRole("option", { name: "Reserve Fleet" }).click()
      await expect.element(fleet.getByText("Reserve Fleet", { exact: true })).toBeVisible()
    })
  })

  it("should restore focus and keep the initial selection on Escape", async () => {
    await InitialSelection.run()
    const fleet = page.getByRole("combobox", { name: "Fleet" })
    await page.mark("Open the initial selection with Enter", async () => {
      await page.getByRole("button", { name: "Before control" }).click()
      await userEvent.tab()
      await userEvent.keyboard("{Enter}")
      await expect.element(page.getByRole("option", { name: "Home Guard" })).toHaveAttribute("aria-selected", "true")
    })
    await page.mark("Dismiss the list", async () => {
      await userEvent.keyboard("{Escape}")
      await expect.element(page.getByRole("listbox")).not.toBeInTheDocument()
      await expect.element(fleet).toHaveFocus()
      await expect.element(fleet.getByText("Home Guard", { exact: true })).toBeVisible()
    })
  })

  it("should disable the trigger", async () => {
    await Disabled.run()
    await expect.element(page.getByRole("combobox")).toBeDisabled()
  })
})
