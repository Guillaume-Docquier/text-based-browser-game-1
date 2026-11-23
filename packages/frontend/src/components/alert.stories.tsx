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

export const Interactive: Story = {
  render: function Render(args) {
    const [visible, setVisible] = useState(true)
    if (!visible) {
      return (
        <Button
          onClick={() => {
            setVisible(true)
          }}
        >
          Show alert
        </Button>
      )
    }
    return (
      <Alert {...args}>
        <InfoIcon />
        <AlertTitle>Fleet action received</AlertTitle>
        <AlertDescription>Your ships will move when the next turn is processed.</AlertDescription>
        <AlertAction>
          <Button
            size="xs"
            variant="outline"
            onClick={() => {
              setVisible(false)
            }}
          >
            Dismiss
          </Button>
        </AlertAction>
      </Alert>
    )
  },
}

export const Destructive: Story = {
  args: {
    variant: "destructive",
  },
  render: (args) => (
    <Alert {...args}>
      <AlertTriangleIcon />
      <AlertTitle>Insufficient resources</AlertTitle>
      <AlertDescription>This action costs more minerals than the colony has available.</AlertDescription>
    </Alert>
  ),
}
