import { composeStories } from "@storybook/react-vite"
import { describe, expect, it } from "vitest"
import { page, userEvent } from "vitest/browser"
import * as stories from "./OnboardingDialog.stories.tsx"

const { Interactive, InvalidAlias, Pending } = composeStories(stories)

describe("OnboardingDialog", () => {
  it("should require an alias and keep keyboard focus inside the dialog until submission", async () => {
    await Interactive.run()
    const dialog = page.getByRole("dialog", { name: "Welcome, commander" })
    const alias = dialog.getByRole("textbox", { name: "Choose your alias" })
    const submit = dialog.getByRole("button", { name: "Continue" })
    await page.mark("Dismiss with Escape while an alias is required", async () => {
      await expect.element(alias).toHaveFocus()
      await expect.element(submit).toBeDisabled()
      await userEvent.keyboard("{Escape}")
      await expect.element(dialog).toBeVisible()
      await expect.element(alias).toHaveFocus()
    })
    await page.mark("Cycle focus and submit the entered alias", async () => {
      await alias.fill("Commander")
      await userEvent.tab()
      await expect.element(submit).toHaveFocus()
      await userEvent.tab()
      await expect.element(alias).toHaveFocus()
      await userEvent.keyboard("{Enter}")
      await expect.element(page.getByText("Welcome, Commander", { exact: true })).toBeVisible()
      await expect.element(dialog).not.toBeInTheDocument()
    })
  })

  it("should clear the alias error when the player edits it", async () => {
    await InvalidAlias.run()
    const alias = page.getByRole("textbox", { name: "Choose your alias" })
    await page.mark("Edit the invalid alias", async () => {
      await expect.element(page.getByRole("alert")).toHaveTextContent("This alias is already in use.")
      await expect.element(alias).toHaveAttribute("aria-invalid", "true")
      await alias.fill("C")
      await expect.element(page.getByRole("alert")).not.toBeInTheDocument()
      await expect.element(alias).toHaveAttribute("aria-invalid", "false")
    })
  })

  it("should prevent a second submission while saving a valid alias", async () => {
    await Pending.run()
    await page.getByRole("textbox", { name: "Choose your alias" }).fill("Commander")
    await expect.element(page.getByRole("button", { name: "Saving..." })).toBeDisabled()
  })
})
