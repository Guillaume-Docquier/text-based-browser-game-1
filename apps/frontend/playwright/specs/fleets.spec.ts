import { Assert, Time, UnitOfTime } from "@guillaume-docquier/tools-ts"
import { expect, test } from "../fixtures.ts"
import { CreateGamePage } from "../pages/CreateGamePage.ts"
import { FleetsPage } from "../pages/FleetsPage.ts"
import { GalaxyPage } from "../pages/GalaxyPage.ts"
import { GameDetailsPage } from "../pages/GameDetailsPage.ts"

test("fleet origin and destination links open their planets in the galaxy view", async ({ alice, bob }) => {
  test.setTimeout(120000)
  const aliceGameDetailsPage = await test.step("Create a game", async () =>
    await CreateGamePage.createGame({
      creator: alice,
      participants: [bob],
      settings: { maxPlayers: 2, turnLength: Time.create(1, UnitOfTime.DAYS) },
    }))
  const aliceGalaxyPage = await test.step("Start the game", async () => {
    await aliceGameDetailsPage.reload()
    return await aliceGameDetailsPage.startGame()
  })
  const bobPlayersPage = await test.step("Open the game for Bob", async () => {
    const bobGameDetailsPage = new GameDetailsPage(bob.page)
    await bobGameDetailsPage.reload()
    const bobGalaxyPage = await bobGameDetailsPage.openGame()
    return await bobGalaxyPage.openPlayers()
  })

  const homePlanetsPage = await aliceGalaxyPage.openPlanets()
  const homeOwner = await homePlanetsPage.getOwnerName(homePlanetsPage.rowByCoordinate("46:93:25"))
  expect([alice.alias, bob.alias]).toContain(homeOwner)
  const moverUser = homeOwner === alice.alias ? alice : bob
  const moverPlayersPage = homeOwner === alice.alias ? await aliceGalaxyPage.openPlayers() : bobPlayersPage
  const otherPlayersPage = homeOwner === alice.alias ? bobPlayersPage : await aliceGalaxyPage.openPlayers()

  const moverFleetsPage = await test.step("Build a fleet at the pinned home and finish the turn", async () => {
    const moverActionsPage = await moverPlayersPage.openActions()
    await moverActionsPage.toggleActionSelection("Build Fleet", "Standard Directive")
    await moverActionsPage.toggleActionSelection("Political Campaign")
    await moverActionsPage.toggleActionSelection("Extract Metal")
    const playersPage = await moverActionsPage.openPlayers()
    await playersPage.toggleReady()
    await otherPlayersPage.toggleReady()
    await expect(playersPage.turn).toHaveText("Turn 2", { timeout: 15000 })
    await expect(otherPlayersPage.turn).toHaveText("Turn 2", { timeout: 15000 })
    return await playersPage.openFleets()
  })

  const moverFleetsPageAfterFunding = await test.step("Refine fuel for movement and finish the next turn", async () => {
    const moverActionsPage = await moverFleetsPage.openActions()
    await moverActionsPage.toggleActionSelection("Refine Fuel")
    await moverActionsPage.toggleActionSelection("Political Campaign")
    const playersPage = await moverActionsPage.openPlayers()
    await playersPage.toggleReady()
    await otherPlayersPage.toggleReady()
    await expect(playersPage.turn).toHaveText("Turn 3", { timeout: 15000 })
    await expect(otherPlayersPage.turn).toHaveText("Turn 3", { timeout: 15000 })
    return await playersPage.openFleets()
  })

  await test.step("Open the fleet's origin planet and return to Fleets", async () => {
    const row = moverFleetsPageAfterFunding.row(0)
    const name = await moverFleetsPageAfterFunding.getOriginPlanet(row)
    const coordinates = await moverFleetsPageAfterFunding.getCoordinate(row)
    const originGalaxyPage = await moverFleetsPageAfterFunding.openOriginPlanet(row)
    expect(GalaxyPage.urlPattern.test(moverUser.page.url())).toBe(true)
    await expect(originGalaxyPage.starSystemMap).toBeVisible()
    await expect(originGalaxyPage.planetDetailsPane).toContainText(name)
    await expect(originGalaxyPage.planetDetailsPane).toContainText(coordinates)
    await originGalaxyPage.goBack()
    expect(FleetsPage.urlPattern.test(moverUser.page.url())).toBe(true)
    await expect(moverFleetsPageAfterFunding.heading).toBeVisible()
  })

  let destinationPlanetName = ""
  await test.step("Select a valid in-range destination and move partial Strength", async () => {
    const moverActionsPage = await moverFleetsPageAfterFunding.openActions()
    const fleetChoice = await moverActionsPage.chooseFirstTarget("Move Fleet", "Standard Directive", "Fleet")
    expect(fleetChoice).toContain("strength")
    expect(await moverActionsPage.openTargetPicker("Move Fleet", "Standard Directive", "Planet")).toBe(true)
    const destinationChoice = "planet 15029 (56:07:15)"
    expect(await moverActionsPage.targetOptionLabels("Planet")).toContain(destinationChoice)
    await moverActionsPage.chooseTarget("Planet", destinationChoice)
    destinationPlanetName = "planet 15029"
    await moverActionsPage.enterNumericInput("Move Fleet", "Standard Directive", "Fleet strength", 5)
    await moverActionsPage.toggleActionSelection("Move Fleet", "Standard Directive")
    await expect(moverActionsPage.selectActionButton("Move Fleet", "Standard Directive")).toHaveText("Update action")
    const playersPage = await moverActionsPage.openPlayers()
    await playersPage.toggleReady()
    await otherPlayersPage.toggleReady()
    await expect(playersPage.turn).toHaveText("Turn 4", { timeout: 15000 })
    await expect(otherPlayersPage.turn).toHaveText("Turn 4", { timeout: 15000 })
    await playersPage.openFleets()
    await expect(moverFleetsPageAfterFunding.heading).toBeVisible()
  })

  await test.step("Verify partial Fleet allocation and open the destination in the galaxy view", async () => {
    const { moving, stationary } = await moverFleetsPageAfterFunding.rowsByJourneyStatus()
    expect(moving).toHaveLength(1)
    expect(stationary).toHaveLength(1)
    const [movingRow] = moving
    const [stationaryRow] = stationary
    Assert.isDefined(movingRow)
    Assert.isDefined(stationaryRow)
    const row = movingRow
    await expect(moverFleetsPageAfterFunding.fleetStrength(row)).toHaveText("5")
    await expect(moverFleetsPageAfterFunding.fleetStrength(stationaryRow)).toHaveText("5")
    await expect(moverFleetsPageAfterFunding.journeyLeft(row)).toContainText("ly")
    const destinationLink = moverFleetsPageAfterFunding.destinationPlanetLink(row)
    await expect(destinationLink).toContainText(destinationPlanetName)
    const destinationGalaxyPage = await moverFleetsPageAfterFunding.openDestinationPlanet(row)
    expect(GalaxyPage.urlPattern.test(moverUser.page.url())).toBe(true)
    await expect(destinationGalaxyPage.starSystemMap).toBeVisible()
    await expect(destinationGalaxyPage.planetDetailsPane).toContainText(destinationPlanetName)
  })
})

