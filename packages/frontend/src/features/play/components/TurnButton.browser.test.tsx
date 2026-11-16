import { composeStories } from "@storybook/react-vite"
import type { ReactElement } from "react"
import { describe, expect, it } from "vitest"
import { page, userEvent } from "vitest/browser"
import { Button } from "@/components/button.tsx"
import * as stories from "./TurnButton.stories.tsx"

const { Normal, LockedIn, Pending, Resolving, Interactive } = composeStories(stories, {
  decorators: [
    (Story): ReactElement => (
      <div className="flex items-center gap-4 p-8">
        <Button variant="outline">Previous control</Button>
        <Story />
        <Button variant="outline">Next control</Button>
      </div>
    ),
  ],
})

async function renderStory(story: typeof Normal): Promise<void> {
  // run() cleans up the preceding portable story before mounting this one.
  await story.run()
  // Native pointer position persists between tests. Start outside the turn button,
  // with a known keyboard position, including after a preceding test fails.
  await page.getByRole("button", { name: "Previous control" }).click()
}

function isCountdownVisible(): boolean {
  // Vitest's toBeVisible ignores opacity. The countdown stays accessible while
  // CSS makes it transparent, so check its painted visibility, including ancestors.
  return page.getByText("02:17:43").element().checkVisibility({ opacityProperty: true, visibilityProperty: true })
}

