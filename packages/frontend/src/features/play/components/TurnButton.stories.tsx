import { noop } from "@guillaume-docquier/tools-ts"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { type ComponentProps, type ReactElement, useEffect, useState } from "react"
import { TurnButton } from "./TurnButton.tsx"

type TurnButtonStoryArgs = Omit<ComponentProps<typeof TurnButton>, "countdown"> & {
  countdownSeconds: number
}

type TurnButtonMeta = Omit<Meta<TurnButtonStoryArgs>, "component"> & {
  component: typeof TurnButton
}

const meta = {
  title: "Application/Turn Button",
  component: TurnButton,
  args: {
    turn: 142,
    countdownSeconds: 8263,
    deadline: "Next turn at 8:00 PM",
    isLockedIn: false,
    isPending: false,
    disabled: false,
    onToggle: noop,
  },
  render: ({ countdownSeconds, ...args }): ReactElement => (
    <TurnButton {...args} countdown={Temporal.Duration.from({ seconds: countdownSeconds })} />
  ),
} satisfies TurnButtonMeta

export default meta
type Story = StoryObj<Omit<typeof meta, "component">>

export const Interactive: Story = {
  render: function Render(args) {
    const [isLockedIn, setIsLockedIn] = useState(args.isLockedIn)
    const [countdown, setCountdown] = useState(() => Temporal.Duration.from({ seconds: args.countdownSeconds }))

    // CONSTRAINT: Reset the countdown when the storybook prop changes
    useEffect(() => {
      setCountdown(Temporal.Duration.from({ seconds: args.countdownSeconds }))
    }, [args.countdownSeconds])

    useEffect(() => {
      const interval = setInterval(() => {
        setCountdown((currentCountdown) => currentCountdown.subtract({ seconds: 1 }))
      }, 1000)

      return (): void => {
        clearInterval(interval)
      }
    }, [])

    return (
      <TurnButton
        key={args.countdownSeconds}
        {...args}
        isLockedIn={isLockedIn}
        onToggle={() => {
          setIsLockedIn(!isLockedIn)
        }}
        countdown={countdown}
      />
    )
  },
}

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
