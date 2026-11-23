import type { Meta, StoryObj } from "@storybook/react-vite"
import type { ReactElement } from "react"
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from "./select.tsx"

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
          <SelectItem value="expeditionary">Expeditionary Fleet</SelectItem>
          <SelectItem value="home-guard">Home Guard</SelectItem>
          <SelectSeparator />
          <SelectItem value="reserve">Reserve Fleet</SelectItem>
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

export const Disabled: Story = {
  args: { disabled: true },
}
