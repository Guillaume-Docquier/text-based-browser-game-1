import { composeStories } from "@storybook/react-vite"
import type { ReactElement } from "react"
import { describe, expect, it } from "vitest"
import { page, userEvent } from "vitest/browser"
import { Button } from "@/components/button.tsx"
import * as stories from "./TurnButton.stories.tsx"

const { Pending, Resolving, Interactive } = composeStories(stories, {
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

async function renderStory(story: typeof Interactive): Promise<void> {
  await story.run()
  await page.getByRole("button", { name: "Previous control" }).click()
}

function isCountdownVisible(): boolean {
  // CONSTRAINT: Vitest's toBeVisible ignores opacity. The countdown stays accessible while CSS makes it transparent, so check its painted visibility, including ancestors.
  return page
    .getByRole("button", { name: /^(Lock in|Cancel lock in)$/ })
    .getByText(/^\d{2,}:\d{2}:\d{2}$/)
    .element()
    .checkVisibility({ opacityProperty: true, visibilityProperty: true })
}

describe("TurnButton", () => {
  it("should reveal the action on hover and toggle lock-in with pointer clicks", async () => {
    await renderStory(Interactive)
    const lockInButton = page.getByRole("button", { name: "Lock in" })
    const cancelButton = page.getByRole("button", { name: "Cancel lock in" })

    await page.mark("Show the countdown before hover", async () => {
      await expect.element(page.getByText("Lock in", { exact: true })).not.toBeVisible()
      await expect.poll(isCountdownVisible).toBe(true)
    })

    await page.mark("Hover to reveal the lock-in action", async () => {
      await lockInButton.hover()
      await expect.element(page.getByText("Lock in", { exact: true })).toBeVisible()
      await expect.poll(isCountdownVisible).toBe(false)
    })

    await page.mark("Click to lock in the turn", async () => {
      await lockInButton.click()
      await expect.element(cancelButton).toHaveAttribute("aria-pressed", "true")
      await expect.element(page.getByText("Cancel", { exact: true })).toBeVisible()
    })

    await page.mark("Click again to cancel lock-in", async () => {
      await cancelButton.click()
      await expect.element(lockInButton).toHaveAttribute("aria-pressed", "false")
      await expect.element(page.getByText("Lock in", { exact: true })).toBeVisible()
    })

    await page.mark("Move the pointer away to restore the countdown", async () => {
      await page.getByRole("button", { name: "Next control" }).hover()
      await expect.element(page.getByText("Lock in", { exact: true })).not.toBeVisible()
      await expect.poll(isCountdownVisible).toBe(true)
    })
  })

  it("should toggle with Enter and Space and restore presentation as keyboard focus moves", async () => {
    await renderStory(Interactive)
    const lockInButton = page.getByRole("button", { name: "Lock in" })
    const cancelButton = page.getByRole("button", { name: "Cancel lock in" })
    const nextControl = page.getByRole("button", { name: "Next control" })

    await page.mark("Tab to reveal the lock-in action", async () => {
      await userEvent.tab()
      await expect.element(lockInButton).toHaveFocus()
      await expect.element(page.getByText("Lock in", { exact: true })).toBeVisible()
      await expect.poll(isCountdownVisible).toBe(false)
    })

    await page.mark("Press Enter to lock in the turn", async () => {
      await userEvent.keyboard("{Enter}")
      await expect.element(cancelButton).toHaveFocus()
      await expect.element(cancelButton).toHaveAttribute("aria-pressed", "true")
    })

    await page.mark("Tab away to restore the countdown while locked in", async () => {
      await userEvent.tab()
      await expect.element(nextControl).toHaveFocus()
      await expect.element(page.getByText("Cancel", { exact: true })).not.toBeVisible()
      await expect.poll(isCountdownVisible).toBe(true)
    })

    await page.mark("Shift-Tab back to reveal the cancel action", async () => {
      await userEvent.tab({ shift: true })
      await expect.element(cancelButton).toHaveFocus()
      await expect.element(page.getByText("Cancel", { exact: true })).toBeVisible()
      await expect.poll(isCountdownVisible).toBe(false)
    })

    await page.mark("Press Space to cancel lock-in", async () => {
      await userEvent.keyboard(" ")
      await expect.element(lockInButton).toHaveFocus()
      await expect.element(lockInButton).toHaveAttribute("aria-pressed", "false")
      await expect.element(page.getByText("Lock in", { exact: true })).toBeVisible()
    })

    await page.mark("Tab away to restore the countdown after cancellation", async () => {
      await userEvent.tab()
      await expect.element(nextControl).toHaveFocus()
      await expect.element(page.getByText("Lock in", { exact: true })).not.toBeVisible()
      await expect.poll(isCountdownVisible).toBe(true)
    })
  })

  it("should disable pending and resolving buttons but preserve only the pending hover action", async () => {
    await page.mark("Pending disables activation but keeps the hover action", async () => {
      await renderStory(Pending)
      const pendingButton = page.getByRole("button", { name: "Lock in" })
      await expect.element(pendingButton).toBeDisabled()

      await pendingButton.hover()
      await expect.element(page.getByText("Lock in", { exact: true })).toBeVisible()
      await expect.poll(isCountdownVisible).toBe(false)
    })

    await page.mark("Resolving disables activation and keeps the countdown on hover", async () => {
      await renderStory(Resolving)
      const resolvingButton = page.getByRole("button", { name: "Cancel lock in" })
      await expect.element(resolvingButton).toBeDisabled()
      await expect.element(resolvingButton.getByText("02:17:43", { exact: true })).toBeVisible()

      await resolvingButton.hover()
      await expect.element(page.getByText("Cancel", { exact: true })).not.toBeVisible()
      await expect.poll(isCountdownVisible).toBe(true)
    })
  })
})
