import type { Meta, StoryObj } from "@storybook/react-vite"
import type { ReactElement } from "react"
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "./select.tsx"

const FLEETS = [
  { value: "expeditionary", label: "Expeditionary Fleet" },
  { value: "home-guard", label: "Home Guard" },
  { value: "reserve", label: "Reserve Fleet" },
]

const meta = {
  title: "Design System/Select",
  component: Select,
  args: { items: FLEETS },
  render: (args): ReactElement => (
    <Select {...args}>
      <SelectTrigger aria-label="Fleet" className="w-64">
        <SelectValue placeholder="Choose a fleet" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>Available fleets</SelectLabel>
          {FLEETS.map((fleet) => (
            <SelectItem key={fleet.value} value={fleet.value}>
              {fleet.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  ),
} satisfies Meta<typeof Select>

export default meta
type Story = StoryObj<typeof meta>

export const Interactive: Story = {}

export const InitialSelection: Story = {
  args: { defaultValue: "home-guard" },
}

export const OpenMenu: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("combobox", { name: "Fleet" }))
  },
}

export const Disabled: Story = {
  args: { disabled: true },
}
