import { noop } from "@guillaume-docquier/tools-ts"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { useState } from "react"
import { TurnButton } from "./TurnButton.tsx"

const meta = {
  title: "Game/Turn Button",
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
}
