import type { Meta, StoryObj } from "@storybook/react-vite"
import { AlertTriangleIcon, InfoIcon } from "lucide-react"
import { expect } from "storybook/test"
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
      <AlertTitle>Fleet action received</AlertTitle>
      <AlertDescription>Your ships will move when the next turn is processed.</AlertDescription>
    </Alert>
  ),
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("alert")).toBeVisible()
    await expect(canvas.getByText("Fleet action received")).toBeVisible()
    await expect(canvas.getByText("Your ships will move when the next turn is processed.")).toBeVisible()
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
      <AlertAction>
        <Button size="xs" variant="outline">
          Dismiss
        </Button>
      </AlertAction>
    </Alert>
  ),
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("alert")).toBeVisible()
    await expect(canvas.getByText("Insufficient resources")).toBeVisible()
    await expect(canvas.getByText("This action costs more minerals than the colony has available.")).toBeVisible()
    await expect(canvas.getByRole("button", { name: "Dismiss" })).toBeEnabled()
  },
}
