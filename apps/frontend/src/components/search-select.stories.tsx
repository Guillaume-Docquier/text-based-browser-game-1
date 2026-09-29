import type { Meta, StoryObj } from "@storybook/react-vite"
import { useState } from "react"
import { SearchSelect } from "@/components/search-select.tsx"

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
    onValueChange: (): void => {},
  },
} satisfies Meta<typeof SearchSelect>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => <SearchSelectExample label="Fleet target" options={SMALL_OPTIONS} placeholder="Choose fleet" />,
}

export const LargeList: Story = {
  render: () => <SearchSelectExample label="Planet target" options={LARGE_OPTIONS} placeholder="Choose planet" />,
}

export const Disabled: Story = {
  render: () => (
    <div className="w-64">
      <SearchSelect
        label="Fleet target"
        options={SMALL_OPTIONS}
        value={undefined}
        placeholder="Choose fleet"
        disabled
        onValueChange={(): void => {}}
      />
    </div>
  ),
}

function SearchSelectExample({
  label,
  options,
  placeholder,
}: {
  label: string
  options: ReadonlyArray<{ id: string; label: string }>
  placeholder: string
}): React.JSX.Element {
  const [value, setValue] = useState<string | undefined>()
  return (
    <div className="w-80">
      <SearchSelect label={label} options={options} value={value} placeholder={placeholder} onValueChange={setValue} />
    </div>
  )
}
