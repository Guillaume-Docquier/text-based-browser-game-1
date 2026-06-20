import type { Meta, StoryObj } from "@storybook/react-vite"
import { Input } from "./input"
import { Label } from "./label"

const meta = {
  title: "Design System/Input",
  component: Input,
  args: {
    className: "w-80",
    placeholder: "Colony name",
  },
} satisfies Meta<typeof Input>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const WithLabel: Story = {
  render: (args) => (
    <div className="grid w-80 gap-2">
      <Label htmlFor="colony-name">Colony name</Label>
      <Input {...args} className={undefined} id="colony-name" />
    </div>
  ),
}

export const Invalid: Story = {
  args: {
    "aria-invalid": true,
    defaultValue: "Already claimed",
  },
}

export const Disabled: Story = {
  args: {
    disabled: true,
  },
}
