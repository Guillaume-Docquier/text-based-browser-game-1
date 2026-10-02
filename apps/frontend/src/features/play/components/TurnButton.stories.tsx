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
    const clock = canvas.getByText(args.countdown).parentElement
    Assert.isDefined(clock)
    await expect(button).toHaveAttribute("aria-pressed", String(args.isLockedIn))
    await expect(button).toHaveAttribute("aria-busy", String(args.isPending))
    await expect(button).toHaveAttribute("title", args.deadline)
    await expect(button).toHaveAccessibleDescription(/02:17:43.*Turn 142/)
    await expect(clock).toHaveTextContent(args.isLockedIn ? "Locked in" : "Next turn")
    if (args.disabled) {
      await expect(button).toBeDisabled()
    } else {
      await expect(button).toBeEnabled()
    }

    await userEvent.tab()
    if (args.disabled) {
      await expect(button).not.toHaveFocus()
    } else {
      await expect(button).toHaveFocus()
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
    await expect(button).toHaveAttribute("aria-pressed", "false")
    await userEvent.tab()
    await expect(button).toHaveFocus()
    await userEvent.keyboard("{Enter}")
    await expect(button).toHaveAccessibleName("Cancel lock in")
    await expect(button).toHaveAttribute("aria-pressed", "true")
    await userEvent.tab()
    await expect(nextControl).toHaveFocus()
    await userEvent.tab({ shift: true })
    await expect(button).toHaveFocus()
    await userEvent.keyboard(" ")
    await expect(button).toHaveAccessibleName("Lock in")
    await expect(button).toHaveAttribute("aria-pressed", "false")
    await userEvent.tab()
    await expect(nextControl).toHaveFocus()

    await userEvent.click(button)
    await expect(button).toHaveAccessibleName("Cancel lock in")
    await userEvent.click(button)
    await expect(button).toHaveAccessibleName("Lock in")
    await expect(button).toHaveAttribute("aria-pressed", "false")
  },
}
