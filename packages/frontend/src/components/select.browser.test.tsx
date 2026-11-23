import { composeStories } from "@storybook/react-vite"
import type { ReactElement } from "react"
import { describe, expect, it } from "vitest"
import { page, userEvent } from "vitest/browser"
import * as stories from "./select.stories.tsx"

const { Interactive, InitialSelection, Disabled } = composeStories(stories, {
  decorators: [
    (Story): ReactElement => (
      <div>
        <button type="button">Previous control</button>
        <Story />
      </div>
    ),
  ],
})

describe("Select", () => {
  it("should select a fleet by keyboard and change it by pointer", async () => {
    await Interactive.run()
    await page.getByRole("button", { name: "Previous control" }).click()
    const trigger = page.getByRole("combobox", { name: "Fleet" })
    const list = page.getByRole("listbox")

    await page.mark("Choose Home Guard with the keyboard", async () => {
      await expect.element(trigger.getByText("Choose a fleet", { exact: true })).toBeVisible()
      await userEvent.tab()
      await userEvent.keyboard("{Enter}")
      await expect.element(list).toBeVisible()
      await userEvent.keyboard("{Home}{ArrowDown}{Enter}")
      await expect.element(trigger.getByText("Home Guard", { exact: true })).toBeVisible()
      await expect.element(list).not.toBeInTheDocument()
    })

    await page.mark("Change the selection to Reserve Fleet", async () => {
      await trigger.click()
      await page.getByRole("option", { name: "Reserve Fleet" }).click()
      await expect.element(trigger.getByText("Reserve Fleet", { exact: true })).toBeVisible()
      await expect.element(list).not.toBeInTheDocument()
    })
  })

  it("should retain the initial selection and restore trigger focus on Escape", async () => {
    await InitialSelection.run()
    await page.getByRole("button", { name: "Previous control" }).click()
    const trigger = page.getByRole("combobox", { name: "Fleet" })

    await page.mark("Open the preselected fleet and highlight another option", async () => {
      await userEvent.tab()
      await userEvent.keyboard("{Enter}")
      await expect.element(page.getByRole("option", { name: "Home Guard" })).toHaveAttribute("aria-selected", "true")
      await userEvent.keyboard("{ArrowDown}")
    })

    await page.mark("Cancel the new choice", async () => {
      await userEvent.keyboard("{Escape}")
      await expect.element(page.getByRole("listbox")).not.toBeInTheDocument()
      await expect.element(trigger).toHaveFocus()
      await expect.element(trigger.getByText("Home Guard", { exact: true })).toBeVisible()
    })
  })

  it("should keep the menu closed when the disabled trigger is clicked", async () => {
    await Disabled.run()
    const trigger = page.getByRole("combobox", { name: "Fleet" })
    await page.mark("Try to open the disabled menu", async () => {
      await expect.element(trigger).toBeDisabled()
      await trigger.click({ force: true })
      await expect.element(page.getByRole("listbox")).not.toBeInTheDocument()
    })
  })
})
