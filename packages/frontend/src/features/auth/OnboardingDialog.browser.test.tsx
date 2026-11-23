import { composeStories } from "@storybook/react-vite"
import { describe, expect, it } from "vitest"
import { page, userEvent } from "vitest/browser"
import * as stories from "./OnboardingDialog.stories.tsx"

const { Interactive, InvalidAlias } = composeStories(stories)

describe("OnboardingDialog", () => {
  const alias = page.getByRole("textbox", { name: "Choose your alias" })
  const submit = page.getByRole("button", { name: "Continue" })

  it("should keep keyboard focus inside the required dialog until an alias is submitted", async () => {
    await Interactive.run()
    const dialog = page.getByRole("dialog", { name: "Welcome, commander" })

    await page.mark("Start in the alias field and try to dismiss the required dialog", async () => {
      await expect.element(alias).toHaveFocus()
      await expect.element(submit).toBeDisabled()
      await userEvent.keyboard("{Escape}")
      await expect.element(dialog).toBeVisible()
      await expect.element(alias).toHaveFocus()
    })

    await page.mark("Enter an alias and tab around the dialog", async () => {
      await alias.fill("   ")
      await expect.element(submit).toBeDisabled()
      await alias.fill("Commander")
      await userEvent.tab()
      await expect.element(submit).toHaveFocus()
      await userEvent.tab()
      await expect.element(alias).toHaveFocus()
    })

    await page.mark("Submit the typed alias with Enter", async () => {
      await userEvent.keyboard("{Enter}")
      await expect.element(page.getByRole("status")).toHaveTextContent("Welcome, Commander")
      await expect.element(dialog).not.toBeInTheDocument()
    })
  })

  it("should clear the alias error when the player edits the field", async () => {
    await InvalidAlias.run()
    const alert = page.getByRole("alert")

    await page.mark("Read the rejected alias message", async () => {
      await expect.element(alert).toHaveTextContent("This alias is already in use.")
      await expect.element(alias).toHaveAttribute("aria-invalid", "true")
    })

    await page.mark("Edit the alias to clear the error", async () => {
      await alias.fill("Commander")
      await expect.element(alert).not.toBeInTheDocument()
      await expect.element(alias).toHaveAttribute("aria-invalid", "false")
      await expect.element(submit).toBeEnabled()
    })
  })
})
