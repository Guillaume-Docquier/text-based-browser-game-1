import type { Meta, StoryObj } from "@storybook/react-vite"
import type { ReactElement } from "react"
import { createFleetStub } from "shared/domain/world/fleets/Fleet.stub.ts"
import { expect } from "storybook/test"
import { createPlayerStub } from "@/lib/api/Player.stub.ts"
import { StationedFleetMarkers } from "./StationedFleetMarkers.tsx"

const alice = createPlayerStub({ alias: "Alice" })
const bob = createPlayerStub({ id: "00000000-0000-4000-8000-000000000002", alias: "Bob", color: "PINK" })
const survivor = createFleetStub({
  id: "fleet-assault-survivor",
  name: "Aegis",
  ownerPlayerId: alice.id,
  originPlanetId: "planet-target",
  strength: 10,
})

const meta = {
  title: "Application/Stationed Fleet Markers",
  component: StationedFleetMarkers,
  args: { x: 160, y: 24, fleets: [survivor], players: [alice, bob] },
  render: (args): ReactElement => (
    <svg role="group" aria-label="Planet fleets" width={320} height={90} viewBox="0 0 320 90">
      <StationedFleetMarkers {...args} />
    </svg>
  ),
} satisfies Meta<typeof StationedFleetMarkers>

export default meta
type Story = StoryObj<typeof meta>

/**
 * After combat, the map marker displays the surviving strength and the destroyed defender has no marker.
 */
export const AfterAssault: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("img", { name: "Aegis, Alice, 10 strength" })).toBeVisible()
    await expect(canvas.queryByRole("img", { name: /Defender/ })).not.toBeInTheDocument()
  },
}
