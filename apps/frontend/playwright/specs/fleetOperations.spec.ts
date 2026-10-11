import { Assert, Time, UnitOfTime } from "@guillaume-docquier/tools-ts"
import { typedParse } from "@guillaume-docquier/tools-ts/schemas"
import type { TestInfo } from "@playwright/test"
import { evaluateActionSelection } from "shared/action-submission/actionEligibility.ts"
import { RulesetSchema } from "shared/domain/ruleset/Ruleset.ts"
import { SubmittedActionSchema } from "shared/domain/turns/actions/Action.ts"
import { createSeededRng } from "shared/testing/createSeededRng.ts"
import { resolveTurn } from "shared/turn-resolution/resolveTurn.ts"
import { toActionEligibilityState } from "../../src/features/play/actionEligibilityState.ts"
import type { AuthenticatedUser } from "../AuthenticatedUser.ts"
import { expect, test } from "../fixtures.ts"
import { CreateGamePage } from "../pages/CreateGamePage.ts"
import { GalaxyPage } from "../pages/GalaxyPage.ts"
import { GameDetailsPage } from "../pages/GameDetailsPage.ts"

test("Fleet Operations joins funded allocations, range and busy locks, Combat, contested claims and immediate original Attack reuse", async ({
  alice,
  bob,
}, testInfo) => {
  test.setTimeout(360000)
  let right = alice,
    left = bob
  await test.step("Create, join and start the seeded two-player Test game", async () => {
    const details = await CreateGamePage.createGame({
      creator: alice,
      participants: [bob],
      settings: { maxPlayers: 2, turnLength: Time.create(1, UnitOfTime.DAYS) },
    })
    await details.reload()
    const galaxy = await details.startGame()
    const participant = new GameDetailsPage(bob.page)
    await participant.reload()
    await participant.openGame()
    const view = await (await galaxy.openActions()).refreshPlayerView()
    const home = view.galaxy.systems.flatMap((system) => system.planets).find((planet) => planet.ownerPlayerId === view.player.id)
    Assert.isDefined(home)
    if (home.coordinates === "44:96:25") [right, left] = [bob, alice]
  })
  const advance = async (turn: number): Promise<void> => {
    const r = await new GalaxyPage(right.page).openPlayers(),
      l = await new GalaxyPage(left.page).openPlayers()
    await r.toggleReady()
    await l.toggleReady()
    await expect(r.turn).toHaveText(`Turn ${turn}`, { timeout: 15000 })
    await expect(l.turn).toHaveText(`Turn ${turn}`, { timeout: 15000 })
  }
  await test.step("T1 Campaign and Extract give each7 Influence7 Metal1 Fuel", async () => {
    await fundUnifiedEmpires({ right, left, advance, testInfo })
  })
  for (let turn = 2; turn <= 11; turn++)
    await test.step(`Normal affordable funding and builds in T${turn}`, async () => {
      await buildUnifiedForces({ right, left, advance, testInfo }, turn)
    })
  await test.step("T12 literal funding, source-dependent ordinary range and actual three-boundary invalid controls", async () => {
    await verifyInitialBoundaries({ right, left, advance, testInfo })
  })
  await test.step("Select Colonize35 Attack30 Exceptional5 from the same80 and left Colonize35", async () => {
    await selectUnifiedAllocations({ right, left, advance, testInfo })
  })
  await test.step("Reload four paid journeys, exact distances and actual occupied lock rejection", async () => {
    await verifySavedDepartures({ right, left, advance, testInfo })
  })
  await test.step("Combat30 versus25 leaves5; two eligible Colonize35 arrivals leave15 and35 with one owner", async () => {
    await verifyCombinedArrival({ right, left, advance, testInfo })
  })
  await test.step("Reuse the exact original Attack in immediately collecting T14 with chosen1", async () => {
    await reuseOriginalAttack({ right, left, advance, testInfo })
  })
  await test.step("Exceptional tick9 reinforces5 to10 then reused Attack tick15 merges11; reload preserves final70", async () => {
    await verifyFinalMergedFleet({ right, left, advance, testInfo })
  })
})

