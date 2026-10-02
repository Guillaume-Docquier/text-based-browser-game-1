import { Assert, noop } from "@guillaume-docquier/tools-ts"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { useState } from "react"
import { expect } from "storybook/test"
import { TurnButton } from "./TurnButton.tsx"

const meta = {
  title: "Application/Turn Button",
  component: TurnButton,
  args: {
    turn: 142,
    countdown: "02:17:43",
    deadline: "Next turn at 8:00 PM",
    isLockedIn: false,
    isPending: false,
    disabled: false,
    onToggle: noop,
  },
  play: async ({ args, canvas, userEvent }): Promise<void> => {
    const button = canvas.getByRole("button", { name: args.isLockedIn ? "Cancel lock in" : "Lock in" })
    const clock = canvas.getByText(args.countdown).parentElement
    Assert.isDefined(clock)
    const action = canvas.getByText(args.isLockedIn ? "Cancel" : "Lock in", { exact: true })
    await expect(button).toHaveAttribute("aria-pressed", String(args.isLockedIn))
    await expect(button).toHaveAttribute("aria-busy", String(args.isPending))
    await expect(button).toHaveAttribute("title", args.deadline)
    await expect(button).toHaveAccessibleDescription(/02:17:43.*Turn 142/)
    await expect(clock).toHaveTextContent(args.isLockedIn ? "Locked in" : "Next turn")
    await expect(clock).toHaveStyle({ opacity: "1" })
    await expect(action).not.toBeVisible()
    if (args.disabled) {
      await expect(button).toBeDisabled()
    } else {
      await expect(button).toBeEnabled()
    }

    // Storybook's simulated pointer events do not activate CSS :hover.
    if (import.meta.env.VITEST === "true") {
      const { userEvent: browserUserEvent } = await import("vitest/browser")
      await browserUserEvent.hover(button)
      if (!args.disabled || args.isPending) {
        await expect(action).toBeVisible()
        await expect(clock).toHaveStyle({ opacity: "0" })
      } else {
        await expect(action).not.toBeVisible()
        await expect(clock).toHaveStyle({ opacity: "1" })
      }
      await browserUserEvent.unhover(button)
      await expect(action).not.toBeVisible()
      await expect(clock).toHaveStyle({ opacity: "1" })
    }
    await userEvent.tab()
    if (args.disabled) {
      await expect(button).not.toHaveFocus()
    } else {
      await expect(button).toHaveFocus()
      await expect(action).toBeVisible()
      await expect(clock).toHaveStyle({ opacity: "0" })
      await userEvent.tab()
      await expect(action).not.toBeVisible()
    }
  },
} satisfies Meta<typeof TurnButton>

export default meta
type Story = StoryObj<typeof meta>

export const Normal: Story = {}

export const LockedIn: Story = {
  args: { isLockedIn: true },
}

export const Pending: Story = {
  args: { disabled: true, isPending: true },
}

export const Resolving: Story = {
  args: { disabled: true, isLockedIn: true },
}

export const Interactive: Story = {
  render: function Render(args) {
    const [isLockedIn, setIsLockedIn] = useState(false)
    return (
      <TurnButton
        {...args}
        isLockedIn={isLockedIn}
        onToggle={() => {
          setIsLockedIn(!isLockedIn)
        }}
      />
    )
  },
  play: async ({ canvas, userEvent }): Promise<void> => {
    const button = canvas.getByRole("button", { name: "Lock in" })
    await expect(button).toHaveAttribute("aria-pressed", "false")
    await userEvent.tab()
    await expect(button).toHaveFocus()
    await expect(canvas.getByText("Lock in", { exact: true })).toBeVisible()
    await userEvent.keyboard("{Enter}")
    await expect(button).toHaveAccessibleName("Cancel lock in")
    await expect(button).toHaveAttribute("aria-pressed", "true")
    await expect(canvas.getByText("Cancel", { exact: true })).toBeVisible()
    await userEvent.tab()
    await userEvent.tab()
    await expect(button).toHaveFocus()
    await expect(canvas.getByText("Cancel", { exact: true })).toBeVisible()
    await userEvent.keyboard(" ")
    await expect(button).toHaveAccessibleName("Lock in")
    await expect(button).toHaveAttribute("aria-pressed", "false")
    await expect(canvas.getByText("Lock in", { exact: true })).toBeVisible()
    await userEvent.tab()
    await expect(canvas.getByText("Lock in", { exact: true })).not.toBeVisible()
    await expect(canvas.getByText("Next turn", { exact: true })).toBeVisible()

    await userEvent.click(button)
    await expect(button).toHaveAccessibleName("Cancel lock in")
    await userEvent.click(button)
    await expect(button).toHaveAccessibleName("Lock in")
    await expect(button).toHaveAttribute("aria-pressed", "false")
  },
}
