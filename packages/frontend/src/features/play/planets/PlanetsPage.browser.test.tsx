import { createMemoryHistory, createRootRoute, createRouter, RouterProvider } from "@tanstack/react-router"
import { createRoot } from "react-dom/client"
import { createPlayerStub } from "shared/domain/players/Player.stub.ts"
import { createPlanetStub } from "shared/domain/world/planets/Planet.stub.ts"
import { createStarStub } from "shared/domain/world/stars/Star.stub.ts"
import { createStarSystemStub } from "shared/domain/world/StarSystem.stub.ts"
import { StarSystemSchema } from "shared/domain/world/StarSystem.ts"
import { describe, expect, it, onTestFinished } from "vitest"
import { page } from "vitest/browser"
import { createPlayGameContextStub } from "../PlayContext.stub.ts"
import { PlayGameContextProvider } from "../PlayContext.tsx"
import { PlanetsPage } from "./PlanetsPage.tsx"

const alice = createPlayerStub()
const bob = createPlayerStub({ id: "00000000-0000-4000-8000-000000000002", alias: "Bob" })
const game = createPlayGameContextStub({
  galaxy: {
    systems: [
      StarSystemSchema.parse(
        createStarSystemStub({
          star: createStarStub({ id: "00000000-0000-4000-8000-000000000021", name: "Sol" }),
          planets: [
            createPlanetStub({
              id: "00000000-0000-4000-8000-000000000013",
              name: "Planet 10",
              coordinates: "3:1:0",
              ownerPlayerId: alice.id,
              area: 2,
            }),
            createPlanetStub({
              id: "00000000-0000-4000-8000-000000000011",
              name: "Planet 1",
              coordinates: "1:1:0",
              ownerPlayerId: bob.id,
              area: 4,
            }),
            createPlanetStub({
              id: "00000000-0000-4000-8000-000000000012",
              name: "Planet 2",
              coordinates: "2:1:0",
              ownerPlayerId: alice.id,
              area: 10,
            }),
            createPlanetStub({ id: "00000000-0000-4000-8000-000000000014", name: "Planet 3", coordinates: "4:1:0" }),
          ],
        }),
      ),
    ],
  },
})
const context = { ...game, gameDetails: { ...game.gameDetails, players: [bob, alice] } }

function renderPlanetsPage(): void {
  const routeTree = createRootRoute({
    component: () => (
      <PlayGameContextProvider value={context}>
        <PlanetsPage />
      </PlayGameContextProvider>
    ),
  })
  const router = createRouter({ routeTree, history: createMemoryHistory({ initialEntries: ["/"] }) })
  const container = document.createElement("div")
  document.body.append(container)
  const root = createRoot(container)
  onTestFinished(() => {
    root.unmount()
    container.remove()
  })
  root.render(<RouterProvider router={router} />)
}

const planetNames = page
  .getByRole("table", { name: "Owned planets" })
  .getByRole("row")
  .filter({ has: page.getByRole("link") })
  .getByRole("cell", { name: /^Planet \d+$/ })

async function expectPlanetOrder(expectedNames: string[]): Promise<void> {
  await expect.poll(() => planetNames.elements().map((cell) => cell.textContent)).toEqual(expectedNames)
}

describe("Planets", () => {
  it("should combine the owner filter with name and coordinate search", async () => {
    renderPlanetsPage()
    const search = page.getByRole("textbox", { name: "Search planets" })
    const owner = page.getByRole("combobox", { name: "Owner" })

    await page.mark("List only owned planets in owner order by default", async () => {
      await expect.element(page.getByRole("columnheader", { name: "Owner" })).toHaveAttribute("aria-sort", "ascending")
      await expectPlanetOrder(["Planet 2", "Planet 10", "Planet 1"])
    })

    await page.mark("Select Alice and search by name", async () => {
      await owner.click()
      await page.getByRole("option", { name: "Alice" }).click()
      await search.fill("pLaNeT 1")
      await expectPlanetOrder(["Planet 10"])
    })

    await page.mark("Find a planet by coordinates and then search for Bob's coordinates", async () => {
      await search.fill("2:1:0")
      await expectPlanetOrder(["Planet 2"])

      await search.fill("1:1:0")
      await expect.element(page.getByText("No matching planets")).toBeVisible()
    })

    await page.mark("Switch to all players while keeping the coordinate search", async () => {
      await owner.click()
      await page.getByRole("option", { name: "All players" }).click()
      await expectPlanetOrder(["Planet 1"])
    })
  })

  it("should sort names naturally and area numerically in both directions", async () => {
    renderPlanetsPage()
    const table = page.getByRole("table", { name: "Owned planets" })

    await page.mark("Sort by planet name in both directions", async () => {
      const sort = table.getByRole("button", { name: "Planet", exact: true })
      await sort.click()
      await expectPlanetOrder(["Planet 1", "Planet 2", "Planet 10"])

      await sort.click()
      await expectPlanetOrder(["Planet 10", "Planet 2", "Planet 1"])
    })

    await page.mark("Sort by area in both directions", async () => {
      const sort = table.getByRole("button", { name: "Area" })
      const header = table.getByRole("columnheader", { name: "Area" })
      await sort.click()
      await expect.element(header).toHaveAttribute("aria-sort", "ascending")
      await expectPlanetOrder(["Planet 10", "Planet 1", "Planet 2"])

      await sort.click()
      await expect.element(header).toHaveAttribute("aria-sort", "descending")
      await expectPlanetOrder(["Planet 2", "Planet 1", "Planet 10"])
    })
  })
})