test("a moving fleet keeps its Action bound through continuation and releases it on arrival", async ({ alice, bob }) => {
  test.setTimeout(120000)
  const gameDetailsPage = await test.step("Create a game", async () =>
    await CreateGamePage.createGame({
      creator: alice,
      participants: [bob],
      settings: { maxPlayers: 2, turnLength: Time.create(1, UnitOfTime.DAYS) },
    }))
  const aliceGalaxyPage = await test.step("Start the game", async () => {
    await gameDetailsPage.reload()
    return await gameDetailsPage.startGame()
  })
  const bobPlayersPage = await test.step("Open the game for Bob", async () => {
    const bobGameDetailsPage = new GameDetailsPage(bob.page)
    await bobGameDetailsPage.reload()
    const bobGalaxyPage = await bobGameDetailsPage.openGame()
    return await bobGalaxyPage.openPlayers()
  })

  const homePlanetsPage = await aliceGalaxyPage.openPlanets()
  const homeOwner = await homePlanetsPage.getOwnerName(homePlanetsPage.rowByCoordinate("46:93:25"))
  expect([alice.alias, bob.alias]).toContain(homeOwner)
  const moverPlayersPage = homeOwner === alice.alias ? await aliceGalaxyPage.openPlayers() : bobPlayersPage
  const otherPlayersPage = homeOwner === alice.alias ? bobPlayersPage : await aliceGalaxyPage.openPlayers()

  const moverPlayersPageAfterFunding = await test.step("Build and fund a fleet at the pinned home", async () => {
    const actionsPage = await moverPlayersPage.openActions()
    await actionsPage.toggleActionSelection("Build Fleet", "Standard Directive")
    await actionsPage.toggleActionSelection("Political Campaign")
    await actionsPage.toggleActionSelection("Extract Metal")
    const playersPage = await actionsPage.openPlayers()
    await playersPage.toggleReady()
    await otherPlayersPage.toggleReady()
    await expect(playersPage.turn).toHaveText("Turn 2", { timeout: 15000 })
    await expect(otherPlayersPage.turn).toHaveText("Turn 2", { timeout: 15000 })
    const fundingActions = await playersPage.openActions()
    await fundingActions.toggleActionSelection("Refine Fuel")
    await fundingActions.toggleActionSelection("Political Campaign")
    const fundedPlayers = await fundingActions.openPlayers()
    await fundedPlayers.toggleReady()
    await otherPlayersPage.toggleReady()
    await expect(fundedPlayers.turn).toHaveText("Turn 3", { timeout: 15000 })
    await expect(otherPlayersPage.turn).toHaveText("Turn 3", { timeout: 15000 })
    return fundedPlayers
  })

  const fleetsPage = await moverPlayersPageAfterFunding.openFleets()
  const sourceRow = fleetsPage.row(0)
  const originPlanetName = await fleetsPage.getOriginPlanet(sourceRow)
  const originCoordinates = await fleetsPage.getCoordinate(sourceRow)
  let actionsPage = await fleetsPage.openActions()
  const actionName = "Move Fleet"
  const actionTier = "Exceptional Directive"
  const sourceFleetChoice = await actionsPage.chooseFirstTarget(actionName, actionTier, "Fleet")
  const movingFleetName = sourceFleetChoice.replace(/\s+\(\d+ strength\)$/, "")
  expect(originCoordinates).toBe("46:93:25")
  expect(await actionsPage.openTargetPicker(actionName, actionTier, "Planet")).toBe(true)
  const destinationChoice = "planet 13209 (56:40:35)"
  expect(await actionsPage.targetOptionLabels("Planet")).toContain(destinationChoice)
  await actionsPage.chooseTarget("Planet", destinationChoice)
  const destinationPlanetName = destinationChoice.replace(/ \([^()]+\)$/, "")
  await actionsPage.enterNumericInput(actionName, actionTier, "Fleet strength", 4)
  await actionsPage.toggleActionSelection(actionName, actionTier)
  await expect(actionsPage.selectActionButton(actionName, actionTier)).toHaveText("Update action")
  await actionsPage.toggleActionSelection("Refine Fuel")
  await actionsPage.toggleActionSelection("Political Campaign")

  const playersPageAfterDeparture = await actionsPage.openPlayers()
  await playersPageAfterDeparture.toggleReady()
  await otherPlayersPage.toggleReady()
  await expect(playersPageAfterDeparture.turn).toHaveText("Turn 4", { timeout: 15000 })
  await expect(otherPlayersPage.turn).toHaveText("Turn 4", { timeout: 15000 })
  actionsPage = await playersPageAfterDeparture.openActions()
  await expect(actionsPage.heading).toBeVisible()
  await expect(actionsPage.journeySummary(actionName, actionTier)).toContainText(movingFleetName)
  await expect(actionsPage.journeySummary(actionName, actionTier)).toContainText("4 strength")
  await expect(actionsPage.journeySummary(actionName, actionTier)).toContainText(`to ${destinationPlanetName}`)
  await expect(actionsPage.journeySummary(actionName, actionTier)).toContainText("0.8 ly remaining")
  await expect(actionsPage.selectActionButton(actionName, actionTier)).toHaveCount(0)
  await expect(actionsPage.cancelActionButton(actionName, actionTier)).toHaveCount(0)
  await expect(actionsPage.targetPicker(actionName, actionTier, "Fleet")).toHaveCount(0)
  await expect(actionsPage.actionInput(actionName, actionTier, "Fleet strength")).toHaveCount(0)

  await test.step("Reload and verify the occupied action remains locked", async () => {
    await actionsPage.reload()
    await expect(actionsPage.heading).toBeVisible()
    await expect(actionsPage.journeySummary(actionName, actionTier)).toContainText(movingFleetName)
    await expect(actionsPage.journeySummary(actionName, actionTier)).toContainText("4 strength")
    await expect(actionsPage.journeySummary(actionName, actionTier)).toContainText(`to ${destinationPlanetName}`)
    await expect(actionsPage.journeySummary(actionName, actionTier)).toContainText("0.8 ly remaining")
    await expect(actionsPage.selectActionButton(actionName, actionTier)).toHaveCount(0)
    await expect(actionsPage.cancelActionButton(actionName, actionTier)).toHaveCount(0)
    await expect(actionsPage.targetPicker(actionName, actionTier, "Fleet")).toHaveCount(0)
    await expect(actionsPage.actionInput(actionName, actionTier, "Fleet strength")).toHaveCount(0)
  })

  const fleetsAfterDeparture = await actionsPage.openFleets()
  await expect(fleetsAfterDeparture.heading).toBeVisible()
  const { moving: movingRows, stationary: stationaryRows } = await fleetsAfterDeparture.rowsByJourneyStatus()
  expect(movingRows).toHaveLength(1)
  expect(stationaryRows).toHaveLength(1)
  const [movingFleetRow] = movingRows
  const [remainderFleetRow] = stationaryRows
  Assert.isDefined(movingFleetRow)
  Assert.isDefined(remainderFleetRow)
  await expect(fleetsAfterDeparture.fleetStrength(movingFleetRow)).toHaveText("4")
  await expect(fleetsAfterDeparture.fleetStrength(remainderFleetRow)).toHaveText("6")
  await expect(fleetsAfterDeparture.journeyLeft(movingFleetRow)).toContainText("ly")
  await expect(fleetsAfterDeparture.journeyLeft(movingFleetRow)).toHaveText("0.8 ly")

  await test.step("Continue the fleet without submitting another action", async () => {
    const continuationPlayers = await actionsPage.openPlayers()
    await continuationPlayers.toggleReady()
    await otherPlayersPage.toggleReady()
    await expect(continuationPlayers.turn).toHaveText("Turn 5", { timeout: 15000 })
    await expect(otherPlayersPage.turn).toHaveText("Turn 5", { timeout: 15000 })
    actionsPage = await continuationPlayers.openActions()
    await expect(actionsPage.heading).toBeVisible()
    await expect(actionsPage.journeySummary(actionName, actionTier)).toHaveCount(0)

    const fleetsAfterArrival = await actionsPage.openFleets()
    await expect(fleetsAfterArrival.heading).toBeVisible()
    const { moving: arrivedRows, stationary: stationedRows } = await fleetsAfterArrival.rowsByJourneyStatus()
    expect(arrivedRows).toHaveLength(0)
    expect(stationedRows).toHaveLength(2)
    const arrivedFleetStates = await Promise.all(
      stationedRows.map(async (row) => ({
        strength: await fleetsAfterArrival.getFleetStrength(row),
        origin: await fleetsAfterArrival.getOriginPlanet(row),
        coordinate: await fleetsAfterArrival.getCoordinate(row),
      })),
    )
    expect(arrivedFleetStates).toHaveLength(2)
    expect(arrivedFleetStates).toContainEqual({ strength: "6", origin: originPlanetName, coordinate: "46:93:25" })
    expect(arrivedFleetStates).toContainEqual({ strength: "4", origin: destinationPlanetName, coordinate: "56:40:35" })
    actionsPage = await fleetsAfterArrival.openActions()
    await expect(actionsPage.heading).toBeVisible()
  })
  await test.step("Verify the action is released on arrival and source changes re-filter targets", async () => {
    await expect(actionsPage.journeySummary(actionName, actionTier)).toHaveCount(0)
    await expect(actionsPage.targetPicker(actionName, actionTier, "Fleet")).toBeEnabled()
    await expect(actionsPage.actionInput(actionName, actionTier, "Fleet strength")).toBeEnabled()

    expect(await actionsPage.openTargetPicker(actionName, actionTier, "Fleet")).toBe(true)
    const fleetOptions = await actionsPage.targetOptionLabels("Fleet")
    const sixStrengthFleet = fleetOptions.find((label) => label.endsWith("(6 strength)"))
    const fourStrengthFleet = fleetOptions.find((label) => label.endsWith("(4 strength)"))
    expect(sixStrengthFleet).toBeDefined()
    expect(fourStrengthFleet).toBeDefined()
    if (sixStrengthFleet === undefined || fourStrengthFleet === undefined) {
      throw new Error("The stationary remainder and arrived fleet were not both selectable")
    }

    await actionsPage.chooseTarget("Fleet", sixStrengthFleet)
    await expect(actionsPage.targetPicker(actionName, actionTier, "Fleet")).toHaveValue(sixStrengthFleet)
    let targetsFromOrigin: string[]
    if (await actionsPage.isTargetPickerDisabled(actionName, actionTier, "Planet")) {
      targetsFromOrigin = [await actionsPage.selectedTargetValue(actionName, actionTier, "Planet")]
    } else {
      expect(await actionsPage.openTargetPicker(actionName, actionTier, "Planet")).toBe(true)
      targetsFromOrigin = await actionsPage.targetOptionLabels("Planet")
    }
    const destinationTarget = targetsFromOrigin.find((label) => label.startsWith(`${destinationPlanetName} `))
    expect(destinationTarget).toBeDefined()
    if (destinationTarget === undefined) {
      throw new Error("The arrived planet was not a legal target for the stationary remainder")
    }
    if (!(await actionsPage.isTargetPickerDisabled(actionName, actionTier, "Planet"))) {
      await actionsPage.chooseTarget("Planet", destinationTarget)
    }

    expect(await actionsPage.openTargetPicker(actionName, actionTier, "Fleet")).toBe(true)
    await actionsPage.chooseTarget("Fleet", fourStrengthFleet)
    await expect(actionsPage.targetPicker(actionName, actionTier, "Fleet")).toHaveValue(fourStrengthFleet)
    let targetsFromDestination: string[]
    if (await actionsPage.isTargetPickerDisabled(actionName, actionTier, "Planet")) {
      targetsFromDestination = [await actionsPage.selectedTargetValue(actionName, actionTier, "Planet")]
    } else {
      expect(await actionsPage.openTargetPicker(actionName, actionTier, "Planet")).toBe(true)
      await actionsPage.searchTarget(actionName, actionTier, "Planet", originCoordinates)
      targetsFromDestination = await actionsPage.targetOptionLabels("Planet")
    }
    const originTarget = targetsFromDestination.find((label) => label.endsWith(`(${originCoordinates})`))
    expect(
      originTarget,
      `Origin coordinates ${originCoordinates} after switching to ${fourStrengthFleet}: ${targetsFromDestination.join(" | ")}`,
    ).toBeDefined()
    if (originTarget === undefined) {
      throw new Error("The original planet was not a legal target for the arrived fleet")
    }
    if (!(await actionsPage.isTargetPickerDisabled(actionName, actionTier, "Planet"))) {
      await actionsPage.chooseTarget("Planet", originTarget)
    }
    await actionsPage.enterNumericInput(actionName, actionTier, "Fleet strength", 1)
    await expect(actionsPage.selectActionButton(actionName, actionTier)).toBeEnabled()
  })
})
