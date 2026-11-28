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
      metalProduction: 2,
      remainingMetalDeposit: 1,
      area: 3,
    }),
    createPlanetStub({
      name: "Eris",
      ownerPlayerId: alice.id,
      coordinates: "1:10:3",
      metalProduction: 3,
      remainingMetalDeposit: 4,
      area: 2,
    }),
    createPlanetStub({
      name: "Luna",
      ownerPlayerId: bob.id,
      coordinates: "1:3:2",
      metalProduction: 1,
      remainingMetalDeposit: 3,
      area: 10,
    }),
    createPlanetStub({
      name: "Terra",
      ownerPlayerId: alice.id,
      coordinates: "1:1:4",
      metalProduction: 4,
      remainingMetalDeposit: 2,
      area: 4,
    }),
    createPlanetStub({ name: "Prospect", coordinates: "2:3:5", metalProduction: 4, remainingMetalDeposit: 14 }),
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
    .getByRole("table", { name: "Planets" })
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
      { column: "Metal production per mine per turn", ascending: ["Luna", "Atlas", "Eris", "Terra"] },
      { column: "Remaining metal deposit", ascending: ["Atlas", "Terra", "Luna", "Eris"] },
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

  it("should meet PLST-0001 When a player opens the planet list or inspects a planet, they can distinguish metal production per mine per turn from the remaining deposit. The removed attributes have no columns, sort choices or inspector entries.", async () => {
    await renderPlanets()
    await page.mark("Read the production and remaining deposit alongside capacity", async () => {
      const headers = page.getByRole("table", { name: "Planets" }).getByRole("columnheader")
      expect(headers.all().map((header) => header.element().textContent)).toStrictEqual([
        "Planet",
        "Owner",
        "Coordinates",
        "Metal production per mine per turn",
        "Remaining metal deposit",
        "Area",
      ])
      const atlas = page.getByRole("row").filter({ has: page.getByRole("cell", { name: "Atlas", exact: true }) })
      expect(
        atlas
          .getByRole("cell")
          .all()
          .map((cell) => cell.element().textContent),
      ).toStrictEqual(["Atlas", "Bob", "1:2:1", "2", "1", "3"])
    })
  })

  it("should meet PLST-0002 When the player opens Planets, the default list contains the planets owned by any player. Choosing All planets lets them compare the available metal production and remaining deposit of owned and unowned planets in the same list.", async () => {
    await renderPlanets()
    await page.mark("Expand the list from owned planets to candidate colonies", async () => {
      await expectPlanets(["Eris", "Terra", "Atlas", "Luna"])
      await page.getByRole("combobox", { name: "Owner" }).click()
      await page.getByRole("option", { name: "All planets" }).click()
      await expectPlanets(["Eris", "Terra", "Atlas", "Luna", "Prospect"])
      const prospect = page.getByRole("row").filter({ has: page.getByRole("cell", { name: "Prospect", exact: true }) })
      expect(
        prospect
          .getByRole("cell")
          .all()
          .map((cell) => cell.element().textContent),
      ).toStrictEqual(["Prospect", "Unclaimed", "2:3:5", "4", "14", "1"])
    })
  })
})
