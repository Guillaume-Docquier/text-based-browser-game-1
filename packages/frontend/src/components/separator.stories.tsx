import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect } from "storybook/test"
import { Separator } from "./separator.tsx"

const meta = {
  title: "Design System/Separator",
  component: Separator,
} satisfies Meta<typeof Separator>

export default meta
type Story = StoryObj<typeof meta>

export const Horizontal: Story = {
  render: () => (
    <div className="w-96 space-y-4">
      <p>Economic overview</p>
      <Separator decorative={false} />
      <p className="text-sm text-muted-foreground">Production and storage across the empire.</p>
    </div>
  ),
  play: async ({ canvas }) => {
    const separator = canvas.getByRole("separator")
    await expect(canvas.getByText("Economic overview")).toBeVisible()
    await expect(canvas.getByText("Production and storage across the empire.")).toBeVisible()
    await expect(separator).toBeVisible()
    await expect(separator).toHaveAttribute("data-orientation", "horizontal")
  },
}

export const Vertical: Story = {
  args: {
    orientation: "vertical",
  },
  render: (args) => (
    <div className="flex h-6 items-center gap-4">
      <span>Minerals</span>
      <Separator {...args} decorative={false} />
      <span>Energy</span>
      <Separator {...args} decorative={false} />
      <span>Food</span>
    </div>
  ),
  play: async ({ canvas }) => {
    const separators = canvas.getAllByRole("separator")
    await expect(separators).toHaveLength(2)
    for (const name of ["Minerals", "Energy", "Food"]) {
      await expect(canvas.getByText(name, { exact: true })).toBeVisible()
    }
    for (const separator of separators) {
      await expect(separator).toBeVisible()
      await expect(separator).toHaveAttribute("aria-orientation", "vertical")
      await expect(separator).toHaveAttribute("data-orientation", "vertical")
    }
  },
}
