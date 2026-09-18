import { Assert } from "@guillaume-docquier/tools-ts"
import { DETERMINISTIC_GALAXY_SEED, TEST_RULESET_NAME } from "../constants.ts"
import { expect, test } from "../fixtures.ts"
import { CreateGamePage } from "../pages/CreateGamePage.ts"
import { GalaxyPage } from "../pages/GalaxyPage.ts"
import { LobbyPage } from "../pages/LobbyPage.ts"
import { PlanetsPage } from "../pages/PlanetsPage.ts"

test("compares owned Planets and opens one in the Galaxy", async ({ alice, bob }) => {
  const aliceLobbyPage = await test.step("Alice creates a two-player game", async () => {
    const createGamePage = await CreateGamePage.goto(alice.page, { mapGenerationSeed: DETERMINISTIC_GALAXY_SEED })
    await createGamePage.setGameName(`Planet overview ${Date.now()}`)
    await createGamePage.setMaxPlayers(2)
    await createGamePage.selectRuleset(TEST_RULESET_NAME)
    return await createGamePage.submit()
  })

  await test.step("Bob joins Alice's lobby", async () => {
    const lobbyPage = await LobbyPage.goto(bob.page, await aliceLobbyPage.getGameId())
    await lobbyPage.joinGame()
  })

  const planetsPage = await test.step("Alice starts the game and opens Planets", async () => {
    const galaxyPage = await aliceLobbyPage.startGame()
    return await galaxyPage.openPlanets()
  })

  await test.step("Default to all player-owned Planets with owner sorting", async () => {
    await expect(planetsPage.heading).toBeVisible()
    await expect(planetsPage.rows).toHaveCount(2)
    await expect(planetsPage.sortHeader("Owner")).toHaveAttribute("aria-sort", "ascending")

    const ownerNames = await planetsPage.getColumnValues("ownerName")
    expect(new Set(ownerNames).size).toBe(ownerNames.length)
  })

  await test.step("Filter owned Planets by owner, name, and coordinates", async () => {
    const ownerNames = await planetsPage.getColumnValues("ownerName")
    const ownerName = ownerNames[0]
    Assert.isDefined(ownerName)

    await planetsPage.selectOwner(ownerName)
    await expect(planetsPage.rows).toHaveCount(1)
    await expect(planetsPage.ownerName(planetsPage.row(0))).toHaveText(ownerName)
    await planetsPage.selectOwner("All players")

    const firstRow = planetsPage.row(0)
    const planetName = await planetsPage.getPlanetName(firstRow)
    const coordinates = await planetsPage.getCoordinate(firstRow)

    await planetsPage.search(planetName)
    await expect(planetsPage.rows).toHaveCount(1)
    await planetsPage.search(coordinates)
    await expect(planetsPage.rows).toHaveCount(1)
    await planetsPage.search("")
  })

  await test.step("Sort in both directions by every visible column", async () => {
    const columns = [
      {
        name: "Planet",
        column: "planetName",
        ascending: ["planet 919309", "planet 991659"],
        descending: ["planet 991659", "planet 919309"],
      },
      {
        name: "Coordinates",
        column: "coordinates",
        ascending: ["44:96:25", "46:93:25"],
        descending: ["46:93:25", "44:96:25"],
      },
      {
        name: "Fertility",
        column: "fertility",
        ascending: ["2", "3"],
        descending: ["3", "2"],
      },
      {
        name: "Metal",
        column: "metal",
        ascending: ["1", "3"],
        descending: ["3", "1"],
      },
      {
        name: "Fuel",
        column: "fuel",
        ascending: ["2", "4"],
        descending: ["4", "2"],
      },
      {
        name: "Energy",
        column: "energy",
        ascending: ["1", "2"],
        descending: ["2", "1"],
      },
      {
        name: "Max population",
        column: "maxPopulation",
        ascending: ["10", "28"],
        descending: ["28", "10"],
      },
      {
        name: "Area",
        column: "area",
        ascending: ["3", "10"],
        descending: ["10", "3"],
      },
      {
        name: "Owner",
        column: "ownerName",
        ascending: [alice.alias, bob.alias],
        descending: [bob.alias, alice.alias],
      },
    ] as const

    for (const column of columns) {
      await planetsPage.sortBy(column.name)
      await expect(planetsPage.sortHeader(column.name)).toHaveAttribute("aria-sort", "ascending")
      expect(await planetsPage.getColumnValues(column.column)).toStrictEqual(column.ascending)

      await planetsPage.sortBy(column.name)
      await expect(planetsPage.sortHeader(column.name)).toHaveAttribute("aria-sort", "descending")
      expect(await planetsPage.getColumnValues(column.column)).toStrictEqual(column.descending)
    }
  })

  await test.step("Open a Planet's system and profile from its coordinates", async () => {
    const firstRow = planetsPage.row(0)
    const planetName = await planetsPage.getPlanetName(firstRow)
    const coordinates = await planetsPage.getCoordinate(firstRow)
    const galaxyPage = await planetsPage.openCoordinate(firstRow)

    expect(GalaxyPage.urlPattern.test(alice.page.url())).toBe(true)
    expect(new URL(alice.page.url()).searchParams.has("planetId")).toBe(true)
    await expect(galaxyPage.starSystemMap).toBeVisible()
    await expect(galaxyPage.planetDetailsPane).toContainText(planetName)
    await expect(galaxyPage.planetDetailsPane).toContainText(coordinates)

    await galaxyPage.goBack()
    expect(PlanetsPage.urlPattern.test(alice.page.url())).toBe(true)
    await expect(planetsPage.heading).toBeVisible()
  })
})
