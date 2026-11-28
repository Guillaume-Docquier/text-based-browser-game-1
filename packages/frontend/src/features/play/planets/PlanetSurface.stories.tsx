import type { Meta, StoryObj } from "@storybook/react-vite"
import { createBuildingStub } from "shared/domain/world/buildings/Building.stub.ts"
import { createPlanetStub } from "shared/domain/world/planets/Planet.stub.ts"
import oceanicArt from "@/assets/planets/oceanic-small.png"
import { PlanetSurface } from "./PlanetSurface.tsx"

const planet = createPlanetStub({ id: "home", name: "Atlas", area: 9 })
const meta = {
  title: "Application/Planet Surface",
  component: PlanetSurface,
  args: { planet, artwork: oceanicArt, buildings: [createBuildingStub({ planetId: planet.id })] },
} satisfies Meta<typeof PlanetSurface>
export default meta
type Story = StoryObj<typeof meta>
export const Interactive: Story = {}
export const EmptySurface: Story = { args: { buildings: [] } }
