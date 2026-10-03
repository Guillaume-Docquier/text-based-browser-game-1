import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect } from "storybook/test"
import { Badge } from "./badge.tsx"
import { Button } from "./button.tsx"
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "./card.tsx"

const meta = {
  title: "Design System/Card",
  component: Card,
  args: {
    className: "w-96",
  },
} satisfies Meta<typeof Card>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: (args) => (
    <Card {...args}>
      <CardHeader>
        <CardTitle>Kepler-186</CardTitle>
        <CardDescription>Terran colony · Population 2.4B</CardDescription>
        <CardAction>
          <Badge variant="secondary">Stable</Badge>
        </CardAction>
      </CardHeader>
      <CardContent>
        <p>Mineral production is operating at 84% capacity.</p>
      </CardContent>
      <CardFooter className="border-t">
        <Button size="sm">Open colony</Button>
      </CardFooter>
    </Card>
  ),
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Kepler-186")).toBeVisible()
    await expect(canvas.getByText("Terran colony · Population 2.4B")).toBeVisible()
    await expect(canvas.getByText("Stable")).toBeVisible()
    await expect(canvas.getByText("Mineral production is operating at 84% capacity.")).toBeVisible()
    await expect(canvas.getByRole("button", { name: "Open colony" })).toBeEnabled()
  },
}

export const Small: Story = {
  args: {
    size: "sm",
  },
  render: (args) => (
    <Card {...args}>
      <CardHeader>
        <CardTitle>Scout report</CardTitle>
        <CardDescription>No hostile fleets detected.</CardDescription>
      </CardHeader>
    </Card>
  ),
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Scout report")).toBeVisible()
    await expect(canvas.getByText("No hostile fleets detected.")).toBeVisible()
  },
}
