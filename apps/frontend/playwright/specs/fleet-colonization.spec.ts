import { Assert, Time, UnitOfTime } from "@guillaume-docquier/tools-ts"
import type { Page, TestInfo } from "@playwright/test"
import { expect, test } from "../fixtures.ts"
import type { ActionsPage } from "../pages/ActionsPage.ts"
import { CreateGamePage } from "../pages/CreateGamePage.ts"
import { GameDetailsPage } from "../pages/GameDetailsPage.ts"
import type { PlayersPage } from "../pages/PlayersPage.ts"

test("Colonize Planet claims a natural-route target and consumes only 20 strength", async ({ alice }, testInfo) => {
  test.setTimeout(300000)
  const gameDetailsPage = await test.step("Create Alice's authenticated one-player game at the pinned map seed", async () =>
    await CreateGamePage.createGame({
      creator: alice,
      settings: {
        maxPlayers: 2,
        turnLength: Time.create(1, UnitOfTime.DAYS),
        mapGenerationSeed: 1234,
      },
    }))
  const galaxyPage = await test.step("Start the game and confirm the generated route", async () => {
    const page = await gameDetailsPage.startGame()
    const planetsPage = await page.openPlanets()
    const home = planetsPage.row(0)
    await expect(planetsPage.rows).toHaveCount(1)
    await expect(planetsPage.planetName(home)).toHaveText("planet 278494")
    await expect(planetsPage.coordinate(home)).toHaveText("45:98:30")
    return page
  })
  let actionsPage = await galaxyPage.openActions()

  await test.step("Publicly build Fleet 50 and fund one colonization payment", async () => {
    for (let turn = 1; turn <= 5; turn += 1) {
      await actionsPage.toggleActionSelection("Build Fleet", "Standard Directive")
      await actionsPage.toggleActionSelection("Political Campaign")
      if (turn === 1) {
        await actionsPage.toggleActionSelection("Extract Metal")
      }
      actionsPage = await finishSoloTurn(actionsPage, turn + 1)
    }
    for (const nextTurn of [7, 8]) {
      await actionsPage.toggleActionSelection("Political Campaign")
      actionsPage = await finishSoloTurn(actionsPage, nextTurn)
    }
    await expect(actionsPage.resource("Influence")).toHaveAttribute("aria-label", "27 available of 27 Influence")
    await expect(actionsPage.resource("Metal")).toHaveAttribute("aria-label", "2 available of 2 Metal")
    await expect(actionsPage.resource("Fuel")).toHaveAttribute("aria-label", "1 available of 1 Fuel")
    await expect(actionsPage.resource("Colony")).toHaveAttribute("aria-label", "0 available of 0 Colony")
  })

  await test.step("Select Colonize Planet 35 for the pinned neutral Planet", async () => {
    const fleetChoice = await actionsPage.chooseFirstTarget("Colonize Planet", "Exceptional Directive", "Fleet")
    expect(fleetChoice).toContain("(50 strength)")
    await selectPlanetTarget(actionsPage, "Colonize Planet", "Exceptional Directive", "planet 684163", "55:07:50")
    await actionsPage.enterNumericInput("Colonize Planet", "Exceptional Directive", "Fleet strength", 35)
    await expect(actionsPage.action("Colonize Planet", "Exceptional Directive")).toContainText("25 Influence")
    await expect(actionsPage.actionInput("Colonize Planet", "Exceptional Directive", "Fleet strength")).toHaveValue("35")
    await expect(actionsPage.selectActionButton("Colonize Planet", "Exceptional Directive")).toBeEnabled()
    await actionsPage.toggleActionSelection("Colonize Planet", "Exceptional Directive")
    await expect(actionsPage.selectActionButton("Colonize Planet", "Exceptional Directive")).toHaveText("Update action")
    await expect(actionsPage.resource("Influence")).toHaveAttribute("aria-label", "2 available of 27 Influence")
    actionsPage = await finishSoloTurn(actionsPage, 9)
  })

  await test.step("Reload and inspect the locked 35-strength journey and 15-strength source remainder", async () => {
    await expect(actionsPage.journeySummary("Colonize Planet", "Exceptional Directive")).toContainText("35 strength")
    await expect(actionsPage.journeySummary("Colonize Planet", "Exceptional Directive")).toContainText("planet 684163")
    await expect(actionsPage.journeySummary("Colonize Planet", "Exceptional Directive")).toContainText("0.15 ly remaining")
    await expect(actionsPage.selectActionButton("Colonize Planet", "Exceptional Directive")).toHaveCount(0)
    const fleetsPage = await actionsPage.openFleets()
    await expect(fleetsPage.rows).toHaveCount(2)
    const rows = await fleetsPage.rowsByJourneyStatus()
    expect(rows.moving).toHaveLength(1)
    expect(rows.stationary).toHaveLength(1)
    await expect(fleetsPage.fleetStrength(rows.moving[0])).toHaveText("35")
    await expect(fleetsPage.journeyLeft(rows.moving[0])).toHaveText("0.15 ly")
    await expect(fleetsPage.fleetStrength(rows.stationary[0])).toHaveText("15")
    await captureScreenshot(alice.page, testInfo, "colonization-pending-35-and-remainder-15.png")
    actionsPage = await fleetsPage.openActions()
    await actionsPage.reload()
    await expect(actionsPage.journeySummary("Colonize Planet", "Exceptional Directive")).toContainText("0.15 ly remaining")
    actionsPage = await finishSoloTurn(actionsPage, 10)
  })

  await test.step("Verify the owner and both 15-strength Fleets in the live views", async () => {
    await expect(actionsPage.journeySummary("Colonize Planet", "Exceptional Directive")).toHaveCount(0)
    await expect(actionsPage.selectActionButton("Colonize Planet", "Exceptional Directive")).toHaveText("Select action")
    await expect(actionsPage.resource("Influence")).toHaveAttribute("aria-label", "2 available of 2 Influence")
    const planetsPage = await actionsPage.openPlanets()
    await planetsPage.search("planet 684163")
    await expect(planetsPage.rows).toHaveCount(1)
    const claimedPlanetRow = planetsPage.row(0)
    await expect(planetsPage.planetName(claimedPlanetRow)).toHaveText("planet 684163")
    await expect(planetsPage.coordinate(claimedPlanetRow)).toHaveText("55:07:50")
    await expect(planetsPage.ownerName(claimedPlanetRow)).toHaveText(alice.alias)
    const claimedGalaxyPage = await planetsPage.openCoordinate(claimedPlanetRow)
    const selectedPlanet = claimedGalaxyPage.planet("planet 684163")
    await expect(claimedGalaxyPage.planetOwnershipLabel(selectedPlanet)).toHaveText(alice.alias)
    await expect(claimedGalaxyPage.planetDetailsPane).toContainText(alice.alias)
    await expect(claimedGalaxyPage.fleetMarkersOnPlanet(selectedPlanet)).toHaveCount(1)
    await expect(claimedGalaxyPage.fleetStrength(claimedGalaxyPage.fleetMarkersOnPlanet(selectedPlanet))).toHaveText("15")
    await captureScreenshot(alice.page, testInfo, "colonization-owner-alice-fleet-15.png")

    const fleetsPage = await claimedGalaxyPage.openFleets()
    await expect(fleetsPage.rows).toHaveCount(2)
    const stationaryRows = (await fleetsPage.rowsByJourneyStatus()).stationary
    const stationed = await Promise.all(
      stationaryRows.map(async (row) => ({
        strength: await fleetsPage.getFleetStrength(row),
        coordinate: await fleetsPage.getCoordinate(row),
      })),
    )
    expect(stationed).toHaveLength(2)
    expect(stationed).toContainEqual({ strength: "15", coordinate: "45:98:30" })
    expect(stationed).toContainEqual({ strength: "15", coordinate: "55:07:50" })
    await expect(fleetsPage.resource("Colony")).toHaveAttribute("aria-label", "0 available of 0 Colony")
    await captureScreenshot(alice.page, testInfo, "colonization-claimed-fleets-15.png")
  })
})

