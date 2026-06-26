import type { Meta, StoryObj } from "@storybook/react-vite"
import { AlertTriangleIcon, InfoIcon } from "lucide-react"
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/alert"
import { Button } from "@/components/button"

const meta = {
  title: "Design System/Alert",
  component: Alert,
  args: {
    className: "w-120",
  },
} satisfies Meta<typeof Alert>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: (args) => (
    <Alert {...args}>
      <InfoIcon />
      <AlertTitle>Fleet orders received</AlertTitle>
      <AlertDescription>Your ships will move when the next tick is processed.</AlertDescription>
    </Alert>
  ),
}

export const Destructive: Story = {
  args: {
    variant: "destructive",
  },
  render: (args) => (
    <Alert {...args}>
      <AlertTriangleIcon />
      <AlertTitle>Insufficient resources</AlertTitle>
      <AlertDescription>This order costs more minerals than the colony has available.</AlertDescription>
      <AlertAction>
        <Button size="xs" variant="outline">
          Dismiss
        </Button>
      </AlertAction>
    </Alert>
  ),
}