type UnifiedFleetJourney = Readonly<{
  right: AuthenticatedUser
  left: AuthenticatedUser
  advance: (turn: number) => Promise<void>
  testInfo: TestInfo
}>

async function fundUnifiedEmpires({ right, left, advance }: UnifiedFleetJourney): Promise<void> {
  for (const user of [right, left]) {
    const actions = await new GalaxyPage(user.page).openActions()
    await actions.toggleActionSelection("Political Campaign")
    await actions.toggleActionSelection("Extract Metal")
  }
  await advance(2)
  for (const user of [right, left]) {
    const actions = await new GalaxyPage(user.page).openActions()
    await expect(actions.resource("Influence")).toHaveAttribute("aria-label", "7 available of 7 Influence")
    await expect(actions.resource("Metal")).toHaveAttribute("aria-label", "7 available of 7 Metal")
  }
}

async function buildUnifiedForces({ right, left, advance }: UnifiedFleetJourney, turn: number): Promise<void> {
  for (const user of [right, left]) {
    const actions = await new GalaxyPage(user.page).openActions()
    if (turn <= 7 || (user === right && turn <= 9)) await actions.toggleActionSelection("Build Fleet", "Standard Directive")
    if (user === right && turn === 8) await actions.toggleActionSelection("Extract Metal")
    if (user === right && turn === 10) await actions.toggleActionSelection("Refine Fuel")
    await actions.toggleActionSelection("Political Campaign")
  }
  await advance(turn + 1)
  if (turn === 7)
    for (const user of [right, left]) {
      const fleets = await new GalaxyPage(user.page).openFleets()
      await expect(fleets.rowByOwnerAndStrength(user.alias, 60)).toHaveCount(1)
    }
}

async function verifyInitialBoundaries({ right }: UnifiedFleetJourney): Promise<void> {
  const actions = await new GalaxyPage(right.page).openActions(),
    view = await actions.refreshPlayerView()
  expect(view.turn).toBe(12)
  expect([view.resources.INFLUENCE.total, view.resources.METAL.total, view.resources.FUEL.total]).toEqual([38, 2, 6])
  const source = view.fleets.find((fleet) => fleet.ownerPlayerId === view.player.id),
    enemy = view.fleets.find((fleet) => fleet.ownerPlayerId !== view.player.id)
  Assert.isDefined(source)
  Assert.isDefined(enemy)
  expect(source.strength).toBe(80)
  expect(enemy.strength).toBe(60)
  const allPlanets = view.galaxy.systems.flatMap((system) => system.planets),
    destination = allPlanets.find((planet) => planet.coordinates === "35:35:40"),
    home = allPlanets.find((planet) => planet.coordinates === "46:93:25"),
    opponentHome = allPlanets.find((planet) => planet.coordinates === "44:96:25")
  Assert.isDefined(destination)
  Assert.isDefined(home)
  Assert.isDefined(opponentHome)
  for (const query of ["35:35:40", "44:96:25", "46:93:25"]) {
    await actions.searchTarget("Move Fleet", "Standard Directive", "Planet", query)
    await expect(actions.targetChoices("Planet").getByRole("option")).toHaveCount(0)
  }
  const projected = toActionEligibilityState(view),
    ruleset = typedParse(RulesetSchema, view.ruleset)
  for (const invalid of [
    { id: "MOVE_FLEET_STANDARD_1", source: source.id, planet: destination.id, amount: 1 },
    { id: "MOVE_FLEET_STANDARD_1", source: source.id, planet: opponentHome.id, amount: 1 },
    { id: "ATTACK_MOVE_STANDARD_1", source: source.id, planet: home.id, amount: 1 },
    { id: "ATTACK_MOVE_STANDARD_1", source: enemy.id, planet: opponentHome.id, amount: 1 },
    { id: "ATTACK_MOVE_STANDARD_1", source: "missing", planet: opponentHome.id, amount: 1 },
    { id: "ATTACK_MOVE_STANDARD_1", source: source.id, planet: opponentHome.id, amount: 0 },
    { id: "ATTACK_MOVE_STANDARD_1", source: source.id, planet: opponentHome.id, amount: 1.5 },
    { id: "COLONIZE_PLANET_STANDARD_1", source: source.id, planet: opponentHome.id, amount: 35 },
  ]) {
    const action = view.actions.find((action) => action.id === invalid.id)
    Assert.isDefined(action)
    const candidate = typedParse(SubmittedActionSchema, {
      ...action,
      playerId: view.player.id,
      selectedTargets: { fleet: source.id, planet: destination.id },
      selectedInputs: { strength: 1 },
    })
    const selection = { selectedTargets: { fleet: invalid.source, planet: invalid.planet }, selectedInputs: { strength: invalid.amount } }
    expect(evaluateActionSelection({ state: projected, ruleset, action: candidate, selection, mode: "complete" }).eligible).toBe(false)
    Reflect.set(candidate, "selectedTargets", selection.selectedTargets)
    Reflect.set(candidate, "selectedInputs", selection.selectedInputs)
    const resolution = structuredClone({ ...projected, winnerPlayerId: undefined, submittedActions: [candidate] }),
      resources = structuredClone(resolution.players)
    expect(resolveTurn(resolution, ruleset, createSeededRng(1234))).toMatchObject({
      type: "Failure",
      error: { type: "INVALID_SUBMISSIONS" },
    })
    expect(resolution.players).toStrictEqual(resources)
    expect(await actions.submitRawSelection(view, action, selection.selectedTargets, selection.selectedInputs)).toMatchObject({
      status: 400,
    })
  }
  expect(await actions.refreshPlayerView()).toStrictEqual(view)
}

