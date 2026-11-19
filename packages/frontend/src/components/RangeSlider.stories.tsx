import type { Meta, StoryObj } from "@storybook/react-vite"
import * as React from "react"
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

function RangeSliderExample(args: React.ComponentProps<typeof RangeSlider>): React.JSX.Element {
  const [value, setValue] = React.useState(args.value)

  function updateValue(nextValue: number[]): void {
    const [minimum, maximum] = nextValue
    if (minimum === undefined || maximum === undefined) {
      return
    }

    setValue([minimum, maximum])
  }

  return (
    <div className="grid w-96 gap-4">
      <RangeSlider {...args} onValueChange={updateValue} value={value} />
      <div className="flex justify-between text-sm text-muted-foreground">
        <span>{value[0]}</span>
        <span>{value[1]}</span>
      </div>
    </div>
  )
}

export const Interactive: Story = {
  render: (args) => <RangeSliderExample {...args} />,
}

export const Disabled: Story = {
  args: {
    disabled: true,
  },
}
