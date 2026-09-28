import type { Meta, StoryObj } from "@storybook/react-vite"
import * as React from "react"
import { RangeSlider } from "@/components/RangeSlider"

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

function RangeSliderExample(): React.JSX.Element {
  const [value, setValue] = React.useState<[number, number]>([25, 75])

  function updateValue(nextValue: number[]): void {
    const [minimum, maximum] = nextValue
    if (minimum === undefined || maximum === undefined) {
      return
    }

    setValue([minimum, maximum])
  }

  return (
    <div className="grid w-96 gap-4">
      <RangeSlider max={100} min={0} onValueChange={updateValue} thumbLabels={["Minimum", "Maximum"]} value={value} />
      <div className="flex justify-between text-sm text-muted-foreground">
        <span>{value[0]}</span>
        <span>{value[1]}</span>
      </div>
    </div>
  )
}

export const Default: Story = {}

export const Interactive: Story = {
  render: () => <RangeSliderExample />,
}

export const Disabled: Story = {
  args: {
    disabled: true,
  },
}
