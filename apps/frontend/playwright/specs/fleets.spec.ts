import { Assert, Time, UnitOfTime } from "@guillaume-docquier/tools-ts"
import { expect, test } from "../fixtures.ts"
import { CreateGamePage } from "../pages/CreateGamePage.ts"
import { FleetsPage } from "../pages/FleetsPage.ts"
import { GalaxyPage } from "../pages/GalaxyPage.ts"
import { GameDetailsPage } from "../pages/GameDetailsPage.ts"
import type { PlayersPage } from "../pages/PlayersPage.ts"

test("fleet origin and destination links open their planets in the galaxy view", async ({ alice: aliceFixture, bob: bobFixture }) => {
  let traveler = aliceFixture
  let opponent = bobFixture
  test.setTimeout(300000)
  const creatorGameDetailsPage = await test.step("Create a game", async () =>
    await CreateGamePage.createGame({
      creator: traveler,
      participants: [opponent],
      settings: { maxPlayers: 2, turnLength: Time.create(1, UnitOfTime.DAYS) },
    }))
  let travelerGalaxyPage = await test.step("Start the game", async () => {
    await creatorGameDetailsPage.reload()
    return await creatorGameDetailsPage.startGame()
  })
  let opponentPlayersPage = await test.step("Open the game for the participant", async () => {
    const opponentGameDetailsPage = new GameDetailsPage(opponent.page)
    await opponentGameDetailsPage.reload()
    const opponentGalaxyPage = await opponentGameDetailsPage.openGame()
    return await opponentGalaxyPage.openPlayers()
  })

  await test.step("Assign traveler role from the observed seeded home", async () => {
    const creatorActions = await travelerGalaxyPage.openActions()
    const view = await creatorActions.refreshPlayerView()
    const home = view.galaxy.systems.flatMap((system) => system.planets).find((planet) => planet.ownerPlayerId === view.player.id)
    Assert.isDefined(home)
    // Account UUID order can swap homes. The right-side traveler keeps the literal route/distance oracles below.
    if (home.x < 50) {
      const participantGalaxy = await opponentPlayersPage.openGalaxy()
      opponentPlayersPage = await creatorActions.openPlayers()
      travelerGalaxyPage = participantGalaxy
      ;[traveler, opponent] = [opponent, traveler]
    } else {
      travelerGalaxyPage = await creatorActions.openGalaxy()
    }
    const travelerActions = await travelerGalaxyPage.openActions()
    const travelerView = await travelerActions.refreshPlayerView()
    const travelerHome = travelerView.galaxy.systems
      .flatMap((system) => system.planets)
      .find((planet) => planet.ownerPlayerId === travelerView.player.id)
    Assert.isDefined(travelerHome)
    expect(travelerHome.x).toBeGreaterThan(50)
    travelerGalaxyPage = await travelerActions.openGalaxy()
  })

  await test.step("Fund the later build and fuel through an ordinary action", async () => {
    await fundTraveler({ travelerGalaxyPage, opponentPlayersPage })
  })

  const travelerFleetsPage = await test.step("Build a fleet and finish the turn", async () =>
    await buildTraveler({ travelerGalaxyPage, opponentPlayersPage }))

  const originPlanetName = await test.step("Open the fleet's origin planet and return to Fleets", async () => {
    const row = travelerFleetsPage.rowByStrength(10)
    const name = await travelerFleetsPage.getOriginPlanet(row)
    const coordinates = await travelerFleetsPage.getCoordinate(row)
    const travelerOriginGalaxyPage = await travelerFleetsPage.openOriginPlanet(row)
    expect(GalaxyPage.urlPattern.test(traveler.page.url())).toBe(true)
    await expect(travelerOriginGalaxyPage.starSystemMap).toBeVisible()
    await expect(travelerOriginGalaxyPage.planetDetailsPane).toContainText(name)
    await expect(travelerOriginGalaxyPage.planetDetailsPane).toContainText(coordinates)
    await travelerOriginGalaxyPage.goBack()
    expect(FleetsPage.urlPattern.test(traveler.page.url())).toBe(true)
    await expect(travelerFleetsPage.heading).toBeVisible()
    return name
  })

  const destinationPlanetName = await test.step("Choose the fixed in-range nonorigin planet", async () => {
    const actions = await travelerFleetsPage.openActions()
    await actions.searchTarget("Move Fleet", "Improved Directive", "Planet", "56:07:50")
    const name = await actions.getTargetName("Planet", "56:07:50")
    expect(name).not.toBe(originPlanetName)
    await actions.chooseTarget("Planet", "56:07:50")
    return name
  })

  await test.step("Send the fleet toward a destination and finish the turn", async () => {
    const travelerActionsPage = await travelerFleetsPage.openActions()
    await travelerActionsPage.searchTarget("Move Fleet", "Improved Directive", "Planet", destinationPlanetName)
    await travelerActionsPage.chooseTarget("Planet", destinationPlanetName)
    await travelerActionsPage.setNumericInput("Move Fleet", "Improved Directive", "Strength", "4")
    const submission = traveler.page.waitForResponse((response) => response.url().includes("gameplay.updateActionSubmission"))
    await travelerActionsPage.toggleActionSelection("Move Fleet", "Improved Directive")
    const submitted = await submission
    expect(submitted.ok(), JSON.stringify(await submitted.json())).toBe(true)
    await expect(travelerActionsPage.selectActionButton("Move Fleet", "Improved Directive")).toHaveAttribute("aria-pressed", "true", {
      timeout: 30000,
    })
    const travelerPlayersPage = await travelerActionsPage.openPlayers()
    await travelerPlayersPage.toggleReady()
    await opponentPlayersPage.toggleReady()
    await expect(travelerPlayersPage.turn).toHaveText("Turn 4", { timeout: 15000 })
    await expect(opponentPlayersPage.turn).toHaveText("Turn 4", { timeout: 15000 })
    await travelerPlayersPage.openFleets()
  })

  await test.step("Open the destination planet in the galaxy view", async () => {
    await expect(travelerFleetsPage.strength(travelerFleetsPage.rowByStrength(6))).toHaveText("6")
    await expect(travelerFleetsPage.remainingDistance(travelerFleetsPage.rowByStrength(4))).toHaveText("3.77 ly")
    const row = travelerFleetsPage.rowByStrength(4)
    const destinationLink = travelerFleetsPage.destinationPlanetLink(row)
    await expect(destinationLink).toContainText(destinationPlanetName)
    const destinationUrl = await destinationLink.getAttribute("href")
    const aliceDestinationGalaxyPage = await travelerFleetsPage.openDestinationPlanet(row)
    expect(GalaxyPage.urlPattern.test(traveler.page.url())).toBe(true)
    expect(new URL(traveler.page.url()).pathname + new URL(traveler.page.url()).search).toBe(destinationUrl)
    await expect(aliceDestinationGalaxyPage.starSystemMap).toBeVisible()
    await expect(aliceDestinationGalaxyPage.planetDetailsPane).toContainText(destinationPlanetName)
    await expect(aliceDestinationGalaxyPage.fleetStrength(aliceDestinationGalaxyPage.fleetMarkerAtStrength(4))).toHaveText("4")
    const fleets = await aliceDestinationGalaxyPage.openFleets()
    const originView = await fleets.openOriginPlanet(fleets.rowByStrength(6))
    await expect(originView.fleetStrength(originView.fleetMarkerAtStrength(6))).toHaveText("6")
  })

  await test.step("Reload the bound journey and finish its next turn without another order", async () => {
    const fleets = await new GalaxyPage(traveler.page).openFleets()
    await fleets.reload()
    await expect(fleets.remainingDistance(fleets.rowByStrength(4))).toHaveText("3.77 ly")
    const actions = await fleets.openActions()
    await expect(actions.action("Move Fleet", "Improved Directive")).toContainText("In progress:")
    await expect(actions.selectActionButton("Move Fleet", "Improved Directive")).toHaveCount(0)
    await expect(actions.resource("Fuel")).toHaveAttribute("aria-label", "3 available of 3 Fuel")
    for (const expected of [
      { turn: "Turn 5", distance: "2.77 ly" },
      { turn: "Turn 6", distance: "1.77 ly" },
      { turn: "Turn 7", distance: "0.77 ly" },
      { turn: "Turn 8", distance: "-" },
    ]) {
      const players = await new FleetsPage(traveler.page).openPlayers()
      await players.toggleReady()
      await opponentPlayersPage.toggleReady()
      await expect(players.turn).toHaveText(expected.turn, { timeout: 15000 })
      await expect(opponentPlayersPage.turn).toHaveText(expected.turn, { timeout: 15000 })
      const advanced = await players.openFleets()
      await expect(advanced.remainingDistance(advanced.rowByStrength(4))).toHaveText(expected.distance)
      await expect(advanced.strength(advanced.rowByStrength(6))).toHaveText("6")
      const current = await advanced.openActions()
      await expect(current.resource("Fuel")).toHaveAttribute("aria-label", "3 available of 3 Fuel")
      if (expected.distance === "-")
        await expect(current.selectActionButton("Move Fleet", "Improved Directive")).toHaveText("Select action")
      else {
        await expect(current.action("Move Fleet", "Improved Directive")).toContainText("In progress:")
        await expect(current.selectActionButton("Move Fleet", "Improved Directive")).toHaveCount(0)
      }
    }
  })
})