async function selectUnifiedAllocations({ right, left, advance }: UnifiedFleetJourney): Promise<void> {
  for (const [user, name, tier, planet, strength] of [
    [right, "Colonize Planet", "Standard Directive", "35:35:40", "35"],
    [right, "Attack Move", "Standard Directive", "44:96:25", "30"],
    [right, "Move Fleet", "Exceptional Directive", "44:96:25", "5"],
    [left, "Colonize Planet", "Standard Directive", "35:35:40", "35"],
  ] as const) {
    const actions = await new GalaxyPage(user.page).openActions()
    await actions.searchTarget(name, tier, "Planet", planet)
    await actions.chooseTarget("Planet", planet)
    await actions.setNumericInput(name, tier, "Strength", strength)
    await actions.toggleActionSelection(name, tier)
  }
  const actions = await new GalaxyPage(right.page).openActions()
  await expect(actions.resource("Influence")).toHaveAttribute("aria-label", "5 available of 38 Influence")
  await expect(actions.resource("Fuel")).toHaveAttribute("aria-label", "0 available of 6 Fuel")
  const view = await actions.refreshPlayerView(),
    state = toActionEligibilityState(view),
    ruleset = typedParse(RulesetSchema, view.ruleset)
  expect(state.submittedActions).toHaveLength(3)
  const control = resolveTurn(structuredClone({ ...state, winnerPlayerId: undefined }), ruleset, createSeededRng(1234))
  expect(control).toMatchObject({ type: "Success" })
  if (control.type === "Success") {
    expect(
      Object.values(control.value.fleets)
        .filter((fleet) => fleet.ownerPlayerId === view.player.id)
        .map((fleet) => fleet.strength)
        .toSorted((a, b) => a - b),
    ).toEqual([5, 10, 30, 35])
    expect(control.value.players[view.player.id]?.resources).toEqual({ INFLUENCE: 5, METAL: 2, FUEL: 0, ENERGY: 0, COLONY: 0 })
  }
  await actions.setNumericInput("Attack Move", "Standard Directive", "Strength", "40")
  await actions.updateAction("Attack Move", "Standard Directive")
  await actions.setNumericInput("Attack Move", "Standard Directive", "Strength", "41")
  await expect(actions.updateActionButton("Attack Move", "Standard Directive")).toBeDisabled()
  const forty = await actions.refreshPlayerView(),
    attack = forty.actions.find((action) => action.id === "ATTACK_MOVE_STANDARD_1")
  Assert.isDefined(attack)
  expect(attack.selectedInputs).toEqual({ strength: 40 })
  expect(await actions.submitRawSelection(forty, attack, attack.selectedTargets, { strength: 41 })).toMatchObject({ status: 400 })
  const projected = toActionEligibilityState(forty),
    candidate = projected.submittedActions.find((action) => action.id === attack.id)
  Assert.isDefined(candidate)
  const selection = { selectedTargets: candidate.selectedTargets, selectedInputs: { strength: 41 } }
  expect(evaluateActionSelection({ state: projected, ruleset, action: candidate, selection, mode: "complete" })).toMatchObject({
    eligible: false,
    issues: expect.arrayContaining([expect.objectContaining({ shortfall: 1 })]),
  })
  Reflect.set(candidate, "selectedInputs", { strength: 41 })
  expect(resolveTurn({ ...structuredClone(projected), winnerPlayerId: undefined }, ruleset, createSeededRng(1234))).toMatchObject({
    type: "Failure",
    error: { type: "INVALID_SUBMISSIONS" },
  })
  await actions.setNumericInput("Attack Move", "Standard Directive", "Strength", "30")
  await actions.updateAction("Attack Move", "Standard Directive")
  await actions.toggleActionSelection("Attack Move", "Standard Directive")
  await expect(actions.resource("Influence")).toHaveAttribute("aria-label", "10 available of 38 Influence")
  await expect(actions.resource("Fuel")).toHaveAttribute("aria-label", "1 available of 6 Fuel")
  await actions.searchTarget("Attack Move", "Standard Directive", "Planet", "44:96:25")
  await actions.chooseTarget("Planet", "44:96:25")
  await actions.setNumericInput("Attack Move", "Standard Directive", "Strength", "30")
  await actions.toggleActionSelection("Attack Move", "Standard Directive")
  await expect(actions.resource("Influence")).toHaveAttribute("aria-label", "5 available of 38 Influence")
  await advance(13)
}

