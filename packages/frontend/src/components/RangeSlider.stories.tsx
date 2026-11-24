import type { Meta, StoryObj } from "@storybook/react-vite"
import { useState } from "react"
import { RangeSlider } from "./RangeSlider.tsx"

const meta = {
  title: "Design System/RangeSlider",
  component: RangeSlider,
  args: {
    className: "w-96",
    max: 100,
    min: 0,
    step: 1,
    thumbLabels: ["Minimum", "Maximum"],
    value: [25, 75],
  },
} satisfies Meta<typeof RangeSlider>

export default meta
type Story = StoryObj<typeof meta>

export const Interactive: Story = {
  render: function Render(args) {
    const [value, setValue] = useState(args.value)
    return (
      <div className="grid gap-4">
        <RangeSlider {...args} value={value} onValueChange={setValue} />
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>{value[0]}</span>
          <span>{value[1]}</span>
        </div>
      </div>
    )
  },
}

export const Disabled: Story = {
  args: { disabled: true },
}
