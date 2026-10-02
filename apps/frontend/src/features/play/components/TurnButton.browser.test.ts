import { Assert } from "@guillaume-docquier/tools-ts"
import { composeStory } from "@storybook/react-vite"
import { describe, expect, it } from "vitest"
import { page, userEvent } from "vitest/browser"
import meta, { Interactive, LockedIn, Normal, Pending, Resolving } from "./TurnButton.stories.tsx"

const nativeMeta = { ...meta, play: undefined }

const enabledStories = [
  {
    name: "Normal",
    story: composeStory({ ...Normal, play: undefined }, nativeMeta, undefined, "Normal"),
    buttonName: "Lock in",
    actionText: "Lock in",
  },
  {
    name: "LockedIn",
    story: composeStory({ ...LockedIn, play: undefined }, nativeMeta, undefined, "LockedIn"),
    buttonName: "Cancel lock in",
    actionText: "Cancel",
  },
  {
    name: "Interactive",
    story: composeStory({ ...Interactive, play: undefined }, nativeMeta, undefined, "Interactive"),
    buttonName: "Lock in",
    actionText: "Lock in",
  },
] as const

describe("TurnButton native interactions", () => {
  it.each(enabledStories)("should show the $name action on hover and focus", async ({ story, buttonName, actionText }) => {
    await story.run()

    const button = page.getByRole("button", { name: buttonName })
    const nextControl = page.getByRole("button", { name: "Next control" })
    const action = page.getByText(actionText, { exact: true })
    const clock = page.getByText("02:17:43").element().parentElement
    Assert.isDefined(clock)

    await userEvent.hover(nextControl)
    await expect.element(action).not.toBeVisible()
    await expect.element(clock).toHaveStyle({ opacity: "1" })

    await userEvent.hover(button)
    await expect.element(action).toBeVisible()
    await expect.element(clock).toHaveStyle({ opacity: "0" })

    await userEvent.hover(nextControl)
    await expect.element(action).not.toBeVisible()
    await expect.element(clock).toHaveStyle({ opacity: "1" })

    await userEvent.tab()
    await expect.element(button).toHaveFocus()
    await expect.element(action).toBeVisible()
    await expect.element(clock).toHaveStyle({ opacity: "0" })
    await userEvent.tab()
    await expect.element(nextControl).toHaveFocus()
    await expect.element(action).not.toBeVisible()
    await expect.element(clock).toHaveStyle({ opacity: "1" })
  })

  it("should show the Pending action on hover but skip keyboard focus", async () => {
    const story = composeStory({ ...Pending, play: undefined }, nativeMeta, undefined, "Pending")
    await story.run()

    const button = page.getByRole("button", { name: "Lock in" })
    const nextControl = page.getByRole("button", { name: "Next control" })
    const action = page.getByText("Lock in", { exact: true })
    const clock = page.getByText("02:17:43").element().parentElement
    Assert.isDefined(clock)

    await userEvent.hover(nextControl)
    await expect.element(action).not.toBeVisible()
    await expect.element(clock).toHaveStyle({ opacity: "1" })
    await userEvent.hover(button)
    await expect.element(action).toBeVisible()
    await expect.element(clock).toHaveStyle({ opacity: "0" })
    await userEvent.hover(nextControl)
    await expect.element(action).not.toBeVisible()
    await expect.element(clock).toHaveStyle({ opacity: "1" })

    await userEvent.tab()
    await expect.element(button).not.toHaveFocus()
    await expect.element(nextControl).toHaveFocus()
    await expect.element(action).not.toBeVisible()
    await expect.element(clock).toHaveStyle({ opacity: "1" })
  })

  it("should keep the Resolving clock visible and skip keyboard focus", async () => {
    const story = composeStory({ ...Resolving, play: undefined }, nativeMeta, undefined, "Resolving")
    await story.run()

    const button = page.getByRole("button", { name: "Cancel lock in" })
    const nextControl = page.getByRole("button", { name: "Next control" })
    const action = page.getByText("Cancel", { exact: true })
    const clock = page.getByText("02:17:43").element().parentElement
    Assert.isDefined(clock)

    await userEvent.hover(nextControl)
    await expect.element(action).not.toBeVisible()
    await expect.element(clock).toHaveStyle({ opacity: "1" })
    await userEvent.hover(button)
    await expect.element(action).not.toBeVisible()
    await expect.element(clock).toHaveStyle({ opacity: "1" })
    await userEvent.hover(nextControl)
    await expect.element(action).not.toBeVisible()
    await expect.element(clock).toHaveStyle({ opacity: "1" })

    await userEvent.tab()
    await expect.element(button).not.toHaveFocus()
    await expect.element(nextControl).toHaveFocus()
    await expect.element(action).not.toBeVisible()
    await expect.element(clock).toHaveStyle({ opacity: "1" })
  })

  it("should toggle Interactive with native Enter and Space while focused", async () => {
    const story = composeStory({ ...Interactive, play: undefined }, nativeMeta, undefined, "Interactive")
    await story.run()

    const button = page.getByRole("button", { name: "Lock in" }).element()
    const nextControl = page.getByRole("button", { name: "Next control" })
    const clock = page.getByText("02:17:43").element().parentElement
    Assert.isDefined(clock)
    await userEvent.click(nextControl)
    await userEvent.tab({ shift: true })
    await expect.element(button).toHaveFocus()
    await expect.element(page.getByText("Lock in", { exact: true })).toBeVisible()
    await expect.element(clock).toHaveStyle({ opacity: "0" })

    await userEvent.keyboard("{Enter}")
    await expect.element(button).toHaveAccessibleName("Cancel lock in")
    await expect.element(button).toHaveAttribute("aria-pressed", "true")
    await expect.element(page.getByText("Cancel", { exact: true })).toBeVisible()
    await userEvent.tab()
    await expect.element(nextControl).toHaveFocus()
    await expect.element(page.getByText("Cancel", { exact: true })).not.toBeVisible()
    await expect.element(clock).toHaveStyle({ opacity: "1" })

    await userEvent.tab({ shift: true })
    await expect.element(button).toHaveFocus()
    await expect.element(page.getByText("Cancel", { exact: true })).toBeVisible()
    await userEvent.keyboard(" ")
    await expect.element(button).toHaveAccessibleName("Lock in")
    await expect.element(button).toHaveAttribute("aria-pressed", "false")
    await expect.element(page.getByText("Lock in", { exact: true })).toBeVisible()
    await userEvent.tab()
    await expect.element(nextControl).toHaveFocus()
    await expect.element(page.getByText("Lock in", { exact: true })).not.toBeVisible()
    await expect.element(clock).toHaveStyle({ opacity: "1" })
  })
})
