import type { Meta, StoryObj } from "@storybook/react-vite"
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from "./select.tsx"

const FLEETS = [
  { value: "expeditionary", label: "Expeditionary Fleet" },
  { value: "home-guard", label: "Home Guard" },
  { value: "reserve", label: "Reserve Fleet" },
]

const meta = {
  title: "Design System/Select",
  component: Select,
} satisfies Meta<typeof Select>

export default meta
type Story = StoryObj<typeof meta>

export const Interactive: Story = {
  render: () => (
    <Select items={FLEETS}>
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
}

export const InitialSelection: Story = {
  render: () => (
    <Select items={FLEETS} defaultValue="home-guard">
      <SelectTrigger aria-label="Fleet" className="w-64">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {FLEETS.map((fleet) => (
          <SelectItem key={fleet.value} value={fleet.value}>
            {fleet.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  ),
}

export const Disabled: Story = {
  render: () => (
    <Select disabled>
      <SelectTrigger className="w-64">
        <SelectValue placeholder="No fleets available" />
      </SelectTrigger>
    </Select>
  ),
}
