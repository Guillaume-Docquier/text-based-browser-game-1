import type { Meta, StoryObj } from "@storybook/react-vite"
import { useState, type ReactElement } from "react"
import { createPlayerStub } from "shared/domain/players/Player.stub.ts"
import { createBuildingStub } from "shared/domain/world/buildings/Building.stub.ts"
import { BuildingType } from "shared/domain/world/buildings/Building.ts"
import { ConstructionOrderIdSchema, TRADE_CENTER_COST, type ConstructionOrder } from "shared/domain/world/buildings/ConstructionOrder.ts"
import { createPlanetStub } from "shared/domain/world/planets/Planet.stub.ts"
import oceanicArt from "@/assets/planets/oceanic-small.png"
import { PlanetSurface } from "./PlanetSurface.tsx"

const planet = createPlanetStub({ id: "home", name: "Atlas", area: 9 })
const meta = {
  title: "Application/Planet Surface",
  component: PlanetSurface,
  args: {
    planet,
    artwork: oceanicArt,
    buildings: [
      createBuildingStub({ planetId: planet.id }),
      createBuildingStub({ planetId: planet.id, type: BuildingType.TRADE_CENTER, site: 1 }),
    ],
  },
} satisfies Meta<typeof PlanetSurface>
export default meta
type Story = StoryObj<typeof meta>
export const Interactive: Story = {}
export const EmptySurface: Story = { args: { buildings: [] } }

function OwnerPlanning(): ReactElement {
  const owner = createPlayerStub()
  const [orders, setOrders] = useState<ConstructionOrder[]>([])
  return (
    <PlanetSurface
      {...meta.args}
      planet={{ ...planet, ownerPlayerId: owner.id }}
      planning={{
        turn: 1,
        playerId: owner.id,
        balance: 100,
        open: true,
        pending: false,
        error: undefined,
        orders,
        submit: (site) => {
          setOrders([
            {
              id: ConstructionOrderIdSchema.parse("00000000-0000-4000-8000-000000000002"),
              type: BuildingType.TRADE_CENTER,
              planetId: planet.id,
              site,
              cost: TRADE_CENTER_COST,
            },
          ])
        },
        cancel: () => {
          setOrders([])
        },
      }}
    />
  )
}
export const OwnerConstruction: Story = { render: () => <OwnerPlanning /> }
