import { Assert } from "@guillaume-docquier/tools-ts"
import { expect, test } from "../fixtures.ts"
import { CreateGamePage } from "../pages/CreateGamePage.ts"
import { GalaxyPage } from "../pages/GalaxyPage.ts"
import { LobbyPage } from "../pages/LobbyPage.ts"
import { PlanetsPage } from "../pages/PlanetsPage.ts"

const DETERMINISTIC_GALAXY_SEED = 1234

test("compares owned Planets and opens one in the Galaxy", async ({ alice, bob }) => {
  const aliceLobbyPage = await test.step("Alice creates a two-player game", async () => {
    const createGamePage = await CreateGamePage.goto(alice.page, { mapGenerationSeed: DETERMINISTIC_GALAXY_SEED })
    await createGamePage.setGameName(`Planet overview ${Date.now()}`)
    await createGamePage.setMaxPlayers(2)
    await createGamePage.selectRuleset("Test")
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

  await test.step("Default to Alice's owned Planets without a details pane or pagination", async () => {
    await expect(planetsPage.heading).toBeVisible()
    await expect(planetsPage.mineView).toHaveAttribute("aria-pressed", "true")
    await expect(planetsPage.allPlayersView).toHaveAttribute("aria-pressed", "false")
    await expect(planetsPage.rows).toHaveCount(1)
    await expect(planetsPage.ownerName(planetsPage.row(0))).toHaveText("You")
    await expect(planetsPage.detailsPane).toHaveCount(0)
    await expect(planetsPage.paginationControls).toHaveCount(0)
  })

  await test.step("Show all and only player-owned Planets in Planet-name order", async () => {
    await planetsPage.showAllPlayers()
    await expect(planetsPage.rows).toHaveCount(2)
    await expect(planetsPage.sortHeader("Planet")).toHaveAttribute("aria-sort", "ascending")

    const planetNames = await planetsPage.getColumnValues(0)
    expect(planetNames).toStrictEqual(planetNames.toSorted((first, second) => first.localeCompare(second)))

    const ownerNames = await planetsPage.getColumnValues(1)
    expect(ownerNames).toContain("You")
    expect(ownerNames).not.toContain("Unclaimed")
  })

  await test.step("Filter owned Planets by owner, name, and coordinates", async () => {
    const ownerNames = await planetsPage.getColumnValues(1)
    const opponentName = ownerNames.find((name) => name !== "You")
    Assert.isDefined(opponentName)

    await planetsPage.selectOwner(opponentName)
    await expect(planetsPage.rows).toHaveCount(1)
    await expect(planetsPage.ownerName(planetsPage.row(0))).toHaveText(opponentName)
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
    const columns = ["Planet", "Owner", "Coordinates", "Fertility", "Metal", "Fuel", "Energy", "Max population", "Area"]

    for (const column of columns) {
      await planetsPage.sortBy(column)
      await expect(planetsPage.sortHeader(column)).toHaveAttribute("aria-sort", column === "Planet" ? "descending" : "ascending")
      await planetsPage.sortBy(column)
      await expect(planetsPage.sortHeader(column)).toHaveAttribute("aria-sort", column === "Planet" ? "ascending" : "descending")
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

    await planetsPage.returnFromGalaxy()
    expect(PlanetsPage.urlPattern.test(alice.page.url())).toBe(true)
    await expect(planetsPage.heading).toBeVisible()
  })
})
