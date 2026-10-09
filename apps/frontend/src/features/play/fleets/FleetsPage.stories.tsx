import type { Meta, StoryObj } from "@storybook/react-vite"
import { createMemoryHistory, createRootRoute, createRoute, createRouter, RouterProvider } from "@tanstack/react-router"
import type { ReactElement } from "react"
import { GameIdSchema } from "shared/domain/games/GameId.ts"
import { createFleetStub } from "shared/domain/world/fleets/Fleet.stub.ts"
import { createPlanetStub } from "shared/domain/world/planets/Planet.stub.ts"
import { expect, within } from "storybook/test"
import { createGamePlayerStub } from "@/lib/api/GamePlayer.stub.ts"
import { FleetsPageView } from "./FleetsPage.tsx"

const alice = createGamePlayerStub()
const bob = createGamePlayerStub({ id: "00000000-0000-4000-8000-000000000002", alias: "Bob", color: "PINK" })
const origin = createPlanetStub({ id: "planet-earth", name: "Earth", coordinates: "1:2:3" })
const destination = createPlanetStub({ id: "planet-mars", name: "Mars", coordinates: "4:5:6" })
const distantPlanet = createPlanetStub({ id: "planet-venus", name: "Venus", coordinates: "7:8:9" })
const stationed = createFleetStub({
  id: "fleet-guard",
  name: "Home Guard",
  ownerPlayerId: alice.id,
  originPlanetId: origin.id,
  strength: 1000,
})
const moving = createFleetStub({
  id: "fleet-vanguard",
  name: "Vanguard",
  ownerPlayerId: bob.id,
  originPlanetId: origin.id,
  destinationPlanetId: destination.id,
  distanceToEnd: 12.345,
  strength: 25,
})
const mixedFleets = [
  moving,
  createFleetStub({
    id: "fleet-scout",
    name: "Scout",
    ownerPlayerId: alice.id,
    originPlanetId: destination.id,
    destinationPlanetId: distantPlanet.id,
    distanceToEnd: 2.5,
    strength: 5,
  }),
  createFleetStub({ id: "fleet-reserve", name: "Reserve", ownerPlayerId: bob.id, originPlanetId: distantPlanet.id, strength: 10 }),
  stationed,
]

const meta = {
  title: "Application/Fleets Page",
  component: FleetsPageView,
  parameters: { layout: "fullscreen" },
  args: {
    gameId: GameIdSchema.parse(42),
    fleets: [],
    players: [alice, bob],
    planets: [origin, destination, distantPlanet],
  },
  decorators: [
    (Story): ReactElement => {
      const rootRoute = createRootRoute()
      const fleetsRoute = createRoute({ getParentRoute: () => rootRoute, path: "/games/$gameId/play/fleets", component: Story })
      const galaxyRoute = createRoute({ getParentRoute: () => rootRoute, path: "/games/$gameId/play/galaxy" })
      const router = createRouter({
        routeTree: rootRoute.addChildren([fleetsRoute, galaxyRoute]),
        history: createMemoryHistory({ initialEntries: ["/games/42/play/fleets"] }),
      })
      return (
        <div className="flex h-[32rem] min-w-0">
          <RouterProvider router={router} />
        </div>
      )
    },
  ],
} satisfies Meta<typeof FleetsPageView>

export default meta
type Story = StoryObj<typeof meta>

/**
 * Empty game state keeps its empty message when an owner is selected.
 */
export const NoFleets: Story = {
  play: async ({ canvas, canvasElement, userEvent }) => {
    const table = within(await canvas.findByRole("table", { name: "Fleets" }))
    await expect(table.getByRole("cell", { name: "No fleets" })).toHaveAttribute("colspan", "6")
    await userEvent.click(canvas.getByRole("combobox", { name: "Owner" }))
    await userEvent.click(within(canvasElement.ownerDocument.body).getByRole("option", { name: "Bob" }))
    await expect(table.getByRole("cell", { name: "No fleets" })).toBeVisible()
  },
}

/**
 * A stationed fleet displays a dash in both movement columns.
 */
export const WithoutDestination: Story = {
  args: { fleets: [stationed] },
  play: async ({ canvas }) => {
    const row = within(await canvas.findByRole("row", { name: /Home Guard/ }))
    await expect(row.getAllByRole("cell").map((cell) => cell.textContent)).toEqual([
      "Home Guard",
      "Alice",
      "1,000",
      "Earth (1:2:3)",
      "-",
      "-",
    ])
    await expect(row.getAllByRole("link")).toHaveLength(1)
  },
}

/**
 * In-transit fleets use their remaining distance and link to their destination.
 */
export const WithDestination: Story = {
  args: { fleets: [moving] },
  play: async ({ canvas }) => {
    const row = within(await canvas.findByRole("row", { name: /Vanguard/ }))
    await expect(row.getAllByRole("cell").map((cell) => cell.textContent)).toEqual([
      "Vanguard",
      "Bob",
      "25",
      "Earth (1:2:3)",
      "Mars (4:5:6)",
      "12.35 ly",
    ])
    await expect(row.getByRole("link", { name: "Mars (4:5:6)" })).toHaveAttribute("href", "/games/42/play/galaxy?planetId=planet-mars")
  },
}