describe("TurnButton", () => {
  it("should expose the countdown, turn and deadline before locking in", async () => {
    await renderStory(Normal)
    const button = page.getByRole("button", { name: "Lock in" })

    await expect.element(button).toHaveAttribute("aria-pressed", "false")
    await expect.element(button).toHaveAttribute("aria-busy", "false")
    await expect.element(button).toHaveAttribute("title", "Next turn at 8:00 PM")
    await expect.element(button).toHaveAccessibleDescription(/Next turn.*02:17:43.*Turn 142/)
    await expect.element(page.getByText("Next turn", { exact: true })).toBeVisible()
    await expect.poll(isCountdownVisible).toBe(true)
    await expect.element(page.getByText("Lock in", { exact: true })).not.toBeVisible()
  })

  it("should reveal the lock-in action on hover and restore the countdown on exit", async () => {
    await renderStory(Normal)
    await page.getByRole("button", { name: "Lock in" }).hover()

    await expect.element(page.getByText("Lock in", { exact: true })).toBeVisible()
    await expect.poll(isCountdownVisible).toBe(false)

    await page.getByRole("button", { name: "Next control" }).hover()

    await expect.element(page.getByText("Lock in", { exact: true })).not.toBeVisible()
    await expect.poll(isCountdownVisible).toBe(true)
  })

  it("should reveal cancellation on hover when locked in", async () => {
    await renderStory(LockedIn)
    const button = page.getByRole("button", { name: "Cancel lock in" })
    await expect.element(button).toHaveAttribute("aria-pressed", "true")
    await expect.element(button).toHaveAccessibleDescription(/Locked in.*02:17:43.*Turn 142/)
    await expect.element(page.getByText("Locked in", { exact: true })).toBeVisible()

    await button.hover()

    await expect.element(page.getByText("Cancel", { exact: true })).toBeVisible()
    await expect.poll(isCountdownVisible).toBe(false)

    await page.getByRole("button", { name: "Next control" }).hover()

    await expect.element(page.getByText("Cancel", { exact: true })).not.toBeVisible()
    await expect.poll(isCountdownVisible).toBe(true)
  })

  it("should keep the hovered action visible while a request is pending", async () => {
    await renderStory(Pending)
    const button = page.getByRole("button", { name: "Lock in" })
    await expect.element(button).toBeDisabled()
    await expect.element(button).toHaveAttribute("aria-busy", "true")

    await button.hover()

    await expect.element(page.getByText("Lock in", { exact: true })).toBeVisible()
    await expect.poll(isCountdownVisible).toBe(false)

    await page.getByRole("button", { name: "Next control" }).hover()

    await expect.element(page.getByText("Lock in", { exact: true })).not.toBeVisible()
    await expect.poll(isCountdownVisible).toBe(true)
  })

  it("should keep the countdown visible on hover while the turn is resolving", async () => {
    await renderStory(Resolving)
    const button = page.getByRole("button", { name: "Cancel lock in" })
    await expect.element(button).toBeDisabled()
    await expect.element(button).toHaveAttribute("aria-pressed", "true")
    await expect.element(button).toHaveAttribute("aria-busy", "false")

    await button.hover()

    await expect.element(page.getByText("Cancel", { exact: true })).not.toBeVisible()
    await expect.poll(isCountdownVisible).toBe(true)
  })

  it.each([
    { state: "normal", story: Normal, name: "Lock in", action: "Lock in" },
    { state: "locked in", story: LockedIn, name: "Cancel lock in", action: "Cancel" },
  ])("should reveal the $state action only while keyboard focus is on the button", async ({ story, name, action }) => {
    await renderStory(story)
    const button = page.getByRole("button", { name })

    await userEvent.tab()

    await expect.element(button).toHaveFocus()
    await expect.element(page.getByText(action, { exact: true })).toBeVisible()
    await expect.poll(isCountdownVisible).toBe(false)

    await userEvent.tab()

    await expect.element(page.getByRole("button", { name: "Next control" })).toHaveFocus()
    await expect.element(page.getByText(action, { exact: true })).not.toBeVisible()
    await expect.poll(isCountdownVisible).toBe(true)
  })

  it.each([
    { state: "pending", story: Pending, action: "Lock in" },
    { state: "resolving", story: Resolving, action: "Cancel" },
  ])("should skip the $state button during keyboard navigation", async ({ story, action }) => {
    await renderStory(story)

    await userEvent.tab()

    await expect.element(page.getByRole("button", { name: "Next control" })).toHaveFocus()
    await expect.element(page.getByText(action, { exact: true })).not.toBeVisible()
    await expect.poll(isCountdownVisible).toBe(true)
  })

  it("should lock in and cancel with successive pointer clicks", async () => {
    await renderStory(Interactive)

    await page.getByRole("button", { name: "Lock in" }).click()

    await expect.element(page.getByRole("button", { name: "Cancel lock in" })).toHaveAttribute("aria-pressed", "true")
    await expect.element(page.getByText("Cancel", { exact: true })).toBeVisible()

    await page.getByRole("button", { name: "Cancel lock in" }).click()

    await expect.element(page.getByRole("button", { name: "Lock in" })).toHaveAttribute("aria-pressed", "false")
    await expect.element(page.getByText("Lock in", { exact: true })).toBeVisible()
  })

  it("should restore the countdown and updated action when leaving and returning after a toggle", async () => {
    await renderStory(Interactive)
    const nextControl = page.getByRole("button", { name: "Next control" })

    await userEvent.tab()
    await expect.element(page.getByRole("button", { name: "Lock in" })).toHaveFocus()
    await userEvent.keyboard("{Enter}")

    const cancelButton = page.getByRole("button", { name: "Cancel lock in" })
    await expect.element(cancelButton).toHaveFocus()
    await expect.element(cancelButton).toHaveAttribute("aria-pressed", "true")
    await expect.element(page.getByText("Cancel", { exact: true })).toBeVisible()
    await expect.poll(isCountdownVisible).toBe(false)

    await userEvent.tab()

    await expect.element(nextControl).toHaveFocus()
    await expect.element(page.getByText("Cancel", { exact: true })).not.toBeVisible()
    await expect.poll(isCountdownVisible).toBe(true)

    await userEvent.tab({ shift: true })

    await expect.element(cancelButton).toHaveFocus()
    await expect.element(page.getByText("Cancel", { exact: true })).toBeVisible()
    await expect.poll(isCountdownVisible).toBe(false)

    await userEvent.keyboard(" ")

    const lockInButton = page.getByRole("button", { name: "Lock in" })
    await expect.element(lockInButton).toHaveFocus()
    await expect.element(lockInButton).toHaveAttribute("aria-pressed", "false")
    await expect.element(page.getByText("Lock in", { exact: true })).toBeVisible()

    await userEvent.tab()

    await expect.element(nextControl).toHaveFocus()
    await expect.element(page.getByText("Lock in", { exact: true })).not.toBeVisible()
    await expect.poll(isCountdownVisible).toBe(true)
  })

  it.each([
    { key: "Enter", input: "{Enter}" },
    { key: "Space", input: " " },
  ])("should toggle lock-in with the $key key", async ({ input }) => {
    await renderStory(Interactive)
    await userEvent.tab()
    await expect.element(page.getByRole("button", { name: "Lock in" })).toHaveFocus()

    await userEvent.keyboard(input)

    await expect.element(page.getByRole("button", { name: "Cancel lock in" })).toHaveAttribute("aria-pressed", "true")
    await expect.element(page.getByText("Cancel", { exact: true })).toBeVisible()

    await userEvent.keyboard(input)

    await expect.element(page.getByRole("button", { name: "Lock in" })).toHaveAttribute("aria-pressed", "false")
    await expect.element(page.getByText("Lock in", { exact: true })).toBeVisible()
  })
})
