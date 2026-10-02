import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect } from "storybook/test"
import { Badge } from "@/components/badge"

const meta = {
  title: "Design System/Badge",
  component: Badge,
  args: {
    children: "Active",
  },
} satisfies Meta<typeof Badge>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Active")).toBeVisible()
  },
}

export const Variants: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <Badge>Default</Badge>
      <Badge variant="secondary">Secondary</Badge>
      <Badge variant="destructive">Destructive</Badge>
      <Badge variant="outline">Outline</Badge>
      <Badge variant="ghost">Ghost</Badge>
      <Badge variant="link">Link</Badge>
    </div>
  ),
  play: async ({ canvas }) => {
    for (const name of ["Default", "Secondary", "Destructive", "Outline", "Ghost", "Link"]) {
      await expect(canvas.getByText(name, { exact: true })).toBeVisible()
    }
  },
}