/**
 * A complete table combines owners, strengths, origins, destinations, and journey lengths.
 */
export const ManyFleets: Story = {
  args: { fleets: mixedFleets },
  play: async ({ canvas }) => {
    const table = within(await canvas.findByRole("table", { name: "Fleets" }))
    await expect(table.getAllByRole("columnheader").map((cell) => cell.textContent)).toEqual([
      "Fleet",
      "Owner",
      "Strength",
      "Origin planet",
      "Destination planet",
      "Journey left",
    ])
    await expect(
      table
        .getAllByRole("row")
        .slice(1)
        .map((row) =>
          within(row)
            .getAllByRole("cell")
            .map((cell) => cell.textContent),
        ),
    ).toEqual([
      ["Home Guard", "Alice", "1,000", "Earth (1:2:3)", "-", "-"],
      ["Scout", "Alice", "5", "Mars (4:5:6)", "Venus (7:8:9)", "2.5 ly"],
      ["Reserve", "Bob", "10", "Venus (7:8:9)", "-", "-"],
      ["Vanguard", "Bob", "25", "Earth (1:2:3)", "Mars (4:5:6)", "12.35 ly"],
    ])
  },
}

export const SearchFleets: Story = {
  args: { fleets: mixedFleets },
  play: async ({ canvas, userEvent }) => {
    await canvas.findByRole("row", { name: /Vanguard/ })
    const search = canvas.getByRole("textbox", { name: "Search fleets" })
    await userEvent.type(search, "  VANG  ")
    await expect(canvas.getAllByRole("row")).toHaveLength(2)
    await expect(canvas.getByRole("row", { name: /Vanguard/ })).toBeVisible()
    await userEvent.clear(search)
    await userEvent.type(search, "unknown fleet")
    await expect(canvas.getByRole("cell", { name: "No matching fleets" })).toBeVisible()
    await userEvent.clear(search)
    await expect(canvas.getAllByRole("row")).toHaveLength(5)
  },
}

export const FilterByOwner: Story = {
  args: { fleets: mixedFleets },
  play: async ({ canvas, canvasElement, userEvent }) => {
    await canvas.findByRole("row", { name: /Vanguard/ })
    const owner = canvas.getByRole("combobox", { name: "Owner" })
    const body = within(canvasElement.ownerDocument.body)
    await userEvent.click(owner)
    await userEvent.click(body.getByRole("option", { name: "Bob" }))
    await expect(
      canvas
        .getAllByRole("row")
        .slice(1)
        .map((row) => within(row).getAllByRole("cell")[0]?.textContent),
    ).toEqual(["Reserve", "Vanguard"])
    await userEvent.click(owner)
    await userEvent.click(body.getByRole("option", { name: "All players" }))
    await expect(canvas.getAllByRole("row")).toHaveLength(5)
  },
}

/**
 * Numeric journey sorting must compare distances rather than their formatted labels.
 */
export const SortFleets: Story = {
  args: { fleets: mixedFleets },
  play: async ({ canvas, userEvent }) => {
    const table = within(await canvas.findByRole("table", { name: "Fleets" }))
    for (const [column, ascending, descending] of [
      ["Fleet", ["Home Guard", "Reserve", "Scout", "Vanguard"], ["Vanguard", "Scout", "Reserve", "Home Guard"]],
      ["Owner", ["Home Guard", "Scout", "Reserve", "Vanguard"], ["Vanguard", "Reserve", "Scout", "Home Guard"]],
      ["Strength", ["Scout", "Reserve", "Vanguard", "Home Guard"], ["Home Guard", "Vanguard", "Reserve", "Scout"]],
      ["Origin planet", ["Home Guard", "Vanguard", "Scout", "Reserve"], ["Reserve", "Scout", "Vanguard", "Home Guard"]],
      ["Destination planet", ["Home Guard", "Reserve", "Vanguard", "Scout"], ["Scout", "Vanguard", "Reserve", "Home Guard"]],
      ["Journey left", ["Home Guard", "Reserve", "Scout", "Vanguard"], ["Vanguard", "Scout", "Reserve", "Home Guard"]],
    ] as const) {
      await userEvent.click(table.getByRole("button", { name: column }))
      await expect(
        table
          .getAllByRole("row")
          .slice(1)
          .map((row) => within(row).getAllByRole("cell")[0]?.textContent),
      ).toEqual(ascending)
      await expect(table.getByRole("columnheader", { name: column })).toHaveAttribute("aria-sort", "ascending")
      await userEvent.click(table.getByRole("button", { name: column }))
      await expect(
        table
          .getAllByRole("row")
          .slice(1)
          .map((row) => within(row).getAllByRole("cell")[0]?.textContent),
      ).toEqual(descending)
    }
  },
}
