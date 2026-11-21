import { createPlayerStub } from "shared/domain/players/Player.stub.ts"
import { createPlanetStub } from "shared/domain/world/planets/Planet.stub.ts"
import { createStarSystemStub } from "shared/domain/world/StarSystem.stub.ts"
import { StarSystemSchema } from "shared/domain/world/StarSystem.ts"
import { describe, expect, it } from "vitest"
import { page } from "vitest/browser"
import { renderRoute } from "@/lib/renderRoute.test-support.tsx"
import { createPlayGameContextStub } from "../PlayContext.stub.ts"
import { PlayGameContextProvider } from "../PlayContext.tsx"
import { PlanetsPage } from "./PlanetsPage.tsx"

function renderPlanets(): void {
  const alice = createPlayerStub()
  const bob = createPlayerStub({ alias: "Bob", id: "00000000-0000-4000-8000-000000000002" })
  const planets = [
    createPlanetStub({
      id: "00000000-0000-4000-8000-000000000003",
      name: "Atlas",
      coordinates: "2:2:3",
      fertility: 2,
      metal: 4,
      fuel: 3,
      energy: 3,
      maxPopulation: 3,
      area: 1,
      ownerPlayerId: bob.id,
    }),
    createPlanetStub({
      id: "00000000-0000-4000-8000-000000000004",
      name: "Boreas",
      coordinates: "1:2:3",
      fertility: 4,
      metal: 2,
      fuel: 4,
      energy: 1,
      maxPopulation: 10,
      area: 10,
      ownerPlayerId: alice.id,
    }),
    createPlanetStub({
      id: "00000000-0000-4000-8000-000000000005",
      name: "Ceto",
      coordinates: "3:2:3",
      fertility: 1,
      metal: 3,
      fuel: 1,
      energy: 2,
      maxPopulation: 2,
      area: 3,
      ownerPlayerId: bob.id,
    }),
    createPlanetStub({
      id: "00000000-0000-4000-8000-000000000006",
      name: "Dione",
      coordinates: "10:2:3",
      fertility: 3,
      metal: 1,
      fuel: 2,
      energy: 4,
      maxPopulation: 1,
      area: 2,
      ownerPlayerId: alice.id,
    }),
    createPlanetStub({ name: "Unclaimed" }),
  ]
  const context = createPlayGameContextStub({ galaxy: { systems: [StarSystemSchema.parse(createStarSystemStub({ planets }))] } })
  renderRoute(
    <PlayGameContextProvider value={{ ...context, gameDetails: { ...context.gameDetails, players: [alice, bob] } }}>
      <PlanetsPage />
    </PlayGameContextProvider>,
  )
}

const planetRows = page
  .getByRole("table", { name: "Owned planets" })
  .getByRole("row")
  .filter({ has: page.getByRole("link") })

function planetNames(): string[] {
  return planetRows.all().map((row) => row.getByRole("cell").first().element().textContent)
}

describe("PlanetsPage", () => {
  it("should show all owned planets, then filter by owner, name and coordinates", async () => {
    renderPlanets()
    const owner = page.getByRole("combobox", { name: "Owner" })
    const search = page.getByRole("textbox", { name: "Search planets" })
    await page.mark("Read the owned planets in default owner order", async () => {
      const ownerHeader = page.getByRole("columnheader", { name: "Owner" })
      await expect.element(ownerHeader).toHaveAttribute("aria-sort", "ascending")
      await expect
        .poll(() =>
          planetRows.all().map((row) =>
            row
              .getByRole("cell")
              .elements()
              .map((cell) => cell.textContent),
          ),
        )
        .toEqual([
          ["Boreas", "Alice", "1:2:3", "4", "2", "4", "1", "10", "10"],
          ["Dione", "Alice", "10:2:3", "3", "1", "2", "4", "1", "2"],
          ["Atlas", "Bob", "2:2:3", "2", "4", "3", "3", "3", "1"],
          ["Ceto", "Bob", "3:2:3", "1", "3", "1", "2", "2", "3"],
        ])
    })
    await page.mark("Restrict the list to Bob and combine it with a search", async () => {
      await owner.click()
      await page.getByRole("option", { name: "Bob" }).click()
      await expect.poll(planetNames).toEqual(["Atlas", "Ceto"])
      await search.fill(" boreas ")
      await expect.element(page.getByText("No matching planets")).toBeVisible()
    })
    await page.mark("Search across owners by name and coordinates", async () => {
      await owner.click()
      await page.getByRole("option", { name: "All players" }).click()
      await expect.poll(planetNames).toEqual(["Boreas"])
      await search.fill("10:2:3")
      await expect.poll(planetNames).toEqual(["Dione"])
      await search.fill("")
      await expect.poll(planetNames).toEqual(["Boreas", "Dione", "Atlas", "Ceto"])
    })
  })

  it.each([
    {
      column: "Planet",
      previousColumn: "Coordinates",
      ascending: ["Atlas", "Boreas", "Ceto", "Dione"],
      descending: ["Dione", "Ceto", "Boreas", "Atlas"],
    },
    {
      column: "Owner",
      ascending: ["Boreas", "Dione", "Atlas", "Ceto"],
      descending: ["Ceto", "Atlas", "Dione", "Boreas"],
    },
    { column: "Coordinates", ascending: ["Boreas", "Atlas", "Ceto", "Dione"], descending: ["Dione", "Ceto", "Atlas", "Boreas"] },
    { column: "Fertility", ascending: ["Ceto", "Atlas", "Dione", "Boreas"], descending: ["Boreas", "Dione", "Atlas", "Ceto"] },
    { column: "Metal", ascending: ["Dione", "Boreas", "Ceto", "Atlas"], descending: ["Atlas", "Ceto", "Boreas", "Dione"] },
    { column: "Fuel", ascending: ["Ceto", "Dione", "Atlas", "Boreas"], descending: ["Boreas", "Atlas", "Dione", "Ceto"] },
    { column: "Energy", ascending: ["Boreas", "Ceto", "Atlas", "Dione"], descending: ["Dione", "Atlas", "Ceto", "Boreas"] },
    { column: "Max population", ascending: ["Dione", "Ceto", "Atlas", "Boreas"], descending: ["Boreas", "Atlas", "Ceto", "Dione"] },
    { column: "Area", ascending: ["Atlas", "Dione", "Ceto", "Boreas"], descending: ["Boreas", "Ceto", "Dione", "Atlas"] },
  ])("should sort $column in both directions", async ({ column, previousColumn = "Planet", ascending, descending }) => {
    renderPlanets()
    const header = page.getByRole("columnheader", { name: column, exact: true })
    const sort = header.getByRole("button")
    const previousHeader = page.getByRole("columnheader", { name: previousColumn, exact: true })
    await page.mark("Switch from a different column to ascending order", async () => {
      await previousHeader.getByRole("button").click()
      await expect.element(previousHeader).toHaveAttribute("aria-sort", "ascending")
      await sort.click()
      await expect.element(header).toHaveAttribute("aria-sort", "ascending")
      await expect.poll(planetNames).toEqual(ascending)
    })
    await page.mark("Reverse the same column", async () => {
      await sort.click()
      await expect.element(header).toHaveAttribute("aria-sort", "descending")
      await expect.poll(planetNames).toEqual(descending)
    })
    await page.mark("Switch away from descending order", async () => {
      await previousHeader.getByRole("button").click()
      await expect.element(previousHeader).toHaveAttribute("aria-sort", "ascending")
      await expect.element(header).toHaveAttribute("aria-sort", "none")
    })
  })
})
