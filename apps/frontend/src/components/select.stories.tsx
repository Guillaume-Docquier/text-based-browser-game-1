import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, within } from "storybook/test"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/select"

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
  play: async ({ canvas, canvasElement, userEvent }) => {
    const trigger = canvas.getByRole("combobox")
    const body = within(canvasElement.ownerDocument.body)

    await expect(trigger).toHaveTextContent("Choose a fleet")
    await userEvent.click(trigger)
    await expect(body.getByRole("option", { name: "Expeditionary Fleet" })).toBeVisible()
    await userEvent.keyboard("{ArrowDown}{Enter}")
    await expect(trigger).toHaveTextContent("Home Guard")

    await userEvent.click(trigger)
    await userEvent.click(body.getByRole("option", { name: "Reserve Fleet" }))
    await expect(trigger).toHaveTextContent("Reserve Fleet")
  },
}

export const Disabled: Story = {
  render: () => (
    <Select disabled>
      <SelectTrigger className="w-64">
        <SelectValue placeholder="No fleets available" />
      </SelectTrigger>
    </Select>
  ),
  play: async ({ canvas, userEvent }) => {
    const trigger = canvas.getByRole("combobox")

    await expect(trigger).toBeDisabled()
    await userEvent.click(trigger)
    await expect(canvas.queryByRole("option")).not.toBeInTheDocument()
  },
}
