import { Assert, Time, UnitOfTime } from "@guillaume-docquier/tools-ts"
import { expect, test } from "../fixtures.ts"
import type { ActionsPage } from "../pages/ActionsPage.ts"
import { CreateGamePage } from "../pages/CreateGamePage.ts"
import type { FleetsPage } from "../pages/FleetsPage.ts"
import { GameDetailsPage } from "../pages/GameDetailsPage.ts"
import type { PlayersPage } from "../pages/PlayersPage.ts"

test("partial Attack Move survives worker turns, defeats a defender, updates the map, and releases its Action", async ({ alice, bob }) => {
  test.setTimeout(240000)

  const gameDetailsPage = await test.step("Create an authenticated two-player Test game at seed 147", async () =>
    await CreateGamePage.createGame({
      creator: alice,
      participants: [bob],
      settings: {
        maxPlayers: 2,
        turnLength: Time.create(1, UnitOfTime.DAYS),
        mapGenerationSeed: 147,
      },
    }))
  const aliceGalaxyPage = await test.step("Start the public game for both players", async () => {
    await gameDetailsPage.reload()
    return await gameDetailsPage.startGame()
  })
  const bobDetailsPage = new GameDetailsPage(bob.page)
  await bobDetailsPage.reload()
  const bobGalaxyPage = await bobDetailsPage.openGame()
  let alicePlayersPage = await aliceGalaxyPage.openPlayers()
  let bobPlayersPage = await bobGalaxyPage.openPlayers()

  const funded = await test.step("Build and fund Alice's 50-strength Fleet and Bob's 20-strength defender through Actions", async () =>
    await fundAssaultFleets({ alicePlayersPage, bobPlayersPage }))
  alicePlayersPage = funded.alicePlayersPage
  bobPlayersPage = funded.bobPlayersPage

  const aliceFleetsPage = await alicePlayersPage.openFleets()
  let bobFleetsPage = await bobPlayersPage.openFleets()
  await expect(aliceFleetsPage.rows).toHaveCount(2)
  await expect(bobFleetsPage.rows).toHaveCount(2)
  const stationaryRows = (await aliceFleetsPage.rowsByJourneyStatus()).stationary
  const stationaryFleetDetails = await Promise.all(
    stationaryRows.map(async (row) => ({
      row,
      strength: await aliceFleetsPage.getFleetStrength(row),
      coordinate: await aliceFleetsPage.getCoordinate(row),
    })),
  )
  const aliceSource = stationaryFleetDetails.find(({ strength }) => strength === "50")
  const bobDefender = stationaryFleetDetails.find(({ strength }) => strength === "20")
  Assert.isDefined(aliceSource)
  Assert.isDefined(bobDefender)
  await expect(aliceFleetsPage.fleetStrength(aliceSource.row)).toHaveText("50")
  await expect(aliceFleetsPage.fleetStrength(bobDefender.row)).toHaveText("20")
  const aliceHomeCoordinates = aliceSource.coordinate
  const bobHomeName = await aliceFleetsPage.getOriginPlanet(bobDefender.row)
  const bobHomeCoordinates = bobDefender.coordinate
  const bobDefenderName = (await aliceFleetsPage.fleetName(bobDefender.row).innerText()).trim()
  expect([aliceHomeCoordinates, bobHomeCoordinates].toSorted()).toStrictEqual(["44:98:05", "45:83:40"])
  const bobVisibleStrengths = await Promise.all(
    (await bobFleetsPage.rowsByJourneyStatus()).stationary.map(async (row) => await bobFleetsPage.getFleetStrength(row)),
  )
  expect(bobVisibleStrengths.toSorted()).toStrictEqual(["20", "50"])
  bobPlayersPage = await bobFleetsPage.openPlayers()

  const actionsPage = await test.step("Select a partial Attack Move against Bob's seeded home planet", async () =>
    await selectPartialAttackMove({ aliceFleetsPage, bobHomeCoordinates }))

  alicePlayersPage = await actionsPage.openPlayers()
  await finishTurn(alicePlayersPage, bobPlayersPage, 7)
  const aliceActionsPage = await alicePlayersPage.openActions()
  await expect(aliceActionsPage.journeySummary("Attack Move", "Standard Directive")).toContainText("30 strength")
  await expect(aliceActionsPage.journeySummary("Attack Move", "Standard Directive")).toContainText(bobHomeName)
  await expect(aliceActionsPage.journeySummary("Attack Move", "Standard Directive")).toContainText("3.42 ly remaining")
  await expect(aliceActionsPage.selectActionButton("Attack Move", "Standard Directive")).toHaveCount(0)
  await aliceActionsPage.reload()
  await expect(aliceActionsPage.journeySummary("Attack Move", "Standard Directive")).toContainText("3.42 ly remaining")

  const departureFleetsPage = await aliceActionsPage.openFleets()
  await expect(departureFleetsPage.rows).toHaveCount(3)
  const departureRows = await departureFleetsPage.rowsByJourneyStatus()
  expect(departureRows.moving).toHaveLength(1)
  expect(departureRows.stationary).toHaveLength(2)
  const movingRow = departureRows.moving[0]
  Assert.isDefined(movingRow)
  const movingFleetName = (await departureFleetsPage.fleetName(movingRow).innerText()).trim()
  await expect(departureFleetsPage.fleetStrength(movingRow)).toHaveText("30")
  await expect(departureFleetsPage.journeyLeft(movingRow)).toHaveText("3.42 ly")
  const stationedSummaries = await Promise.all(
    departureRows.stationary.map(async (row) => ({
      row,
      coordinate: await departureFleetsPage.getCoordinate(row),
      strength: await departureFleetsPage.getFleetStrength(row),
    })),
  )
  const sourceRemainder = stationedSummaries.find(({ coordinate, strength }) => coordinate === aliceHomeCoordinates && strength === "20")
  const visibleDefender = stationedSummaries.find(({ coordinate, strength }) => coordinate === bobHomeCoordinates && strength === "20")
  Assert.isDefined(sourceRemainder)
  Assert.isDefined(visibleDefender)
  await expect(departureFleetsPage.fleetStrength(sourceRemainder.row)).toHaveText("20")
  await expect(departureFleetsPage.fleetStrength(visibleDefender.row)).toHaveText("20")

  bobFleetsPage = await bobPlayersPage.openFleets()
  await expect(bobFleetsPage.rows).toHaveCount(3)
  await expect(bobFleetsPage.fleetStrength(bobFleetsPage.rowByFleetName(bobDefenderName))).toHaveText("20")

  alicePlayersPage = await departureFleetsPage.openPlayers()
  bobPlayersPage = await bobFleetsPage.openPlayers()
  for (const [nextTurn, remaining] of [
    [8, "2.42 ly"],
    [9, "1.42 ly"],
    [10, "0.42 ly"],
  ] as const) {
    await finishTurn(alicePlayersPage, bobPlayersPage, nextTurn)
    const fleetsPage = await alicePlayersPage.openFleets()
    await expect(fleetsPage.rows).toHaveCount(3)
    const rows = await fleetsPage.rowsByJourneyStatus()
    expect(rows.moving).toHaveLength(1)
    const journey = rows.moving[0]
    Assert.isDefined(journey)
    await expect(fleetsPage.fleetStrength(journey)).toHaveText("30")
    await expect(fleetsPage.journeyLeft(journey)).toHaveText(remaining)
    expect(rows.stationary).toHaveLength(2)
    const currentStationed = await Promise.all(
      rows.stationary.map(async (row) => ({
        row,
        coordinate: await fleetsPage.getCoordinate(row),
        strength: await fleetsPage.getFleetStrength(row),
      })),
    )
    const sourceRemainder = currentStationed.find(({ coordinate, strength }) => coordinate === aliceHomeCoordinates && strength === "20")
    const currentDefender = currentStationed.find(({ coordinate, strength }) => coordinate === bobHomeCoordinates && strength === "20")
    Assert.isDefined(sourceRemainder)
    Assert.isDefined(currentDefender)
    await expect(fleetsPage.fleetStrength(sourceRemainder.row)).toHaveText("20")
    await expect(fleetsPage.fleetStrength(currentDefender.row)).toHaveText("20")

    bobFleetsPage = await bobPlayersPage.openFleets()
    await expect(bobFleetsPage.rows).toHaveCount(3)
    await expect(bobFleetsPage.fleetStrength(bobFleetsPage.rowByFleetName(bobDefenderName))).toHaveText("20")
    alicePlayersPage = await fleetsPage.openPlayers()
    bobPlayersPage = await bobFleetsPage.openPlayers()
  }

  await finishTurn(alicePlayersPage, bobPlayersPage, 11)
  const arrivalFleetsPage = await alicePlayersPage.openFleets()
  await expect(arrivalFleetsPage.rows).toHaveCount(2)
  const arrivalRows = await arrivalFleetsPage.rowsByJourneyStatus()
  expect(arrivalRows.moving).toHaveLength(0)
  const arrivedSummaries = await Promise.all(
    arrivalRows.stationary.map(async (row) => ({
      row,
      coordinate: await arrivalFleetsPage.getCoordinate(row),
      strength: await arrivalFleetsPage.getFleetStrength(row),
    })),
  )
  const survivingSource = arrivedSummaries.find(({ coordinate, strength }) => coordinate === aliceHomeCoordinates && strength === "20")
  const survivingAttacker = arrivedSummaries.find(({ coordinate, strength }) => coordinate === bobHomeCoordinates && strength === "10")
  Assert.isDefined(survivingSource)
  Assert.isDefined(survivingAttacker)
  await expect(arrivalFleetsPage.fleetName(survivingAttacker.row)).toHaveText(movingFleetName)
  await expect(arrivalFleetsPage.fleetStrength(survivingSource.row)).toHaveText("20")
  await expect(arrivalFleetsPage.fleetStrength(survivingAttacker.row)).toHaveText("10")

  bobFleetsPage = await bobPlayersPage.openFleets()
  await expect(bobFleetsPage.rows.filter({ hasText: bobDefenderName })).toHaveCount(0)

  const arrivalActionsPage = await arrivalFleetsPage.openActions()
  await expect(arrivalActionsPage.journeySummary("Attack Move", "Standard Directive")).toHaveCount(0)
  await expect(arrivalActionsPage.selectActionButton("Attack Move", "Standard Directive")).toHaveText("Select action")
  expect(await arrivalActionsPage.openTargetPicker("Attack Move", "Standard Directive", "Fleet")).toBe(true)
  await arrivalActionsPage.searchTarget("Attack Move", "Standard Directive", "Fleet", { query: movingFleetName })
  const sourceChoice = (await arrivalActionsPage.targetOptionLabels("Fleet")).find((option) => option.endsWith("(20 strength)"))
  Assert.isDefined(sourceChoice)
  await arrivalActionsPage.chooseTarget("Fleet", sourceChoice)

  const planetPickerEnabled = await arrivalActionsPage.openTargetPicker("Attack Move", "Standard Directive", "Planet")
  if (planetPickerEnabled) {
    await arrivalActionsPage.searchTarget("Attack Move", "Standard Directive", "Planet", { query: bobHomeCoordinates })
    await expect(arrivalActionsPage.targetChoices("Planet").getByRole("option").first()).toBeVisible()
    const planetChoice = (await arrivalActionsPage.targetOptionLabels("Planet")).find((option) =>
      option.endsWith(`(${bobHomeCoordinates})`),
    )
    Assert.isDefined(planetChoice)
    await arrivalActionsPage.chooseTarget("Planet", planetChoice)
  } else {
    expect(await arrivalActionsPage.selectedTargetValue("Attack Move", "Standard Directive", "Planet")).toContain(bobHomeCoordinates)
  }
  await arrivalActionsPage.enterNumericInput("Attack Move", "Standard Directive", "Fleet strength", { value: 1 })
  await expect(arrivalActionsPage.action("Attack Move", "Standard Directive")).toContainText(
    "19 of 20 strength available after this allocation",
  )
  await expect(arrivalActionsPage.selectActionButton("Attack Move", "Standard Directive")).toBeEnabled()
  await arrivalActionsPage.toggleActionSelection("Attack Move", "Standard Directive")
  await expect(arrivalActionsPage.selectActionButton("Attack Move", "Standard Directive")).toHaveText("Update action")

  const arrivalGalaxyPage = await bobFleetsPage.openGalaxy()
  await arrivalGalaxyPage.openStarSystem(arrivalGalaxyPage.ownStar("last"))
  await expect(arrivalGalaxyPage.starSystemMap).toBeVisible()
  const bobHome = arrivalGalaxyPage.planet(bobHomeName)
  await expect(bobHome).toBeVisible()
  const markers = arrivalGalaxyPage.fleetMarkersOnPlanet(bobHome)
  await expect(markers).toHaveCount(1)
  await expect(arrivalGalaxyPage.fleetStrength(markers)).toHaveText("10")
})

