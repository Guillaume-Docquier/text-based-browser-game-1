import type { Meta, StoryObj } from "@storybook/react-vite"
import * as React from "react"
import { expect } from "storybook/test"
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

export const Default: Story = {
  play: async ({ canvas }) => {
    const minimum = canvas.getByRole("slider", { name: "Minimum" })
    const maximum = canvas.getByRole("slider", { name: "Maximum" })

    await expect(minimum).toHaveAttribute("aria-valuenow", "25")
    await expect(maximum).toHaveAttribute("aria-valuenow", "75")
  },
}

export const Interactive: Story = {
  render: () => <RangeSliderExample />,
  play: async ({ canvas, userEvent }) => {
    const minimum = canvas.getByRole("slider", { name: "Minimum" })
    const maximum = canvas.getByRole("slider", { name: "Maximum" })

    await userEvent.click(minimum)
    await userEvent.keyboard("{ArrowRight}")
    await expect(canvas.getByText("26")).toBeVisible()

    await userEvent.click(maximum)
    await userEvent.keyboard("{ArrowLeft}")
    await expect(canvas.getByText("74")).toBeVisible()

    await userEvent.click(minimum)
    for (let index = 0; index < 30; index += 1) {
      await userEvent.keyboard("{ArrowLeft}")
    }
    await expect(minimum).toHaveAttribute("aria-valuenow", "0")
    await expect(canvas.getByText("0")).toBeVisible()

    await userEvent.click(maximum)
    for (let index = 0; index < 30; index += 1) {
      await userEvent.keyboard("{ArrowRight}")
    }
    await expect(maximum).toHaveAttribute("aria-valuenow", "100")
    await expect(canvas.getByText("100")).toBeVisible()
  },
}

export const Disabled: Story = {
  args: {
    disabled: true,
  },
  play: async ({ canvas, userEvent }) => {
    const minimum = canvas.getByRole("slider", { name: "Minimum" })
    const maximum = canvas.getByRole("slider", { name: "Maximum" })

    await expect(minimum).toHaveAttribute("data-disabled", "")
    await expect(maximum).toHaveAttribute("data-disabled", "")
    await userEvent.tab()
    await expect(minimum).not.toHaveFocus()
    await expect(minimum).toHaveAttribute("aria-valuenow", "25")
  },
}