test("an explicit Assault can prevent an otherwise eligible Colonize action at 19 strength", async ({ alice, bob }, testInfo) => {
  test.setTimeout(360000)
  const aliceGalaxyPage = await test.step("Create the pinned two-player game and start it", async () => {
    const page = await CreateGamePage.createGame({
      creator: alice,
      participants: [bob],
      settings: {
        maxPlayers: 2,
        turnLength: Time.create(1, UnitOfTime.DAYS),
        mapGenerationSeed: 1,
      },
    })
    await page.reload()
    return await page.startGame()
  })
  const bobGameDetailsPage = new GameDetailsPage(bob.page)
  await bobGameDetailsPage.reload()
  const bobGalaxyPage = await bobGameDetailsPage.openGame()

  const alicePlanetsPage = await aliceGalaxyPage.openPlanets()
  await alicePlanetsPage.search("planet 352230")
  await expect(alicePlanetsPage.rows).toHaveCount(1)
  const targetNearHome = alicePlanetsPage.row(0)
  await expect(alicePlanetsPage.planetName(targetNearHome)).toHaveText("planet 352230")
  await expect(alicePlanetsPage.coordinate(targetNearHome)).toHaveText("56:10:20")
  const targetNearHomeOwner = (await alicePlanetsPage.ownerName(targetNearHome).innerText()).trim()
  await alicePlanetsPage.search("planet 251588")
  await expect(alicePlanetsPage.rows).toHaveCount(1)
  const targetFarHome = alicePlanetsPage.row(0)
  await expect(alicePlanetsPage.planetName(targetFarHome)).toHaveText("planet 251588")
  await expect(alicePlanetsPage.coordinate(targetFarHome)).toHaveText("54:00:40")
  const targetFarHomeOwner = (await alicePlanetsPage.ownerName(targetFarHome).innerText()).trim()
  expect(targetNearHomeOwner).not.toBe(targetFarHomeOwner)
  const colonizerIsAlice = targetNearHomeOwner === alice.alias && targetFarHomeOwner === bob.alias
  const colonizerIsBob = targetNearHomeOwner === bob.alias && targetFarHomeOwner === alice.alias
  expect(colonizerIsAlice || colonizerIsBob).toBe(true)

  const aliceActionsPage = await alicePlanetsPage.openActions()
  const bobActionsPage = await bobGalaxyPage.openActions()

  const colonizerUser = colonizerIsAlice ? alice : bob
  const attackerUser = colonizerIsAlice ? bob : alice
  let colonizerActionsPage: ActionsPage = colonizerIsAlice ? aliceActionsPage : bobActionsPage
  let attackerActionsPage: ActionsPage = colonizerIsAlice ? bobActionsPage : aliceActionsPage

  await test.step("Build and fund the colonizing and Assault Fleets through public Actions", async () => {
    for (let turn = 1; turn <= 10; turn += 1) {
      if (turn <= 5) {
        await colonizerActionsPage.toggleActionSelection("Build Fleet", "Standard Directive")
        await colonizerActionsPage.toggleActionSelection("Political Campaign")
        if (turn === 1) {
          await colonizerActionsPage.toggleActionSelection("Extract Metal")
        }
      } else {
        await colonizerActionsPage.toggleActionSelection("Political Campaign")
      }

      if (turn === 1) {
        await attackerActionsPage.toggleActionSelection("Political Campaign")
        await attackerActionsPage.toggleActionSelection("Extract Metal")
      }
      if (turn === 2) {
        await attackerActionsPage.toggleActionSelection("Build Fleet", "Improved Directive")
        await attackerActionsPage.toggleActionSelection("Political Campaign")
      }
      if (turn === 3) {
        await attackerActionsPage.toggleActionSelection("Refine Fuel")
        await attackerActionsPage.toggleActionSelection("Political Campaign")
      }
      if (turn === 4) {
        const sourceChoice = await attackerActionsPage.chooseFirstTarget("Move Fleet", "Exceptional Directive", "Fleet")
        expect(sourceChoice).toContain("(100 strength)")
        await selectPlanetTarget(attackerActionsPage, "Move Fleet", "Exceptional Directive", "planet 649967", "55:19:10")
        await attackerActionsPage.enterNumericInput("Move Fleet", "Exceptional Directive", "Fleet strength", 16)
        await expect(attackerActionsPage.actionInput("Move Fleet", "Exceptional Directive", "Fleet strength")).toHaveValue("16")
        await expect(attackerActionsPage.selectActionButton("Move Fleet", "Exceptional Directive")).toBeEnabled()
        await attackerActionsPage.toggleActionSelection("Move Fleet", "Exceptional Directive")
      }

      ;[colonizerActionsPage, attackerActionsPage] = await finishBothTurns(colonizerActionsPage, attackerActionsPage, turn + 1)
    }
    await expect(colonizerActionsPage.resource("Influence")).toHaveAttribute("aria-label", "42 available of 42 Influence")
    const bobFleetsPage = await attackerActionsPage.openFleets()
    await expect(bobFleetsPage.rows).toHaveCount(3)
    const bobFleets = await Promise.all(
      (await bobFleetsPage.rowsByJourneyStatus()).stationary.map(async (row) => ({
        owner: await bobFleetsPage.getOwnerName(row),
        strength: await bobFleetsPage.getFleetStrength(row),
        origin: await bobFleetsPage.getOriginPlanet(row),
        coordinate: await bobFleetsPage.getCoordinate(row),
      })),
    )
    expect(bobFleets).toHaveLength(3)
    expect(bobFleets).toContainEqual({
      owner: colonizerUser.alias,
      strength: "50",
      origin: "planet 352230",
      coordinate: "56:10:20",
    })
    expect(bobFleets).toContainEqual({
      owner: attackerUser.alias,
      strength: "16",
      origin: "planet 649967",
      coordinate: "55:19:10",
    })
    expect(bobFleets).toContainEqual({
      owner: attackerUser.alias,
      strength: "84",
      origin: "planet 251588",
      coordinate: "54:00:40",
    })
    attackerActionsPage = await bobFleetsPage.openActions()
  })

  await test.step("Send 35 strength from the colonizing player's 50-strength Fleet to the unclaimed Planet", async () => {
    const fleetChoice = await colonizerActionsPage.chooseFirstTarget("Colonize Planet", "Exceptional Directive", "Fleet")
    expect(fleetChoice).toContain("(50 strength)")
    await selectPlanetTarget(colonizerActionsPage, "Colonize Planet", "Exceptional Directive", "planet 649967", "55:19:10")
    await colonizerActionsPage.enterNumericInput("Colonize Planet", "Exceptional Directive", "Fleet strength", 35)
    await expect(colonizerActionsPage.resource("Influence")).toHaveAttribute("aria-label", "42 available of 42 Influence")
    await colonizerActionsPage.toggleActionSelection("Colonize Planet", "Exceptional Directive")
    await expect(colonizerActionsPage.resource("Influence")).toHaveAttribute("aria-label", "17 available of 42 Influence")
    await colonizerActionsPage.toggleActionSelection("Political Campaign")
    ;[colonizerActionsPage, attackerActionsPage] = await finishBothTurns(colonizerActionsPage, attackerActionsPage, 12)
    await expect(colonizerActionsPage.journeySummary("Colonize Planet", "Exceptional Directive")).toContainText("35 strength")
    await expect(colonizerActionsPage.journeySummary("Colonize Planet", "Exceptional Directive")).toContainText("0.26 ly remaining")
    await expect(colonizerActionsPage.selectActionButton("Colonize Planet", "Exceptional Directive")).toHaveCount(0)
    await captureScreenshot(colonizerUser.page, testInfo, "colonization-pending-before-assault-35.png")
  })

  await test.step("Assault the arriving Fleet before Colonization and keep the Planet unclaimed", async () => {
    await colonizerActionsPage.toggleActionSelection("Political Campaign")
    const stationPickerEnabled = await attackerActionsPage.openTargetPicker("Stationary Assault", "Improved Directive", "Station")
    expect(stationPickerEnabled).toBe(true)
    await attackerActionsPage.searchTarget("Stationary Assault", "Improved Directive", "Station", "16 strength")
    const stationOptions = await attackerActionsPage.targetOptionLabels("Station")
    expect(stationOptions).toHaveLength(1)
    const targetFleetChoice = stationOptions[0]
    Assert.isDefined(targetFleetChoice)
    expect(targetFleetChoice).toContain("(16 strength)")
    await attackerActionsPage.chooseTarget("Station", targetFleetChoice)
    expect(await attackerActionsPage.selectedTargetValue("Stationary Assault", "Improved Directive", "Station")).toContain("16 strength")
    await attackerActionsPage.toggleActionSelection("Stationary Assault", "Improved Directive")
    ;[colonizerActionsPage, attackerActionsPage] = await finishBothTurns(colonizerActionsPage, attackerActionsPage, 13)

    await expect(colonizerActionsPage.journeySummary("Colonize Planet", "Exceptional Directive")).toHaveCount(0)
    await expect(colonizerActionsPage.selectActionButton("Colonize Planet", "Exceptional Directive")).toHaveText("Select action")
    await expect(colonizerActionsPage.resource("Influence")).toHaveAttribute("aria-label", "27 available of 27 Influence")
    const fleetsPage = await colonizerActionsPage.openFleets()
    await expect(fleetsPage.rows).toHaveCount(3)
    const stationaryRows = (await fleetsPage.rowsByJourneyStatus()).stationary
    const summaries = await Promise.all(
      stationaryRows.map(async (row) => ({
        row,
        owner: await fleetsPage.getOwnerName(row),
        strength: await fleetsPage.getFleetStrength(row),
        origin: await fleetsPage.getOriginPlanet(row),
        coordinate: await fleetsPage.getCoordinate(row),
      })),
    )
    const survivingColonizer = summaries.find(
      ({ owner, strength, origin, coordinate }) =>
        owner === colonizerUser.alias && strength === "19" && origin === "planet 649967" && coordinate === "55:19:10",
    )
    Assert.isDefined(survivingColonizer)

    const fleetState = summaries.map(({ owner, strength, origin, coordinate }) => ({ owner, strength, origin, coordinate }))
    expect(fleetState).toHaveLength(3)
    expect(fleetState).toContainEqual({
      owner: colonizerUser.alias,
      strength: "15",
      origin: "planet 352230",
      coordinate: "56:10:20",
    })
    expect(fleetState).toContainEqual({
      owner: colonizerUser.alias,
      strength: "19",
      origin: "planet 649967",
      coordinate: "55:19:10",
    })
    expect(fleetState).toContainEqual({
      owner: attackerUser.alias,
      strength: "84",
      origin: "planet 251588",
      coordinate: "54:00:40",
    })
    await captureScreenshot(colonizerUser.page, testInfo, "colonization-prevented-fleets-19.png")
    const preventedGalaxyPage = await fleetsPage.openOriginPlanet(survivingColonizer.row)
    const unclaimedPlanet = preventedGalaxyPage.planet("planet 649967")
    await expect(preventedGalaxyPage.planetOwnershipLabel(unclaimedPlanet)).toHaveText("Unclaimed")
    await expect(preventedGalaxyPage.fleetMarkersOnPlanet(unclaimedPlanet)).toHaveCount(1)
    await expect(preventedGalaxyPage.fleetStrength(preventedGalaxyPage.fleetMarkersOnPlanet(unclaimedPlanet))).toHaveText("19")
    await expect(preventedGalaxyPage.planetDetailsPane).toContainText("Unclaimed")
    await captureScreenshot(colonizerUser.page, testInfo, "colonization-prevented-unclaimed-fleet-19.png")
  })
})

