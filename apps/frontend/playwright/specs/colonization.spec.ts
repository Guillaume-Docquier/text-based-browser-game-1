import { Assert, Time, UnitOfTime } from "@guillaume-docquier/tools-ts"
import { expect, test } from "../fixtures.ts"
import { CreateGamePage } from "../pages/CreateGamePage.ts"
import { GalaxyPage } from "../pages/GalaxyPage.ts"
import { GameDetailsPage } from "../pages/GameDetailsPage.ts"

test("Colonize persists a successful owner and prevents a later saved competitor without loss or return", async ({ alice, bob }) => {
  test.setTimeout(360000)
  let winner = alice,
    loser = bob
  const details = await test.step("Create and join the seeded two-player Test game", async () =>
    await CreateGamePage.createGame({
      creator: alice,
      participants: [bob],
      settings: { maxPlayers: 2, turnLength: Time.create(1, UnitOfTime.DAYS) },
    }))
  await test.step("Start and assign roles from observed homes", async () => {
    await details.reload()
    const galaxy = await details.startGame()
    const participant = new GameDetailsPage(bob.page)
    await participant.reload()
    await participant.openGame()
    const view = await (await galaxy.openActions()).refreshPlayerView()
    const home = view.galaxy.systems.flatMap((system) => system.planets).find((planet) => planet.ownerPlayerId === view.player.id)
    Assert.isDefined(home)
    if (home.x < 50) [winner, loser] = [bob, alice]
  })
  await test.step("Fund both through Campaign and Extract Metal", async () => {
    for (const user of [winner, loser]) {
      const actions = await new GalaxyPage(user.page).openActions()
      await actions.toggleActionSelection("Political Campaign")
      await actions.toggleActionSelection("Extract Metal")
    }
    const right = await new GalaxyPage(winner.page).openPlayers(),
      left = await new GalaxyPage(loser.page).openPlayers()
    await right.toggleReady()
    await left.toggleReady()
    await expect(right.turn).toHaveText("Turn 2", { timeout: 15000 })
    await expect(left.turn).toHaveText("Turn 2", { timeout: 15000 })
    for (const page of [right, left]) {
      await expect(page.resource("Influence")).toHaveAttribute("aria-label", "7 available of 7 Influence")
      await expect(page.resource("Metal")).toHaveAttribute("aria-label", "7 available of 7 Metal")
    }
  })
  for (let turn = 2; turn <= 7; turn++)
    await test.step(`Normal funding and builds for Turn ${turn}`, async () => {
      for (const user of [winner, loser]) {
        const actions = await new GalaxyPage(user.page).openActions()
        if (turn <= 5) await actions.toggleActionSelection("Build Fleet", "Standard Directive")
        await actions.toggleActionSelection("Political Campaign")
      }
      const right = await new GalaxyPage(winner.page).openPlayers(),
        left = await new GalaxyPage(loser.page).openPlayers()
      await right.toggleReady()
      await left.toggleReady()
      await expect(right.turn).toHaveText(`Turn ${turn + 1}`, { timeout: 15000 })
      await expect(left.turn).toHaveText(`Turn ${turn + 1}`, { timeout: 15000 })
    })
  await test.step("Issue the right-side35 Colonize with configured cost, speed, range and required20", async () => {
    const actions = await new GalaxyPage(winner.page).openActions()
    await expect(actions.resource("Influence")).toHaveAttribute("aria-label", "29 available of 29 Influence")
    await expect(actions.action("Colonize Planet", "Standard Directive")).toContainText("10 light years per turn")
    await expect(actions.action("Colonize Planet", "Standard Directive")).toContainText("Range 25 light years")
    await expect(actions.action("Colonize Planet", "Standard Directive")).toContainText("consuming exactly 20 Strength")
    await expect(actions.actionCost("Colonize Planet", "25 Influence")).toBeVisible()
    await actions.searchTarget("Colonize Planet", "Standard Directive", "Planet", "35:35:40")
    await actions.chooseTarget("Planet", "35:35:40")
    await actions.setNumericInput("Colonize Planet", "Standard Directive", "Strength", "35")
    await actions.toggleActionSelection("Colonize Planet", "Standard Directive")
    const right = await actions.openPlayers(),
      left = await new GalaxyPage(loser.page).openPlayers()
    await right.toggleReady()
    await left.toggleReady()
    await expect(right.turn).toHaveText("Turn 9", { timeout: 15000 })
    await expect(left.turn).toHaveText("Turn 9", { timeout: 15000 })
  })
  await test.step("Reload the paid right journey and issue the later left competitor while target remains unclaimed", async () => {
    const fleets = await new GalaxyPage(winner.page).openFleets()
    await expect(fleets.remainingDistance(fleets.rowByStrength(35))).toHaveText("7.78 ly")
    await fleets.reload()
    await expect(fleets.remainingDistance(fleets.rowByStrength(35))).toHaveText("7.78 ly")
    const actions = await fleets.openActions()
    await expect(actions.action("Colonize Planet", "Standard Directive")).toContainText("In progress:")
    await expect(actions.selectActionButton("Colonize Planet", "Standard Directive")).toHaveCount(0)
    const journeyView = await actions.refreshPlayerView()
    expect(journeyView.actions.find((action) => action.id === "COLONIZE_PLANET_STANDARD_2")?.status).toBe("AVAILABLE")
    const competitor = await new GalaxyPage(loser.page).openActions()
    await competitor.searchTarget("Colonize Planet", "Standard Directive", "Planet", "35:35:40")
    await competitor.chooseTarget("Planet", "35:35:40")
    await competitor.setNumericInput("Colonize Planet", "Standard Directive", "Strength", "35")
    await competitor.toggleActionSelection("Colonize Planet", "Standard Directive")
    const right = await actions.openPlayers(),
      left = await competitor.openPlayers()
    await right.toggleReady()
    await left.toggleReady()
    await expect(right.turn).toHaveText("Turn 10", { timeout: 15000 })
    await expect(left.turn).toHaveText("Turn 10", { timeout: 15000 })
  })
  await test.step("Observe the new owner username on map and Owned planets while loser remains in progress", async () => {
    const fleets = await new GalaxyPage(winner.page).openFleets()
    await expect(fleets.strength(fleets.rowByStrength(15))).toHaveText("15")
    const galaxy = await fleets.openOriginPlanet(fleets.rowByStrength(15))
    await expect(galaxy.ownedPlanets).toContainText("planet 404958")
    await expect(galaxy.planet("planet 404958")).toHaveAttribute("aria-label", `View planet 404958 details, owned by ${winner.alias}`)
    const planets = await galaxy.openPlanets()
    await planets.search("35:35:40")
    await expect(planets.rows).toHaveCount(1)
    await expect(planets.ownerName(planets.row(0))).toHaveText(winner.alias)
    const losingFleets = await new GalaxyPage(loser.page).openFleets()
    await expect(losingFleets.remainingDistance(losingFleets.rowByStrength(35))).toHaveText("7.70 ly")
    await losingFleets.reload()
    await expect(losingFleets.remainingDistance(losingFleets.rowByStrength(35))).toHaveText("7.70 ly")
    const right = await planets.openPlayers(),
      left = await losingFleets.openPlayers()
    await right.toggleReady()
    await left.toggleReady()
    await expect(right.turn).toHaveText("Turn 11", { timeout: 15000 })
    await expect(left.turn).toHaveText("Turn 11", { timeout: 15000 })
  })
  await test.step("See both survivors, no journey or return, and released but unaffordable originals after prevention", async () => {
    for (const user of [winner, loser]) {
      const fleets = await new GalaxyPage(user.page).openFleets()
      await expect(fleets.rows).toHaveCount(4)
      await expect(fleets.strength(fleets.rowByStrength(15))).toHaveText("15")
      await expect(fleets.strength(fleets.rowByStrength(35))).toHaveText("35")
      await expect(fleets.strength(fleets.rowByOriginCoordinate("46:93:25"))).toHaveText("5")
      await expect(fleets.strength(fleets.rowByOriginCoordinate("44:96:25"))).toHaveText("5")
      await expect(fleets.remainingDistance(fleets.rowByStrength(15))).toHaveText("-")
      await expect(fleets.remainingDistance(fleets.rowByStrength(35))).toHaveText("-")
      await fleets.reload()
      await expect(fleets.rows).toHaveCount(4)
      const galaxy = await fleets.openOriginPlanet(fleets.rowByStrength(35))
      await expect(galaxy.fleetMarkerAtStrength(15)).toBeVisible()
      await expect(galaxy.fleetMarkerAtStrength(35)).toBeVisible()
      await expect(galaxy.planet("planet 404958")).toHaveAttribute("aria-label", `View planet 404958 details, owned by ${winner.alias}`)
      const actions = await galaxy.openActions()
      await expect(actions.selectActionButton("Colonize Planet", "Standard Directive")).toBeDisabled()
      for (const [resource, value] of [
        ["Influence", 4],
        ["Metal", 3],
        ["Fuel", 1],
        ["Colony", 0],
      ] as const)
        await expect(actions.resource(resource)).toHaveAttribute("aria-label", `${value} available of ${value} ${resource}`)
      const view = await actions.refreshPlayerView()
      expect(view.actions.find((action) => action.id === "COLONIZE_PLANET_STANDARD_1")?.status).toBe("AVAILABLE")
      expect(view.actions.find((action) => action.id === "COLONIZE_PLANET_STANDARD_1")?.inProgressFleetId).toBeUndefined()
    }
  })
})
