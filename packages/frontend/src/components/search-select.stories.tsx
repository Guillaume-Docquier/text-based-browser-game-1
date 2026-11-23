import { noop } from "@guillaume-docquier/tools-ts"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { type ReactElement, useState } from "react"
import { SearchSelect } from "./search-select.tsx"

const SMALL_OPTIONS = [
  { id: "home-guard", label: "Home Guard" },
  { id: "expeditionary", label: "Expeditionary Fleet" },
  { id: "reserve", label: "Reserve Fleet" },
]

const LARGE_OPTIONS = Array.from({ length: 3000 }, (_, index) => ({
  id: `planet-${index + 1}`,
  label: `Planet ${String(index + 1).padStart(4, "0")}`,
}))

const meta = {
  title: "Design System/Search Select",
  component: SearchSelect,
  args: {
    label: "Fleet target",
    options: SMALL_OPTIONS,
    value: undefined,
    placeholder: "Choose fleet",
    onValueChange: noop,
  },
  render: function Render(args): ReactElement {
    const [value, setValue] = useState(args.value)
    return (
      <div className="w-80">
        <SearchSelect {...args} value={value} onValueChange={setValue} />
      </div>
    )
  },
} satisfies Meta<typeof SearchSelect>

export default meta
type Story = StoryObj<typeof meta>

export const Interactive: Story = {}

export const LargeList: Story = {
  args: { label: "Planet target", options: LARGE_OPTIONS, placeholder: "Choose planet" },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("combobox", { name: "Planet target" }))
  },
}

export const Disabled: Story = {
  args: { disabled: true },
}
