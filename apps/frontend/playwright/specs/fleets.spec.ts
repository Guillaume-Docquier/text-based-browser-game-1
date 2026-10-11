import { Assert, Time, UnitOfTime } from "@guillaume-docquier/tools-ts"
import { evaluateActionSelection } from "shared/action-submission/actionEligibility.ts"
import { RulesetSchema } from "shared/domain/ruleset/Ruleset.ts"
import { SubmittedActionSchema } from "shared/domain/turns/actions/Action.ts"
import { createSeededRng } from "shared/testing/createSeededRng.ts"
import { resolveTurn } from "shared/turn-resolution/resolveTurn.ts"
import { toActionEligibilityState } from "../../src/features/play/actionEligibilityState.ts"
import { expect, test } from "../fixtures.ts"
import { CreateGamePage } from "../pages/CreateGamePage.ts"
import { FleetsPage } from "../pages/FleetsPage.ts"
import { GalaxyPage } from "../pages/GalaxyPage.ts"
import { GameDetailsPage } from "../pages/GameDetailsPage.ts"

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
  })

  const travelerFleetsPage = await test.step("Build a fleet and finish the turn", async () => {
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
  })

  await test.step("Compare one public snapshot through frontend projection, router and resolver prevalidation", async () => {
    const actions = await travelerFleetsPage.openActions()
    const before = await actions.refreshPlayerView()
    const source = before.fleets.find((fleet) => fleet.ownerPlayerId === before.player.id)
    const destination = before.galaxy.systems.flatMap((system) => system.planets).find((planet) => planet.coordinates === "56:07:50")
    const enemySource = before.fleets.find((fleet) => fleet.ownerPlayerId !== before.player.id)
    const farPlanet = before.galaxy.systems
      .flatMap((system) => system.planets)
      .find((planet) => planet.ownerPlayerId !== null && planet.ownerPlayerId !== before.player.id)
    Assert.isDefined(enemySource)
    Assert.isDefined(farPlanet)
    expect(enemySource.strength).toBe(100)
    const instances = before.actions.filter((action) => action.actionDefinitionId === "MOVE_FLEET_STANDARD")
    const x = instances[0]
    const y = instances[1]
    Assert.isDefined(source)
    Assert.isDefined(destination)
    Assert.isDefined(x)
    Assert.isDefined(y)
    expect(source.strength).toBe(10)
    const targets = { fleet: source.id, planet: destination.id }
    expect((await actions.submitRawSelection(before, x, targets, { strength: 4 })).status).toBe(200)
    const reserved = await actions.refreshPlayerView()
    const state = toActionEligibilityState(reserved)
    const candidate = SubmittedActionSchema.parse({
      ...y,
      playerId: before.player.id,
      selectedTargets: targets,
      selectedInputs: { strength: 6 },
    })
    expect(
      evaluateActionSelection({ state, ruleset: reserved.ruleset, action: candidate, selection: candidate, mode: "complete" }).eligible,
    ).toBe(true)
    expect(
      resolveTurn(
        structuredClone({ ...state, winnerPlayerId: undefined, submittedActions: [...state.submittedActions, candidate] }),
        RulesetSchema.parse(reserved.ruleset),
        createSeededRng(),
      ).type,
    ).toBe("Success")
    expect((await actions.submitRawSelection(reserved, y, targets, { strength: 6 })).status).toBe(200)
    const full = await actions.refreshPlayerView()
    expect(full.fleets.find((fleet) => fleet.id === source.id)?.uncommittedStrength).toBe(0)
    const projected = toActionEligibilityState(full)
    const build = full.actions.find((action) => action.actionDefinitionId === "BUILD_FLEET_IMPROVED")
    Assert.isDefined(build)
    const costlyBuild = SubmittedActionSchema.parse({
      ...build,
      playerId: full.player.id,
      selectedTargets: { planet: source.originPlanetId },
      selectedInputs: {},
    })
    const resourceEvaluation = evaluateActionSelection({
      state: projected,
      ruleset: full.ruleset,
      action: costlyBuild,
      selection: costlyBuild,
      mode: "complete",
    })
    expect(full.resources.INFLUENCE).toStrictEqual({ total: 8, uncommitted: 2 })
    expect(resourceEvaluation.issues).toContainEqual(expect.objectContaining({ path: ["resources", "INFLUENCE"], shortfall: 4 }))
    expect(
      resolveTurn(
        structuredClone({ ...projected, winnerPlayerId: undefined, submittedActions: [...projected.submittedActions, costlyBuild] }),
        RulesetSchema.parse(full.ruleset),
        createSeededRng(),
      ),
    ).toMatchObject({ type: "Failure", error: { type: "INVALID_SUBMISSIONS" } })
    const resourceRejection = await actions.submitRawSelection(full, build, costlyBuild.selectedTargets, costlyBuild.selectedInputs)
    expect(resourceRejection.status).toBe(400)
    expect(JSON.stringify(resourceRejection.body)).toContain("Insufficient INFLUENCE: shortfall 4")
    for (const invalid of [
      {
        targets: { ...targets, fleet: enemySource.id },
        inputs: { strength: 1 },
        path: ["selectedTargets", "fleet"],
        message: "owned",
        apiMessage: "Target must be owned by submitting player",
      },
      {
        targets: { ...targets, planet: farPlanet.id },
        inputs: { strength: 1 },
        path: ["selectedTargets", "planet"],
        message: "exceeds range 5",
        apiMessage: "Destination exceeds range 5 light years",
      },
      { targets, inputs: { strength: 7 }, path: ["selectedInputs", "strength"], message: "shortfall 1", apiMessage: "shortfall 1" },
      { targets, inputs: { strength: 0 }, path: ["selectedInputs", "strength"], message: "positive", apiMessage: "selectedInputs" },
      {
        targets: { ...targets, fleet: "nonexistent-fleet" },
        inputs: { strength: 1 },
        path: ["selectedTargets", "fleet"],
        message: "Unknown",
        apiMessage: "Unknown FLEET target",
      },
      {
        targets: { ...targets, planet: source.originPlanetId },
        inputs: { strength: 1 },
        path: ["selectedTargets", "planet"],
        message: "origin",
        apiMessage: "Destination must differ from the origin planet",
      },
    ]) {
      const raw = structuredClone(candidate)
      Reflect.set(raw, "selectedTargets", invalid.targets)
      Reflect.set(raw, "selectedInputs", invalid.inputs)
      const evaluation = evaluateActionSelection({ state: projected, ruleset: full.ruleset, action: raw, selection: raw, mode: "complete" })
      expect(evaluation.eligible).toBe(false)
      expect(evaluation.issues).toContainEqual(
        expect.objectContaining({ path: invalid.path, message: expect.stringContaining(invalid.message) }),
      )
      const proposed = projected.submittedActions.map((action) => (action.id === raw.id ? raw : action))
      expect(
        resolveTurn(
          structuredClone({ ...projected, winnerPlayerId: undefined, submittedActions: proposed }),
          RulesetSchema.parse(full.ruleset),
          createSeededRng(),
        ),
      ).toMatchObject({ type: "Failure", error: { type: "INVALID_SUBMISSIONS" } })
      const rejection = await actions.submitRawSelection(full, y, invalid.targets, invalid.inputs)
      expect(rejection.status).toBe(400)
      expect(JSON.stringify(rejection.body)).toContain(invalid.apiMessage)
    }
    const retained = await actions.refreshPlayerView()
    expect(retained.actions.filter((action) => action.status === "SUBMITTED").map((action) => action.selectedInputs)).toStrictEqual([
      { strength: 4 },
      { strength: 6 },
    ])
    expect((await actions.submitRawSelection(retained, x, null, null)).status).toBe(200)
    expect((await actions.submitRawSelection(retained, y, null, null)).status).toBe(200)
    await actions.openFleets()
  })
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
    const fresh = await actions.refreshPlayerView()
    const moving = fresh.fleets.find((fleet) => fleet.movement !== undefined)
    const remainder = fresh.fleets.find((fleet) => fleet.movement === undefined && fleet.ownerPlayerId === fresh.player.id)
    const instance = fresh.actions.find((action) => action.actionDefinitionId === "MOVE_FLEET_STANDARD" && action.status === "AVAILABLE")
    Assert.isDefined(moving)
    Assert.isDefined(remainder)
    Assert.isDefined(instance)
    for (const invalid of [
      { fleet: moving.id, strength: 1, path: ["selectedTargets", "fleet"], message: "Source fleet must be stationary" },
      { fleet: remainder.id, strength: 7, path: ["selectedInputs", "strength"], message: "shortfall 1" },
    ]) {
      const targets = { fleet: invalid.fleet, planet: moving.destinationPlanetId ?? "missing" }
      const candidate = SubmittedActionSchema.parse({
        ...instance,
        playerId: fresh.player.id,
        selectedTargets: targets,
        selectedInputs: { strength: invalid.strength },
      })
      const state = toActionEligibilityState(fresh)
      const evaluation = evaluateActionSelection({
        state,
        ruleset: fresh.ruleset,
        action: candidate,
        selection: candidate,
        mode: "complete",
      })
      expect(evaluation.issues).toContainEqual(
        expect.objectContaining({ path: invalid.path, message: expect.stringContaining(invalid.message) }),
      )
      expect(
        resolveTurn(
          structuredClone({ ...state, winnerPlayerId: undefined, submittedActions: [candidate] }),
          RulesetSchema.parse(fresh.ruleset),
          createSeededRng(),
        ),
      ).toMatchObject({ type: "Failure", error: { type: "INVALID_SUBMISSIONS" } })
      const rejection = await actions.submitRawSelection(fresh, instance, targets, { strength: invalid.strength })
      expect(rejection.status).toBe(400)
      expect(JSON.stringify(rejection.body)).toContain(invalid.message)
    }
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
