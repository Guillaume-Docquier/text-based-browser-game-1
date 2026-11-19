import type { Meta, StoryObj } from "@storybook/react-vite"
import { Input } from "./input.tsx"
import { Label } from "./label.tsx"

const meta = {
  title: "Design System/Label",
  component: Label,
  args: {
    children: "Fleet name",
  },
} satisfies Meta<typeof Label>

export default meta
type Story = StoryObj<typeof meta>

export const Interactive: Story = {
  render: (args) => (
    <div className="grid w-80 gap-2">
      <Label {...args} htmlFor="fleet-name" />
      <Input id="fleet-name" placeholder="First Expeditionary Fleet" />
    </div>
  ),
}
