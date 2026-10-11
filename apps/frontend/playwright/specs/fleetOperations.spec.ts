import { Assert, Time, UnitOfTime } from "@guillaume-docquier/tools-ts"
import type { AuthenticatedUser } from "../AuthenticatedUser.ts"
import { expect, test } from "../fixtures.ts"
import { CreateGamePage } from "../pages/CreateGamePage.ts"
import { GalaxyPage } from "../pages/GalaxyPage.ts"
import { GameDetailsPage } from "../pages/GameDetailsPage.ts"
import { expectAvailableResources } from "./resourceAssertions.ts"

// Independent literal phase selections and checkpoints; the executor derives no expected state.
const UNIFIED_LATE_FUNDING_PHASES = [
  {
    turn: 8,
    nextTurn: 9,
    rightActions: [
      { name: "Build Fleet", identifyingText: "Standard Directive" },
      { name: "Extract Metal" },
      { name: "Political Campaign" },
    ],
    rightStrength: 70,
    rightResources: [27, 5, 1],
    leftResources: [30, 1, 1],
  },
  {
    turn: 9,
    nextTurn: 10,
    rightActions: [{ name: "Build Fleet", identifyingText: "Standard Directive" }, { name: "Political Campaign" }],
    rightStrength: 80,
    rightResources: [30, 4, 1],
    leftResources: [35, 1, 1],
  },
  {
    turn: 10,
    nextTurn: 11,
    rightActions: [{ name: "Refine Fuel" }, { name: "Political Campaign" }],
    rightStrength: 80,
    rightResources: [33, 2, 6],
    leftResources: [40, 1, 1],
  },
  {
    turn: 11,
    nextTurn: 12,
    rightActions: [{ name: "Political Campaign" }],
    rightStrength: 80,
    rightResources: [38, 2, 6],
    leftResources: [45, 1, 1],
  },
] as const

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
  await fundUnifiedEmpires({ right, left, advance })
  await test.step("T12 funded fleets and destinations outside ordinary Move range", async () => {
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
    for (const query of ["35:35:40", "44:96:25", "46:93:25"]) {
      await actions.searchTarget("Move Fleet", "Standard Directive", "Planet", query)
      await expect(actions.targetChoices("Planet").getByRole("option")).toHaveCount(0)
    }
  })
  await test.step("Select Colonize35 Attack30 Exceptional5 from the same80 and left Colonize35", async () => {
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
    await actions.setNumericInput("Attack Move", "Standard Directive", "Strength", "40")
    await actions.updateAction("Attack Move", "Standard Directive")
    await actions.setNumericInput("Attack Move", "Standard Directive", "Strength", "41")
    await expect(actions.updateActionButton("Attack Move", "Standard Directive")).toBeDisabled()
    const forty = await actions.refreshPlayerView()
    expect(forty.actions).toContainEqual(expect.objectContaining({ id: "ATTACK_MOVE_STANDARD_1", selectedInputs: { strength: 40 } }))
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
  })
  await test.step("Reload four paid journeys, exact distances and unavailable occupied actions", async () => {
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
    await expect(fleets.remainingDistance(fleets.rowByStrength(30))).toHaveText("7.08 ly")
    const actions = await fleets.openActions()
    for (const [name, tier] of [
      ["Colonize Planet", "Standard Directive"],
      ["Attack Move", "Standard Directive"],
      ["Move Fleet", "Exceptional Directive"],
    ] as const) {
      await expect(actions.action(name, tier)).toContainText("In progress:")
      await expect(actions.selectActionButton(name, tier)).toHaveCount(0)
    }
    await actions.toggleActionSelection("Political Campaign")
    await actions.toggleActionSelection("Refine Fuel")
    await advance(14)
  })
  await test.step("Combat30 versus25 leaves5; two eligible Colonize35 arrivals leave15 and35 with one owner", async () => {
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
    const defender = Object.values(view.opponents)[0]
    Assert.isDefined(defender)
    expect(opponent.ownerPlayerId).toBe(defender.id)
    const ownerAlias = target.ownerPlayerId === view.player.id ? right.alias : left.alias
    const galaxy = await (await actions.openFleets()).openOriginPlanet((await actions.openFleets()).rowByStrength(15))
    await expect(galaxy.planet("planet 404958")).toHaveAttribute("aria-label", `View planet 404958 details, owned by ${ownerAlias}`)
    await expect(galaxy.fleetMarkerAtStrength(15)).toBeVisible()
    await expect(galaxy.fleetMarkerAtStrength(35)).toBeVisible()
    await right.page.screenshot({ path: testInfo.outputPath("contested-colonization.png"), fullPage: true })
  })
  await test.step("Reuse the exact original Attack in immediately collecting T14 with chosen1", async () => {
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
    expect(submitted.actions).toContainEqual(
      expect.objectContaining({
        id: "ATTACK_MOVE_STANDARD_1",
        status: "SUBMITTED",
        selectedInputs: { strength: 1 },
        selectedTargets: expect.objectContaining({ fleet: source.id }),
      }),
    )
    await advance(15)
    const next = await new GalaxyPage(right.page).openFleets()
    await expect(next.remainingDistance(next.rowByStrength(1))).toHaveText("7.08 ly")
    await expect(next.rowByStrengthAndDistance(5, "2.08 ly")).toHaveCount(1)
    await expect(next.rowByStrength(9)).toHaveCount(1)
    const view = await (await next.openActions()).refreshPlayerView()
    expect(view.fleets).toContainEqual(
      expect.objectContaining({
        movement: expect.objectContaining({
          submittedAction: expect.objectContaining({ id: "ATTACK_MOVE_STANDARD_1" }),
          initiatingTurn: 14,
        }),
      }),
    )
    expect([view.resources.INFLUENCE.total, view.resources.METAL.total, view.resources.FUEL.total]).toEqual([3, 0, 4])
    await advance(16)
  })
  await test.step("Exceptional tick9 reinforces5 to10 then reused Attack tick15 merges11; reload preserves final70", async () => {
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
    expect(view.fleets.every((fleet) => fleet.movement === undefined)).toBe(true)
    expect(view.fleets.every((fleet) => fleet.distanceToEnd === undefined)).toBe(true)
    expect(view.fleets.every((fleet) => fleet.destinationPlanetId === undefined)).toBe(true)
    for (const id of ["ATTACK_MOVE_STANDARD_1", "MOVE_FLEET_EXCEPTIONAL_1", "COLONIZE_PLANET_STANDARD_1"])
      expect(view.actions).toContainEqual(expect.objectContaining({ id, status: "AVAILABLE" }))
    await expectAvailableResources(actions, { Influence: 3, Metal: 0, Fuel: 4, Colony: 0 })
    const opposing = await (await new GalaxyPage(left.page).openActions()).refreshPlayerView()
    expect([opposing.resources.INFLUENCE.total, opposing.resources.METAL.total, opposing.resources.FUEL.total]).toEqual([20, 1, 1])
    const finalFleets = await actions.openFleets()
    const map = await finalFleets.openOriginPlanet(finalFleets.rowByStrength(11))
    await expect(map.fleetMarkerAtStrength(11)).toBeVisible()
    await right.page.screenshot({ path: testInfo.outputPath("final-reused-attack.png"), fullPage: true })
  })
})

