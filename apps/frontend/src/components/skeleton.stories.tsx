import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect } from "storybook/test"
import { Skeleton } from "./skeleton.tsx"

const meta = {
  title: "Design System/Skeleton",
  component: Skeleton,
  args: {
    className: "h-8 w-64",
  },
} satisfies Meta<typeof Skeleton>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const skeletons = [...canvasElement.querySelectorAll<HTMLElement>('[data-slot="skeleton"]')]
    await expect(skeletons).toHaveLength(1)
    for (const skeleton of skeletons) {
      await expect(skeleton).toBeVisible()
      const { height, width } = skeleton.getBoundingClientRect()
      await expect(width).toBeGreaterThan(0)
      await expect(height).toBeGreaterThan(0)
    }
  },
}

export const CardPlaceholder: Story = {
  render: () => (
    <div className="grid w-96 gap-4 rounded-4xl bg-card p-6">
      <div className="flex items-center gap-3">
        <Skeleton className="size-10 rounded-full" />
        <div className="grid flex-1 gap-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
      <Skeleton className="h-24 w-full" />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const skeletons = [...canvasElement.querySelectorAll<HTMLElement>('[data-slot="skeleton"]')]
    await expect(skeletons).toHaveLength(4)
    for (const skeleton of skeletons) {
      await expect(skeleton).toBeVisible()
      const { height, width } = skeleton.getBoundingClientRect()
      await expect(width).toBeGreaterThan(0)
      await expect(height).toBeGreaterThan(0)
    }
  },
}
