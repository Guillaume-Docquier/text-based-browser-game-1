import type { Meta, StoryObj } from "@storybook/react-vite"
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from "./select"

const meta = {
  title: "Design System/Select",
  component: Select,
} satisfies Meta<typeof Select>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => (
    <Select>
      <SelectTrigger className="w-64">
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

export const Disabled: Story = {
  render: () => (
    <Select disabled>
      <SelectTrigger className="w-64">
        <SelectValue placeholder="No fleets available" />
      </SelectTrigger>
    </Select>
  ),
}
