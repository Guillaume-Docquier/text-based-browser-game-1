import { composeStories } from "@storybook/react-vite"
import { describe, expect, it } from "vitest"
import { page, userEvent } from "vitest/browser"
import * as stories from "./OnboardingDialog.stories.tsx"

const { Interactive, InvalidAlias } = composeStories(stories)

describe("OnboardingDialog", () => {
  it("should keep focus in the required dialog until a valid alias is submitted", async () => {
    await Interactive.run()
    const dialog = page.getByRole("dialog", { name: "Welcome, commander" })
    const alias = dialog.getByRole("textbox", { name: "Choose your alias" })
    const submit = dialog.getByRole("button", { name: "Continue" })

    await page.mark("Focus the alias field and try to dismiss the required dialog", async () => {
      await expect.element(alias).toHaveFocus()
      await expect.element(submit).toBeDisabled()
      await userEvent.keyboard("{Escape}")
      await expect.element(dialog).toBeVisible()
      await expect.element(alias).toHaveFocus()
    })

    await page.mark("Enter an alias and cycle focus inside the dialog", async () => {
      await alias.fill("Commander")
      await userEvent.tab()
      await expect.element(submit).toHaveFocus()
      await userEvent.tab()
      await expect.element(alias).toHaveFocus()
    })

    await page.mark("Submit the alias with Enter", async () => {
      await userEvent.keyboard("{Enter}")
      await expect.element(page.getByRole("status")).toHaveTextContent("Welcome, Commander")
      await expect.element(dialog).not.toBeInTheDocument()
    })
  })

  it("should clear the rejected alias error when the player edits the field", async () => {
    await Interactive.run({ args: { ...Interactive.args, ...InvalidAlias.args } })
    const alias = page.getByRole("textbox", { name: "Choose your alias" })
    const error = page.getByRole("alert")

    await page.mark("Show the rejected alias error", async () => {
      await expect.element(error).toHaveTextContent("This alias is already in use.")
      await expect.element(alias).toHaveAttribute("aria-invalid", "true")
    })

    await page.mark("Edit the alias", async () => {
      await alias.fill("Commander")
      await expect.element(error).not.toBeInTheDocument()
      await expect.element(alias).toHaveAttribute("aria-invalid", "false")
    })
  })
})