async function verifySavedDepartures({ right, left, advance }: UnifiedFleetJourney): Promise<void> {
  const fleets = await new GalaxyPage(right.page).openFleets()
  await expect(fleets.rows).toHaveCount(6)
  await expect(fleets.remainingDistance(fleets.rowByOwnerAndStrength(right.alias, 35))).toHaveText("7.78 ly")
  await expect(fleets.remainingDistance(fleets.rowByOwnerAndStrength(left.alias, 35))).toHaveText("7.70 ly")
  await expect(fleets.remainingDistance(fleets.rowByStrength(30))).toHaveText("7.08 ly")
  await expect(fleets.remainingDistance(fleets.rowByStrength(5))).toHaveText("12.08 ly")
  await expect(fleets.rowByStrength(10)).toHaveCount(1)
  await expect(fleets.rowByStrength(25)).toHaveCount(1)
  await fleets.reload()
  await expect(fleets.rows).toHaveCount(6)
  const actions = await fleets.openActions(),
    view = await actions.refreshPlayerView()
  for (const [name, tier, id] of [
    ["Colonize Planet", "Standard Directive", "COLONIZE_PLANET_STANDARD_1"],
    ["Attack Move", "Standard Directive", "ATTACK_MOVE_STANDARD_1"],
    ["Move Fleet", "Exceptional Directive", "MOVE_FLEET_EXCEPTIONAL_1"],
  ] as const) {
    await expect(actions.action(name, tier)).toContainText("In progress:")
    await expect(actions.selectActionButton(name, tier)).toHaveCount(0)
    const action = view.actions.find((action) => action.id === id)
    Assert.isDefined(action)
    expect(await actions.submitRawSelection(view, action, null, null)).toMatchObject({ status: 400 })
    expect(await actions.submitRawSelection({ ...view, turn: 12 }, action, action.selectedTargets, action.selectedInputs)).toMatchObject({
      status: 400,
    })
  }
  const sibling = view.actions.find((action) => action.id === "ATTACK_MOVE_STANDARD_2"),
    moving = view.fleets.find((fleet) => fleet.movement !== undefined && fleet.ownerPlayerId === view.player.id),
    destination = view.galaxy.systems.flatMap((system) => system.planets).find((planet) => planet.coordinates === "44:96:25")
  Assert.isDefined(sibling)
  Assert.isDefined(moving)
  Assert.isDefined(destination)
  const candidate = typedParse(SubmittedActionSchema, {
    ...sibling,
    playerId: view.player.id,
    selectedTargets: { fleet: moving.id, planet: destination.id },
    selectedInputs: { strength: 1 },
  })
  const state = toActionEligibilityState(view),
    ruleset = typedParse(RulesetSchema, view.ruleset)
  expect(evaluateActionSelection({ state, ruleset, action: candidate, selection: candidate, mode: "complete" }).eligible).toBe(false)
  expect(
    resolveTurn(structuredClone({ ...state, submittedActions: [candidate], winnerPlayerId: undefined }), ruleset, createSeededRng(1234)),
  ).toMatchObject({ type: "Failure", error: { type: "INVALID_SUBMISSIONS" } })
  expect(await actions.submitRawSelection(view, sibling, candidate.selectedTargets, candidate.selectedInputs)).toMatchObject({
    status: 400,
  })
  expect(await actions.refreshPlayerView()).toStrictEqual(view)
  await actions.toggleActionSelection("Political Campaign")
  await actions.toggleActionSelection("Refine Fuel")
  await advance(14)
}

