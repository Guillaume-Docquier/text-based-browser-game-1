import type { Meta, StoryObj } from "@storybook/react-vite"
import { Input } from "./input"
import { Label } from "./label"

const meta = {
  title: "Design System/Label",
  component: Label,
  args: {
    children: "Fleet name",
  },
} satisfies Meta<typeof Label>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const WithControl: Story = {
  render: () => (
    <div className="grid w-80 gap-2">
      <Label htmlFor="fleet-name">Fleet name</Label>
      <Input id="fleet-name" placeholder="First Expeditionary Fleet" />
    </div>
  ),
}
