import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, fn, waitFor, within } from "storybook/test"
import { OnboardingDialog } from "./OnboardingDialog.tsx"

const meta = {
  title: "Application/Onboarding Dialog",
  component: OnboardingDialog,
  args: {
    finishOnboarding: fn(),
    isFinishingOnboarding: false,
    finishOnboardingError: null,
    resetFinishOnboardingError: fn(),
  },
} satisfies Meta<typeof OnboardingDialog>

export default meta
type Story = StoryObj<typeof meta>

/**
 * Required onboarding keeps focus in the dialog until an alias is submitted.
 */
export const RequiredAlias: Story = {
  play: async ({ args, canvasElement, userEvent }) => {
    const body = within(canvasElement.ownerDocument.body)
    const dialog = await body.findByRole("dialog", { name: "Welcome, commander" })
    const alias = within(dialog).getByRole("textbox", { name: "Choose your alias" })
    const submit = within(dialog).getByRole("button", { name: "Continue" })
    await waitFor(async () => {
      await expect(alias).toHaveFocus()
    })
    await expect(submit).toBeDisabled()
    await userEvent.keyboard("{Escape}")
    await expect(dialog).toBeVisible()
    await expect(alias).toHaveFocus()
    await userEvent.type(alias, "Commander")
    await userEvent.tab()
    await expect(submit).toHaveFocus()
    await userEvent.tab()
    await waitFor(async () => {
      await expect(alias).toHaveFocus()
    })
    await userEvent.keyboard("{Enter}")
    await expect(args.finishOnboarding).toHaveBeenCalledWith({ alias: "Commander" })
  },
}

export const Pending: Story = {
  args: { isFinishingOnboarding: true },
}

export const InvalidAlias: Story = {
  args: { finishOnboardingError: { message: "This alias is already in use." } },
  play: async ({ args, canvasElement, userEvent }) => {
    const body = within(canvasElement.ownerDocument.body)
    await expect(await body.findByRole("alert")).toHaveTextContent("This alias is already in use.")
    const alias = body.getByRole("textbox", { name: "Choose your alias" })
    await expect(alias).toHaveAttribute("aria-invalid", "true")
    await userEvent.type(alias, "C")
    await expect(args.resetFinishOnboardingError).toHaveBeenCalled()
  },
}
