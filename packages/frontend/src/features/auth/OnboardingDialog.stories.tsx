import { noop } from "@guillaume-docquier/tools-ts"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { type ComponentProps, type ReactElement, useState } from "react"
import { OnboardingDialog } from "./OnboardingDialog.tsx"

const meta = {
  title: "Application/Onboarding Dialog",
  component: OnboardingDialog,
  args: {
    finishOnboarding: noop,
    isFinishingOnboarding: false,
    finishOnboardingError: null,
    resetFinishOnboardingError: noop,
  },
} satisfies Meta<typeof OnboardingDialog>

export default meta
type Story = StoryObj<typeof meta>

function OnboardingExample(args: ComponentProps<typeof OnboardingDialog>): ReactElement {
  const [alias, setAlias] = useState<string>()
  const [error, setError] = useState(args.finishOnboardingError)

  if (alias !== undefined) {
    return <p role="status">Welcome, {alias}</p>
  }

  return (
    <OnboardingDialog
      {...args}
      finishOnboarding={({ alias }) => {
        setAlias(alias)
      }}
      finishOnboardingError={error}
      resetFinishOnboardingError={() => {
        setError(null)
      }}
    />
  )
}

export const Interactive: Story = {
  render: (args) => <OnboardingExample {...args} />,
}

export const Pending: Story = {
  args: { isFinishingOnboarding: true },
}

export const InvalidAlias: Story = {
  args: { finishOnboardingError: { message: "This alias is already in use." } },
}
