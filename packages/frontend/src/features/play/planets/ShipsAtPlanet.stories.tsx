import type { PlayerView } from "@api-types"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { createPlayerStub } from "shared/domain/players/Player.stub.ts"
import { createPlanetStub } from "shared/domain/world/planets/Planet.stub.ts"
import { SHIP_TEMPLATES, ShipIdSchema, ShipType } from "shared/domain/world/ships/Ship.ts"
import { ShipsAtPlanet } from "./ShipsAtPlanet.tsx"

const owner = createPlayerStub()
const guest = createPlayerStub({ id: "00000000-0000-4000-8000-000000000002", alias: "Bob" })
const planet = createPlanetStub({ id: "haven", name: "Haven", coordinates: "44:19:10", ownerPlayerId: owner.id })
const transport: PlayerView["ships"][number] = {
  id: ShipIdSchema.parse("T-01"),
  ...SHIP_TEMPLATES[ShipType.TRANSPORT],
  planetId: planet.id,
  ownerPlayerId: owner.id,
  cargo: [],
  order: null,
}
const visitor: PlayerView["ships"][number] = { ...transport, id: ShipIdSchema.parse("T-010"), ownerPlayerId: guest.id }
const meta = {
  title: "Application/Stationed Ships",
  component: ShipsAtPlanet,
  args: { planet, players: [owner, guest], ships: [transport, visitor] },
} satisfies Meta<typeof ShipsAtPlanet>
export default meta
type Story = StoryObj<typeof meta>
export const Interactive: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: /^Transport T-01$/ }))
    await canvas.findByText(owner.alias)
    await userEvent.click(canvas.getByRole("button", { name: /^Transport T-010$/ }))
    await canvas.findByText(guest.alias)
  },
}