type UnifiedFleetJourney = Readonly<{
  right: AuthenticatedUser
  left: AuthenticatedUser
  advance: (turn: number) => Promise<void>
}>

async function fundInitialUnifiedEmpires({ right, left, advance }: UnifiedFleetJourney): Promise<void> {
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
    await expect(actions.resource("Fuel")).toHaveAttribute("aria-label", "1 available of 1 Fuel")
    const view = await actions.refreshPlayerView()
    expect(view.turn).toBe(2)
    expect([view.resources.INFLUENCE.total, view.resources.METAL.total, view.resources.FUEL.total]).toEqual([7, 7, 1])
    expect(view.resources.ENERGY).toEqual({ total: 0, uncommitted: 0 })
    expect(view.resources.COLONY).toEqual({ total: 0, uncommitted: 0 })
  }
}

type UnifiedFundingTurn = Readonly<{
  nextTurn: number
  selections: ReadonlyArray<
    Readonly<{
      user: AuthenticatedUser
      actions: ReadonlyArray<Readonly<{ name: string; identifyingText?: string }>>
    }>
  >
}>

async function buildUnifiedForces({ advance }: UnifiedFleetJourney, { nextTurn, selections }: UnifiedFundingTurn): Promise<void> {
  for (const { user, actions: selectionsForUser } of selections) {
    const actions = await new GalaxyPage(user.page).openActions()
    for (const selection of selectionsForUser) await actions.toggleActionSelection(selection.name, selection.identifyingText)
  }
  await advance(nextTurn)
}

