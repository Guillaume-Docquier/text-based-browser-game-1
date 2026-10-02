import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect } from "storybook/test"
import { Input } from "@/components/input"
import { Label } from "@/components/label"

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

export const Default: Story = {
  play: async ({ canvas, userEvent }) => {
    const input = canvas.getByPlaceholderText("Colony name")
    await userEvent.type(input, "Kepler-186")
    await expect(input).toHaveValue("Kepler-186")
  },
}

export const WithLabel: Story = {
  render: (args) => (
    <div className="grid w-80 gap-2">
      <Label htmlFor="colony-name">Colony name</Label>
      <Input {...args} className={undefined} id="colony-name" />
    </div>
  ),
  play: async ({ canvas, userEvent }) => {
    const input = canvas.getByLabelText("Colony name")
    await expect(input).toBeVisible()
    await userEvent.type(input, "Kepler-186")
    await expect(input).toHaveValue("Kepler-186")
  },
}

export const Invalid: Story = {
  args: {
    "aria-invalid": true,
    defaultValue: "Already claimed",
  },
  play: async ({ canvas }) => {
    const input = canvas.getByPlaceholderText("Colony name")
    await expect(input).toHaveValue("Already claimed")
    await expect(input).toHaveAttribute("aria-invalid", "true")
  },
}

export const Disabled: Story = {
  args: {
    disabled: true,
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByPlaceholderText("Colony name")).toBeDisabled()
  },
}
