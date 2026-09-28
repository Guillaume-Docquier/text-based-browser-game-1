import type { Meta, StoryObj } from "@storybook/react-vite"
import { Badge } from "@/components/badge"
import { Button } from "@/components/button"
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/card"

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
}
