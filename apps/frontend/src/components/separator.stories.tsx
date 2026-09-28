import type { Meta, StoryObj } from "@storybook/react-vite"
import { Separator } from "@/components/separator"

const meta = {
  title: "Design System/Separator",
  component: Separator,
} satisfies Meta<typeof Separator>

export default meta
type Story = StoryObj<typeof meta>

export const Horizontal: Story = {
  render: () => (
    <div className="w-96 space-y-4">
      <p>Economic overview</p>
      <Separator />
      <p className="text-sm text-muted-foreground">Production and storage across the empire.</p>
    </div>
  ),
}

export const Vertical: Story = {
  args: {
    orientation: "vertical",
  },
  render: (args) => (
    <div className="flex h-6 items-center gap-4">
      <span>Minerals</span>
      <Separator {...args} />
      <span>Energy</span>
      <Separator {...args} />
      <span>Food</span>
    </div>
  ),
}
