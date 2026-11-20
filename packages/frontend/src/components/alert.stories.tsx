import type { Meta, StoryObj } from "@storybook/react-vite"
import { AlertTriangleIcon, InfoIcon } from "lucide-react"
import { useState } from "react"
import { Alert, AlertAction, AlertDescription, AlertTitle } from "./alert.tsx"
import { Button } from "./button.tsx"

const meta = {
  title: "Design System/Alert",
  component: Alert,
  args: {
    className: "w-120",
  },
} satisfies Meta<typeof Alert>

export default meta
type Story = StoryObj<typeof meta>

export const Information: Story = {
  render: (args) => (
    <Alert {...args}>
      <InfoIcon />
      <AlertTitle>Fleet action received</AlertTitle>
      <AlertDescription>Your ships will move when the next turn is processed.</AlertDescription>
    </Alert>
  ),
}

export const DismissibleError: Story = {
  args: {
    variant: "destructive",
  },
  render: function Render(args) {
    const [dismissed, setDismissed] = useState(false)

    if (dismissed) {
      return <p role="status">Alert dismissed</p>
    }

    return (
      <Alert {...args}>
        <AlertTriangleIcon />
        <AlertTitle>Insufficient resources</AlertTitle>
        <AlertDescription>This action costs more minerals than the colony has available.</AlertDescription>
        <AlertAction>
          <Button
            size="xs"
            variant="outline"
            onClick={() => {
              setDismissed(true)
            }}
          >
            Dismiss
          </Button>
        </AlertAction>
      </Alert>
    )
  },
}