async function fundUnifiedEmpires({ right, left, advance }: UnifiedFleetJourney): Promise<void> {
  await test.step("T1 Campaign and Extract give each7 Influence7 Metal1 Fuel", async () => {
    await fundInitialUnifiedEmpires({ right, left, advance })
  })
  for (let turn = 2; turn <= 7; turn++)
    await test.step(`Normal affordable Build then Campaign in T${turn}`, async () => {
      await buildUnifiedForces(
        { right, left, advance },
        {
          nextTurn: turn + 1,
          selections: [right, left].map((user) => ({
            user,
            actions: [{ name: "Build Fleet", identifyingText: "Standard Directive" }, { name: "Political Campaign" }],
          })),
        },
      )
    })
  await test.step("Collecting T8: both source60 and literal resources25/1/1/0/0", async () => {
    for (const user of [right, left]) {
      const fleets = await new GalaxyPage(user.page).openFleets()
      await expect(fleets.rowByOwnerAndStrength(user.alias, 60)).toHaveCount(1)
      const view = await (await fleets.openActions()).refreshPlayerView()
      expect(view.turn).toBe(8)
      expect(view.resources).toEqual({
        INFLUENCE: { total: 25, uncommitted: 25 },
        METAL: { total: 1, uncommitted: 1 },
        FUEL: { total: 1, uncommitted: 1 },
        ENERGY: { total: 0, uncommitted: 0 },
        COLONY: { total: 0, uncommitted: 0 },
      })
    }
  })
  for (const phase of UNIFIED_LATE_FUNDING_PHASES)
    await test.step(`T${phase.turn} ordered funding and collecting T${phase.nextTurn} literal checkpoint`, async () => {
      await buildUnifiedForces(
        { right, left, advance },
        {
          nextTurn: phase.nextTurn,
          selections: [
            { user: right, actions: phase.rightActions },
            { user: left, actions: [{ name: "Political Campaign" }] },
          ],
        },
      )
      for (const checkpoint of [
        { user: right, strength: phase.rightStrength, resources: phase.rightResources },
        { user: left, strength: 60, resources: phase.leftResources },
      ]) {
        const fleets = await new GalaxyPage(checkpoint.user.page).openFleets()
        await expect(fleets.rowByOwnerAndStrength(checkpoint.user.alias, checkpoint.strength)).toHaveCount(1)
        const view = await (await fleets.openActions()).refreshPlayerView()
        expect(view.turn).toBe(phase.nextTurn)
        expect([view.resources.INFLUENCE.total, view.resources.METAL.total, view.resources.FUEL.total]).toEqual(checkpoint.resources)
        expect(view.resources.ENERGY).toEqual({ total: 0, uncommitted: 0 })
        expect(view.resources.COLONY).toEqual({ total: 0, uncommitted: 0 })
      }
    })
}