async function selectPlanetTarget(
  actionsPage: ActionsPage,
  actionName: string,
  tier: string,
  planetName: string,
  coordinates: string,
): Promise<void> {
  const pickerEnabled = await actionsPage.openTargetPicker(actionName, tier, "Planet")
  if (!pickerEnabled) {
    expect(await actionsPage.selectedTargetValue(actionName, tier, "Planet")).toContain(planetName)
    return
  }

  await actionsPage.searchTarget(actionName, tier, "Planet", planetName)
  const choices = await actionsPage.targetOptionLabels("Planet")
  const choice = choices.find((option) => option.includes(planetName) && option.endsWith(`(${coordinates})`))
  Assert.isDefined(choice)
  await actionsPage.chooseTarget("Planet", choice)
}

async function finishSoloTurn(actionsPage: ActionsPage, nextTurn: number): Promise<ActionsPage> {
  const playersPage = await actionsPage.openPlayers()
  await playersPage.toggleReady()
  await expect(playersPage.turn).toHaveText(`Turn ${nextTurn}`, { timeout: 30000 })
  return await playersPage.openActions()
}

async function finishBothTurns(
  aliceActionsPage: ActionsPage,
  bobActionsPage: ActionsPage,
  nextTurn: number,
): Promise<[ActionsPage, ActionsPage]> {
  const alicePlayersPage: PlayersPage = await aliceActionsPage.openPlayers()
  const bobPlayersPage: PlayersPage = await bobActionsPage.openPlayers()
  await alicePlayersPage.toggleReady()
  await bobPlayersPage.toggleReady()
  await expect(alicePlayersPage.turn).toHaveText(`Turn ${nextTurn}`, { timeout: 30000 })
  await expect(bobPlayersPage.turn).toHaveText(`Turn ${nextTurn}`, { timeout: 30000 })
  return [await alicePlayersPage.openActions(), await bobPlayersPage.openActions()]
}

async function captureScreenshot(page: Page, testInfo: TestInfo, name: string): Promise<void> {
  const path = testInfo.outputPath(name)
  await page.screenshot({ path, animations: "disabled" })
  await testInfo.attach(name, { path, contentType: "image/png" })
}
