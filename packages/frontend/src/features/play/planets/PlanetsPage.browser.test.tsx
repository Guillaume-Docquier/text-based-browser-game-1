import { createPlayerStub } from "shared/domain/players/Player.stub.ts"
import { createPlanetStub } from "shared/domain/world/planets/Planet.stub.ts"
import { createStarStub } from "shared/domain/world/stars/Star.stub.ts"
import { describe, expect, it } from "vitest"
import { page } from "vitest/browser"
import { renderApplicationPage } from "@/testing/renderApplicationPage.tsx"
import { createPlayGameContextStub } from "../PlayContext.stub.ts"
import { PlayGameContextProvider } from "../PlayContext.tsx"
import { PlanetsPage } from "./PlanetsPage.tsx"

async function renderPlanets(): Promise<void> {
  const alice = createPlayerStub()
  const bob = createPlayerStub({ id: "00000000-0000-4000-8000-000000000002", alias: "Bob" })
  const planets = [
    createPlanetStub({
      name: "Atlas",
      ownerPlayerId: bob.id,
      coordinates: "1:2:1",
      fertility: 3,
      metal: 2,
      fuel: 1,
      energy: 4,
      maxPopulation: 28,
      area: 3,
    }),
    createPlanetStub({
      name: "Eris",
      ownerPlayerId: alice.id,
      coordinates: "1:10:3",
      fertility: 1,
      metal: 3,
      fuel: 4,
      energy: 2,
      maxPopulation: 10,
      area: 2,
    }),
    createPlanetStub({
      name: "Luna",
      ownerPlayerId: bob.id,
      coordinates: "1:3:2",
      fertility: 4,
      metal: 1,
      fuel: 3,
      energy: 3,
      maxPopulation: 2,
      area: 10,
    }),
    createPlanetStub({
      name: "Terra",
      ownerPlayerId: alice.id,
      coordinates: "1:1:4",
      fertility: 2,
      metal: 4,
      fuel: 2,
      energy: 1,
      maxPopulation: 40,
      area: 4,
    }),
    createPlanetStub({ name: "Unclaimed" }),
  ]
  const context = createPlayGameContextStub({ galaxy: { systems: [{ star: createStarStub(), planets }] } })
  context.gameDetails.players = [alice, bob]
  await renderApplicationPage(
    <PlayGameContextProvider {...context}>
      <PlanetsPage />
    </PlayGameContextProvider>,
  )
}

async function expectPlanets(names: readonly string[]): Promise<void> {
  const rows = page
    .getByRole("table", { name: "Owned planets" })
    .getByRole("row")
    .filter({ has: page.getByRole("link") })
  await expect.poll(() => rows.all().map((row) => row.getByRole("cell").first().element().textContent)).toEqual(names)
}

describe("PlanetsPage", () => {
  it("should filter owned planets by player, name, and coordinates", async () => {
    await renderPlanets()
    const ownerFilter = page.getByRole("combobox", { name: "Owner" })
    const search = page.getByRole("textbox", { name: "Search planets" })
    await page.mark("View all owned planets in default owner order", async () => {
      await expect.element(page.getByRole("columnheader", { name: "Owner" })).toHaveAttribute("aria-sort", "ascending")
      await expectPlanets(["Eris", "Terra", "Atlas", "Luna"])
    })
    await page.mark("Select Bob and then restore all owners", async () => {
      await ownerFilter.click()
      await page.getByRole("option", { name: "Bob" }).click()
      await expectPlanets(["Atlas", "Luna"])
      await ownerFilter.click()
      await page.getByRole("option", { name: "All players" }).click()
      await expectPlanets(["Eris", "Terra", "Atlas", "Luna"])
    })
    await page.mark("Find different planets by name and coordinates", async () => {
      await search.fill("lun")
      await expectPlanets(["Luna"])
      await search.fill("1:10:3")
      await expectPlanets(["Eris"])
      await search.fill("")
      await expectPlanets(["Eris", "Terra", "Atlas", "Luna"])
    })
  })

  it("should order the planets by each column in both directions", async () => {
    await renderPlanets()
    const orders = [
      { column: "Planet", ascending: ["Atlas", "Eris", "Luna", "Terra"] },
      { column: "Coordinates", ascending: ["Terra", "Atlas", "Luna", "Eris"] },
      { column: "Fertility", ascending: ["Eris", "Terra", "Atlas", "Luna"] },
      { column: "Metal", ascending: ["Luna", "Atlas", "Eris", "Terra"] },
      { column: "Fuel", ascending: ["Atlas", "Terra", "Luna", "Eris"] },
      { column: "Energy", ascending: ["Terra", "Eris", "Luna", "Atlas"] },
      { column: "Max population", ascending: ["Luna", "Eris", "Atlas", "Terra"] },
      { column: "Area", ascending: ["Eris", "Atlas", "Terra", "Luna"] },
      { column: "Owner", ascending: ["Eris", "Terra", "Atlas", "Luna"] },
    ]
    for (const { column, ascending } of orders) {
      await page.mark(`Sort by ${column} and reverse the order`, async () => {
        const header = page.getByRole("columnheader", { name: column, exact: true })
        const sort = header.getByRole("button", { name: column, exact: true })
        await sort.click()
        await expect.element(header).toHaveAttribute("aria-sort", "ascending")
        await expectPlanets(ascending)
        await sort.click()
        await expect.element(header).toHaveAttribute("aria-sort", "descending")
        await expectPlanets(ascending.toReversed())
      })
    }
  })
})
