import { Distance, noop, UnitOfDistance } from "@guillaume-docquier/tools-ts"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { useState } from "react"
import { createFleetStub } from "shared/domain/world/fleets/Fleet.stub.ts"
import { createPlanetStub } from "shared/domain/world/planets/Planet.stub.ts"
import { createStarStub } from "shared/domain/world/stars/Star.stub.ts"
import { createStarSystemStub } from "shared/domain/world/StarSystem.stub.ts"
import { StarSystemSchema } from "shared/domain/world/StarSystem.ts"
import { Button } from "@/components/button.tsx"
import { createPlayerStub } from "@/lib/api/Player.stub.ts"
import { StarSystemMap } from "./StarSystemMap.tsx"

const player = createPlayerStub()
const orbit = Distance.in(Distance.create(5, UnitOfDistance.ASTRONOMICAL_UNITS), UnitOfDistance.LIGHT_YEARS)
const system = StarSystemSchema.parse(
  createStarSystemStub({
    star: createStarStub({ id: "00000000-0000-4000-8000-000000000001", name: "Sol" }),
    planets: [
      createPlanetStub({ id: "00000000-0000-4000-8000-000000000002", name: "Terra", x: orbit, y: 0 }),
      createPlanetStub({ id: "00000000-0000-4000-8000-000000000003", name: "Mars", biome: "VOLCANIC", x: -orbit * 2, y: 0 }),
    ],
  }),
)

const meta = {
  title: "Application/Star System Map",
  component: StarSystemMap,
  args: {
    system,
    systems: [system],
    fleets: [
      createFleetStub({
        id: "home-guard",
        name: "Home Guard",
        ownerPlayerId: player.id,
        originPlanetId: "00000000-0000-4000-8000-000000000002",
        strength: 10,
      }),
    ],
    players: [player],
    resetSignal: 0,
    onSelectGalaxy: noop,
    onSelectPlanet: noop,
  },
} satisfies Meta<typeof StarSystemMap>

export default meta
type Story = StoryObj<typeof meta>

/**
 * Exposes completed selection without unmounting the departing map. Native tests
 * can control its real transition and inspect geometry before and after completion.
 */
export const Interactive: Story = {
  render: function Render(args) {
    const [resetSignal, setResetSignal] = useState(args.resetSignal)
    const [selection, setSelection] = useState("Sol")
    return (
      <div>
        <Button
          onClick={() => {
            setResetSignal((value) => value + 1)
          }}
        >
          Reset view
        </Button>
        <output aria-label="Selection" className="ml-4">
          {selection}
        </output>
        <div style={{ width: 600, height: 600 }}>
          <StarSystemMap
            {...args}
            resetSignal={resetSignal}
            onSelectGalaxy={() => {
              setSelection("Galaxy")
            }}
            onSelectPlanet={(planet) => {
              setSelection(planet.name)
            }}
          />
        </div>
      </div>
    )
  },
}
