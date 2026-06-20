import type { Meta, StoryObj } from "@storybook/react-vite"
import { RocketIcon } from "lucide-react"
import { Button } from "./button"

const meta = {
  title: "Design System/Button",
  component: Button,
  args: {
    children: "Launch fleet",
  },
} satisfies Meta<typeof Button>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

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
}

export const Disabled: Story = {
  args: {
    disabled: true,
  },
}
