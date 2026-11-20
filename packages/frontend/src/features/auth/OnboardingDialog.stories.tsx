import { noop } from "@guillaume-docquier/tools-ts"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { type ReactElement, useState } from "react"
import { OnboardingDialog } from "./OnboardingDialog.tsx"

const meta = {
  title: "Application/Onboarding Dialog",
  component: OnboardingDialog,
  args: { finishOnboarding: noop, isFinishingOnboarding: false, finishOnboardingError: null, resetFinishOnboardingError: noop },
  render: function Render(args): ReactElement {
    const [alias, setAlias] = useState<string>()
    const [error, setError] = useState(args.finishOnboardingError)
    return alias === undefined ? (
      <OnboardingDialog
        {...args}
        finishOnboardingError={error}
        resetFinishOnboardingError={() => {
          setError(null)
        }}
        finishOnboarding={(result) => {
          setAlias(result.alias)
        }}
      />
    ) : (
      <p>Welcome, {alias}</p>
    )
  },
} satisfies Meta<typeof OnboardingDialog>

export default meta
type Story = StoryObj<typeof meta>

export const Interactive: Story = {}
export const Pending: Story = { args: { isFinishingOnboarding: true } }
export const InvalidAlias: Story = { args: { finishOnboardingError: { message: "This alias is already in use." } } }
