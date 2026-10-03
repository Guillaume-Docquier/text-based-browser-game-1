import type { Meta, StoryObj } from "@storybook/react-vite"
import { RocketIcon } from "lucide-react"
import { expect } from "storybook/test"
import { Button } from "./button.tsx"

const meta = {
  title: "Design System/Button",
  component: Button,
  args: {
    children: "Launch fleet",
  },
} satisfies Meta<typeof Button>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvas, userEvent }) => {
    const button = canvas.getByRole("button", { name: "Launch fleet" })
    await expect(button).toBeEnabled()
    await userEvent.tab()
    await expect(button).toHaveFocus()
  },
}

export const Variants: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <Button>Default</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="outline">Outline</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="destructive">Destructive</Button>
      <Button variant="link">Link</Button>
    </div>
  ),
  play: async ({ canvas }) => {
    for (const name of ["Default", "Secondary", "Outline", "Ghost", "Destructive", "Link"]) {
      await expect(canvas.getByRole("button", { name })).toBeEnabled()
    }
  },
}

export const Sizes: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <Button size="xs">Extra small</Button>
      <Button size="sm">Small</Button>
      <Button>Default</Button>
      <Button size="lg">Large</Button>
      <Button aria-label="Launch fleet" size="icon">
        <RocketIcon />
      </Button>
    </div>
  ),
  play: async ({ canvas }) => {
    for (const name of ["Extra small", "Small", "Default", "Large"]) {
      await expect(canvas.getByRole("button", { name })).toBeEnabled()
    }
    await expect(canvas.getByRole("button", { name: "Launch fleet" })).toBeEnabled()
  },
}

export const Disabled: Story = {
  args: {
    disabled: true,
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("button", { name: "Launch fleet" })).toBeDisabled()
  },
}
