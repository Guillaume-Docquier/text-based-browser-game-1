import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect } from "storybook/test"
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

export const Default: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Fleet name")).toBeVisible()
  },
}

export const WithControl: Story = {
  render: () => (
    <div className="grid w-80 gap-2">
      <Label htmlFor="fleet-name">Fleet name</Label>
      <Input id="fleet-name" placeholder="First Expeditionary Fleet" />
    </div>
  ),
  play: async ({ canvas, userEvent }) => {
    const input = canvas.getByLabelText("Fleet name")
    const label = canvas.getByText("Fleet name")
    await expect(label).toBeVisible()
    await userEvent.click(label)
    await expect(input).toHaveFocus()
    await userEvent.type(input, "First Expeditionary Fleet")
    await expect(input).toHaveValue("First Expeditionary Fleet")
  },
}