async function verifyCombinedArrival({ right, left, testInfo }: UnifiedFleetJourney): Promise<void> {
  const fleets = await new GalaxyPage(right.page).openFleets()
  await expect(fleets.rows).toHaveCount(5)
  await expect(fleets.rowByStrength(25)).toHaveCount(0)
  await expect(fleets.rowByStrength(30)).toHaveCount(0)
  await expect(fleets.rowByStrengthAndDistance(5, "-")).toHaveCount(1)
  await expect(fleets.rowByStrengthAndDistance(5, "7.08 ly")).toHaveCount(1)
  await expect(fleets.rowByStrength(15)).toHaveCount(1)
  await expect(fleets.rowByStrength(35)).toHaveCount(1)
  const actions = await fleets.openActions(),
    view = await actions.refreshPlayerView()
  expect([view.resources.INFLUENCE.total, view.resources.METAL.total, view.resources.FUEL.total]).toEqual([8, 0, 5])
  const target = view.galaxy.systems.flatMap((system) => system.planets).find((planet) => planet.coordinates === "35:35:40"),
    opponent = view.galaxy.systems.flatMap((system) => system.planets).find((planet) => planet.coordinates === "44:96:25")
  Assert.isDefined(target)
  Assert.isDefined(opponent)
  expect(target.ownerPlayerId).not.toBeNull()
  expect(opponent.ownerPlayerId).not.toBe(view.player.id)
  const ownerAlias = target.ownerPlayerId === view.player.id ? right.alias : left.alias
  const galaxy = await (await actions.openFleets()).openOriginPlanet((await actions.openFleets()).rowByStrength(15))
  await expect(galaxy.planet("planet 404958")).toHaveAttribute("aria-label", `View planet 404958 details, owned by ${ownerAlias}`)
  await expect(galaxy.fleetMarkerAtStrength(15)).toBeVisible()
  await expect(galaxy.fleetMarkerAtStrength(35)).toBeVisible()
  await right.page.screenshot({ path: testInfo.outputPath("contested-colonization.png"), fullPage: true })
}

