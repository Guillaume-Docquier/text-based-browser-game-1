import { Assert, noop } from "@guillaume-docquier/tools-ts"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { type ReactElement, useState } from "react"
import { expect } from "storybook/test"
import { Button } from "@/components/button.tsx"
import { TurnButton } from "./TurnButton.tsx"

const meta = {
  title: "Application/Turn Button",
  component: TurnButton,
  // A second control keeps keyboard focus transitions inside the story document.
  decorators: [
    (Story): ReactElement => (
      <div className="flex items-center gap-4">
        <Story />
        <Button variant="outline">Next control</Button>
      </div>
    ),
  ],
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
    const nextControl = canvas.getByRole("button", { name: "Next control" })
    // VITEST is not exposed to browser stories; Vite supplies the test mode.
    const browserUserEvent = import.meta.env.MODE === "test" ? (await import("vitest/browser")).userEvent : undefined
    // Native keyboard events keep CSS focus and hover state consistent in browser tests.
    const interaction = browserUserEvent ?? userEvent
    if (browserUserEvent !== undefined) {
      await browserUserEvent.hover(nextControl)
    }
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
    if (browserUserEvent !== undefined) {
      await browserUserEvent.hover(button)
      if (!args.disabled || args.isPending) {
        await expect(action).toBeVisible()
        await expect(clock).toHaveStyle({ opacity: "0" })
      } else {
        await expect(action).not.toBeVisible()
        await expect(clock).toHaveStyle({ opacity: "1" })
      }
      await browserUserEvent.hover(nextControl)
      await expect(action).not.toBeVisible()
      await expect(clock).toHaveStyle({ opacity: "1" })
    }
    await interaction.tab()
    if (args.disabled) {
      await expect(button).not.toHaveFocus()
    } else {
      await expect(button).toHaveFocus()
      await expect(action).toBeVisible()
      await expect(clock).toHaveStyle({ opacity: "0" })
      await interaction.tab()
      await expect(nextControl).toHaveFocus()
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
    const nextControl = canvas.getByRole("button", { name: "Next control" })
    const browserUserEvent = import.meta.env.MODE === "test" ? (await import("vitest/browser")).userEvent : undefined
    // Native keyboard events keep CSS focus and hover state consistent in browser tests.
    const interaction = browserUserEvent ?? userEvent
    if (browserUserEvent !== undefined) {
      await browserUserEvent.hover(nextControl)
    }
    await expect(button).toHaveAttribute("aria-pressed", "false")
    await interaction.tab()
    await expect(button).toHaveFocus()
    await expect(canvas.getByText("Lock in", { exact: true })).toBeVisible()
    await interaction.keyboard("{Enter}")
    await expect(button).toHaveAccessibleName("Cancel lock in")
    await expect(button).toHaveAttribute("aria-pressed", "true")
    await expect(canvas.getByText("Cancel", { exact: true })).toBeVisible()
    await interaction.tab()
    await expect(nextControl).toHaveFocus()
    await interaction.tab({ shift: true })
    await expect(button).toHaveFocus()
    await expect(canvas.getByText("Cancel", { exact: true })).toBeVisible()
    await interaction.keyboard(" ")
    await expect(button).toHaveAccessibleName("Lock in")
    await expect(button).toHaveAttribute("aria-pressed", "false")
    await expect(canvas.getByText("Lock in", { exact: true })).toBeVisible()
    await interaction.tab()
    await expect(nextControl).toHaveFocus()
    await expect(canvas.getByText("Lock in", { exact: true })).not.toBeVisible()
    await expect(canvas.getByText("Next turn", { exact: true })).toBeVisible()

    await interaction.click(button)
    await expect(button).toHaveAccessibleName("Cancel lock in")
    await interaction.click(button)
    await expect(button).toHaveAccessibleName("Lock in")
    await expect(button).toHaveAttribute("aria-pressed", "false")
  },
}
