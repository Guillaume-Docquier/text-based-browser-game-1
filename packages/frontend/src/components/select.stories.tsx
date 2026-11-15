import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, waitFor, within } from "storybook/test"
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

export const Default: Story = {
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
  play: async ({ canvas, canvasElement, userEvent }) => {
    const trigger = canvas.getByRole("combobox")
    const body = within(canvasElement.ownerDocument.body)

    await expect(trigger).toHaveTextContent("Choose a fleet")
    await userEvent.click(trigger)
    await expect(await body.findByRole("option", { name: "Expeditionary Fleet" })).toBeVisible()
    await userEvent.keyboard("{ArrowDown}{ArrowDown}{Enter}")
    await expect(trigger).toHaveTextContent("Home Guard")
    await waitFor(async () => {
      await expect(body.queryByRole("listbox")).not.toBeInTheDocument()
    })

    await userEvent.click(trigger)
    await userEvent.click(await body.findByRole("option", { name: "Reserve Fleet" }))
    await expect(trigger).toHaveTextContent("Reserve Fleet")
  },
}

/**
 * The selected label must render before the popup has ever mounted.
 */
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
  play: async ({ canvas, canvasElement, userEvent }) => {
    const trigger = canvas.getByRole("combobox", { name: "Fleet" })
    const body = within(canvasElement.ownerDocument.body)
    await expect(trigger).toHaveTextContent("Home Guard")
    await userEvent.tab()
    await userEvent.keyboard("{Enter}")
    await expect(await body.findByRole("option", { name: "Home Guard" })).toHaveAttribute("aria-selected", "true")
    await userEvent.keyboard("{Escape}")
    await waitFor(async () => {
      await expect(body.queryByRole("listbox")).not.toBeInTheDocument()
    })
    await expect(trigger).toHaveFocus()
    await expect(trigger).toHaveTextContent("Home Guard")
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