type TravelerFunding = Readonly<{
  opponentPlayersPage: PlayersPage
  travelerGalaxyPage: GalaxyPage
}>

async function fundTraveler({ travelerGalaxyPage, opponentPlayersPage }: TravelerFunding): Promise<void> {
  const actions = await travelerGalaxyPage.openActions()
  await actions.toggleActionSelection("Political Campaign")
  await actions.toggleActionSelection("Extract Metal")
  const opponentActions = await opponentPlayersPage.openActions()
  await opponentActions.toggleActionSelection("Political Campaign")
  await opponentActions.toggleActionSelection("Extract Metal")
  await opponentActions.openPlayers()
  const players = await actions.openPlayers()
  await players.toggleReady()
  await opponentPlayersPage.toggleReady()
  await expect(players.turn).toHaveText("Turn 2", { timeout: 15000 })
  await expect(opponentPlayersPage.turn).toHaveText("Turn 2", { timeout: 15000 })
}

async function buildTraveler({ travelerGalaxyPage, opponentPlayersPage }: TravelerFunding): Promise<FleetsPage> {
  const travelerActionsPage = await travelerGalaxyPage.openActions()
  await travelerActionsPage.toggleActionSelection("Build Fleet", "Standard Directive")
  await travelerActionsPage.toggleActionSelection("Political Campaign")
  await travelerActionsPage.toggleActionSelection("Refine Fuel")
  const opponentActions = await opponentPlayersPage.openActions()
  await opponentActions.toggleActionSelection("Build Fleet", "Improved Directive")
  await opponentActions.openPlayers()
  const travelerPlayersPage = await travelerActionsPage.openPlayers()
  await travelerPlayersPage.toggleReady()
  await opponentPlayersPage.toggleReady()
  await expect(travelerPlayersPage.turn).toHaveText("Turn 3", { timeout: 15000 })
  await expect(opponentPlayersPage.turn).toHaveText("Turn 3", { timeout: 15000 })
  return await travelerPlayersPage.openFleets()
}
