import { noop } from "@guillaume-docquier/tools-ts"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { type ReactElement, useState } from "react"
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
  render: function Render(args): ReactElement {
    const [submittedAlias, setSubmittedAlias] = useState<string>()
    const [error, setError] = useState(args.finishOnboardingError)
    if (submittedAlias !== undefined) {
      return <output>Welcome, {submittedAlias}</output>
    }

    return (
      <OnboardingDialog
        {...args}
        finishOnboarding={({ alias }) => {
          setSubmittedAlias(alias)
        }}
        finishOnboardingError={error}
        resetFinishOnboardingError={() => {
          setError(null)
        }}
      />
    )
  },
} satisfies Meta<typeof OnboardingDialog>

export default meta
type Story = StoryObj<typeof meta>

export const Interactive: Story = {}

export const Pending: Story = {
  args: { isFinishingOnboarding: true },
}

export const InvalidAlias: Story = {
  args: { finishOnboardingError: { message: "This alias is already in use." } },
}