async function finishTurn(alice: PlayersPage, bob: PlayersPage, nextTurn: number): Promise<void> {
  await alice.toggleReady()
  await bob.toggleReady()
  await expect(alice.turn).toHaveText(`Turn ${nextTurn}`, { timeout: 30000 })
  await expect(bob.turn).toHaveText(`Turn ${nextTurn}`, { timeout: 30000 })
}

type AssaultFundingPages = { alicePlayersPage: PlayersPage; bobPlayersPage: PlayersPage }
async function fundAssaultFleets({ alicePlayersPage, bobPlayersPage }: AssaultFundingPages): Promise<AssaultFundingPages> {
  for (let turn = 1; turn <= 5; turn += 1) {
    const aliceActionsPage = await alicePlayersPage.openActions()
    await aliceActionsPage.toggleActionSelection("Build Fleet", "Standard Directive")
    await aliceActionsPage.toggleActionSelection("Political Campaign")
    if (turn === 1 || turn === 4) {
      await aliceActionsPage.toggleActionSelection("Extract Metal")
    }
    if (turn === 5) {
      await aliceActionsPage.toggleActionSelection("Refine Fuel")
    }

    const bobActionsPage = await bobPlayersPage.openActions()
    if (turn <= 2) {
      await bobActionsPage.toggleActionSelection("Build Fleet", "Standard Directive")
      await bobActionsPage.toggleActionSelection("Political Campaign")
    }

    alicePlayersPage = await aliceActionsPage.openPlayers()
    bobPlayersPage = await bobActionsPage.openPlayers()
    await finishTurn(alicePlayersPage, bobPlayersPage, turn + 1)
  }
  return { alicePlayersPage, bobPlayersPage }
}
async function selectPartialAttackMove({
  aliceFleetsPage,
  bobHomeCoordinates,
}: {
  aliceFleetsPage: FleetsPage
  bobHomeCoordinates: string
}): Promise<ActionsPage> {
  const page = await aliceFleetsPage.openActions()
  const sourceChoice = await page.chooseFirstTarget("Attack Move", "Standard Directive", "Fleet")
  expect(sourceChoice).toContain("(50 strength)")
  const planetPickerEnabled = await page.openTargetPicker("Attack Move", "Standard Directive", "Planet")
  if (planetPickerEnabled) {
    await page.searchTarget("Attack Move", "Standard Directive", "Planet", { query: bobHomeCoordinates })
    await expect(page.targetChoices("Planet").getByRole("option").first()).toBeVisible()

    const planetChoice = (await page.targetOptionLabels("Planet")).find((option) => option.endsWith(`(${bobHomeCoordinates})`))
    Assert.isDefined(planetChoice)
    await page.chooseTarget("Planet", planetChoice)
  } else {
    expect(await page.selectedTargetValue("Attack Move", "Standard Directive", "Planet")).toContain(bobHomeCoordinates)
  }
  await page.enterNumericInput("Attack Move", "Standard Directive", "Fleet strength", { value: 30 })
  await expect(page.action("Attack Move", "Standard Directive")).toContainText("On arrival, join friendly fleets")
  await expect(page.action("Attack Move", "Standard Directive")).toContainText("5 Influence")
  await expect(page.action("Attack Move", "Standard Directive")).toContainText("1 Fuel")
  await expect(page.actionInput("Attack Move", "Standard Directive", "Fleet strength")).toHaveValue("30")
  await expect(page.action("Attack Move", "Standard Directive")).toContainText("20 of 50 strength available after this allocation")
  await expect(page.selectActionButton("Attack Move", "Standard Directive")).toBeEnabled()
  await page.toggleActionSelection("Attack Move", "Standard Directive")
  await expect(page.selectActionButton("Attack Move", "Standard Directive")).toHaveText("Update action")
  return page
}
