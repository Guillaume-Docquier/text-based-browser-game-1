import type { Meta, StoryObj } from "@storybook/react-vite"
import { quoteTravel } from "shared/domain/world/ships/travel.ts"
import { RouteFacts, UnderwayDetails } from "./TravelDetails.tsx"

const route = quoteTravel(
  { kind: "planet", id: "haven", name: "Haven", coordinates: "40:25:10", x: 1, y: 2 },
  { kind: "star", id: "rigel", name: "Rigel", coordinates: "61:30", x: 10, y: 2 },
  { thrust: 64, emptyMass: 4 },
  [],
)
const meta = { title: "Application/Ship travel", component: RouteFacts, args: { route } } satisfies Meta<typeof RouteFacts>
export default meta
type Story = StoryObj<typeof meta>
export const Interactive: Story = {}
export const Underway: Story = { render: ({ route }) => <UnderwayDetails trip={{ route, completedTurns: 1 }} /> }