async function reuseOriginalAttack({ right, advance }: UnifiedFleetJourney): Promise<void> {
  const actions = await new GalaxyPage(right.page).openActions()
  const fleets = await actions.refreshPlayerView(),
    source = fleets.fleets.find((fleet) => fleet.ownerPlayerId === fleets.player.id && fleet.strength === 10)
  Assert.isDefined(source)
  await actions.searchTarget("Attack Move", "Standard Directive", "Fleet", `Fleet ${source.id.slice(0, 8)}`)
  await actions.chooseTarget("Fleet", `Fleet ${source.id.slice(0, 8)} (${source.strength} strength)`)
  await actions.searchTarget("Attack Move", "Standard Directive", "Planet", "44:96:25")
  await actions.chooseTarget("Planet", "44:96:25")
  await actions.setNumericInput("Attack Move", "Standard Directive", "Strength", "1")
  await actions.toggleActionSelection("Attack Move", "Standard Directive")
  await expect(actions.selectActionButton("Attack Move", "Standard Directive")).toHaveAttribute("aria-pressed", "true")
  const submitted = await actions.refreshPlayerView()
  expect(submitted.actions.find((action) => action.id === "ATTACK_MOVE_STANDARD_1")).toMatchObject({
    status: "SUBMITTED",
    selectedInputs: { strength: 1 },
    selectedTargets: { fleet: source.id },
  })
  await advance(15)
  const next = await new GalaxyPage(right.page).openFleets()
  await expect(next.remainingDistance(next.rowByStrength(1))).toHaveText("7.08 ly")
  await expect(next.rowByStrengthAndDistance(5, "2.08 ly")).toHaveCount(1)
  await expect(next.rowByStrength(9)).toHaveCount(1)
  const view = await (await next.openActions()).refreshPlayerView()
  expect(view.fleets.find((fleet) => fleet.movement?.submittedAction.id === "ATTACK_MOVE_STANDARD_1")?.movement?.initiatingTurn).toBe(14)
  expect([view.resources.INFLUENCE.total, view.resources.METAL.total, view.resources.FUEL.total]).toEqual([3, 0, 4])
  await advance(16)
}

async function verifyFinalMergedFleet({ right, left, testInfo }: UnifiedFleetJourney): Promise<void> {
  const fleets = await new GalaxyPage(right.page).openFleets()
  await expect(fleets.rows).toHaveCount(4)
  await expect(fleets.strength(fleets.rowByOriginCoordinate("46:93:25"))).toHaveText("9")
  await expect(fleets.strength(fleets.rowByOriginCoordinate("44:96:25"))).toHaveText("11")
  await expect(fleets.rowByStrength(15)).toHaveCount(1)
  await expect(fleets.rowByStrength(35)).toHaveCount(1)
  await fleets.reload()
  await expect(fleets.rows).toHaveCount(4)
  const actions = await fleets.openActions(),
    view = await actions.refreshPlayerView()
  expect(view.fleets.reduce((total, fleet) => total + fleet.strength, 0)).toBe(70)
  expect(
    view.fleets.every(
      (fleet) => fleet.movement === undefined && fleet.distanceToEnd === undefined && fleet.destinationPlanetId === undefined,
    ),
  ).toBe(true)
  for (const id of ["ATTACK_MOVE_STANDARD_1", "MOVE_FLEET_EXCEPTIONAL_1", "COLONIZE_PLANET_STANDARD_1"])
    expect(view.actions.find((action) => action.id === id)?.status).toBe("AVAILABLE")
  for (const [resource, value] of [
    ["Influence", 3],
    ["Metal", 0],
    ["Fuel", 4],
    ["Colony", 0],
  ] as const)
    await expect(actions.resource(resource)).toHaveAttribute("aria-label", `${value} available of ${value} ${resource}`)
  const opposing = await (await new GalaxyPage(left.page).openActions()).refreshPlayerView()
  expect([opposing.resources.INFLUENCE.total, opposing.resources.METAL.total, opposing.resources.FUEL.total]).toEqual([20, 1, 1])
  const finalFleets = await actions.openFleets()
  const map = await finalFleets.openOriginPlanet(finalFleets.rowByStrength(11))
  await expect(map.fleetMarkerAtStrength(11)).toBeVisible()
  await right.page.screenshot({ path: testInfo.outputPath("final-reused-attack.png"), fullPage: true })
}
