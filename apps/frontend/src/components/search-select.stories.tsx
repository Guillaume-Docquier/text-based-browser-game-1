import type { Meta, StoryObj } from "@storybook/react-vite"
import { useState } from "react"
import { expect, within } from "storybook/test"
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
    onValueChange: (): void => {},
  },
} satisfies Meta<typeof SearchSelect>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => <SearchSelectExample label="Fleet target" options={SMALL_OPTIONS} placeholder="Choose fleet" />,
  play: async ({ canvas, canvasElement, userEvent }) => {
    const combobox = canvas.getByRole("combobox", { name: "Fleet target" })
    const body = within(canvasElement.ownerDocument.body)

    await expect(combobox).toHaveValue("")
    await userEvent.click(combobox)
    await expect(body.getByRole("option", { name: "Home Guard" })).toBeVisible()

    await userEvent.type(combobox, "eXpEdItIoNaRy")
    await expect(body.getByRole("option", { name: "Expeditionary Fleet" })).toBeVisible()
    await expect(body.queryByRole("option", { name: "Home Guard" })).not.toBeInTheDocument()
    await userEvent.click(body.getByRole("option", { name: "Expeditionary Fleet" }))
    await expect(combobox).toHaveValue("Expeditionary Fleet")
    await expect(body.queryByRole("listbox")).not.toBeInTheDocument()

    await userEvent.click(combobox)
    await userEvent.clear(combobox)
    await userEvent.type(combobox, "unknown")
    await expect(body.getByText("No matching options")).toBeVisible()

    await userEvent.clear(combobox)
    await userEvent.keyboard("{ArrowUp}{Enter}")
    await expect(combobox).toHaveValue("Home Guard")

    await userEvent.click(combobox)
    await userEvent.keyboard("{ArrowDown}{ArrowDown}{ArrowDown}{Enter}")
    await expect(combobox).toHaveValue("Reserve Fleet")
  },
}

/**
 * Dismissing an unfinished search preserves the previously selected fleet.
 */
export const EscapePreservesSelection: Story = {
  render: () => <SearchSelectExample label="Fleet target" options={SMALL_OPTIONS} placeholder="Choose fleet" />,
  play: async ({ canvas, canvasElement, userEvent }) => {
    const combobox = canvas.getByRole("combobox", { name: "Fleet target" })
    const body = within(canvasElement.ownerDocument.body)

    await userEvent.click(combobox)
    await userEvent.click(body.getByRole("option", { name: "Expeditionary Fleet" }))
    await expect(combobox).toHaveValue("Expeditionary Fleet")

    await userEvent.click(combobox)
    await userEvent.type(combobox, "reserve")
    await expect(body.getByRole("option", { name: "Reserve Fleet" })).toBeVisible()
    await userEvent.keyboard("{Escape}")

    await expect(combobox).toHaveValue("Expeditionary Fleet")
    await expect(body.queryByRole("listbox")).not.toBeInTheDocument()
  },
}

export const LargeList: Story = {
  render: () => <SearchSelectExample label="Planet target" options={LARGE_OPTIONS} placeholder="Choose planet" />,
  play: async ({ canvas, canvasElement, userEvent }) => {
    const combobox = canvas.getByRole("combobox", { name: "Planet target" })
    const body = within(canvasElement.ownerDocument.body)

    await userEvent.click(combobox)
    await expect(body.getAllByRole("option")).toHaveLength(50)
    await expect(body.getByRole("option", { name: "Planet 0001" })).toBeVisible()
    await expect(body.getByRole("option", { name: "Planet 0050" })).toBeVisible()
    await expect(body.getByText("Showing first 50 of 3000. Keep typing to narrow the list.")).toBeVisible()

    await userEvent.type(combobox, "planet 2999")
    await expect(body.getAllByRole("option")).toHaveLength(1)
    await expect(body.getByRole("option", { name: "Planet 2999" })).toBeVisible()
    await userEvent.click(body.getByRole("option", { name: "Planet 2999" }))
    await expect(combobox).toHaveValue("Planet 2999")
    await expect(body.queryByRole("listbox")).not.toBeInTheDocument()
  },
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
  play: async ({ canvas, canvasElement, userEvent }) => {
    const combobox = canvas.getByRole("combobox", { name: "Fleet target" })
    const body = within(canvasElement.ownerDocument.body)

    await expect(combobox).toBeDisabled()
    await userEvent.click(combobox)
    await expect(combobox).toHaveValue("")
    await expect(body.queryByRole("listbox")).not.toBeInTheDocument()
  },
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
