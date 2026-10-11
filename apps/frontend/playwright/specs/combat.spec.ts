import { Assert, Time, UnitOfTime } from "@guillaume-docquier/tools-ts"
import type { AuthenticatedUser } from "../AuthenticatedUser.ts"
import { expect, test } from "../fixtures.ts"
import { CreateGamePage } from "../pages/CreateGamePage.ts"
import { GalaxyPage } from "../pages/GalaxyPage.ts"
import { GameDetailsPage } from "../pages/GameDetailsPage.ts"

test("Attack Move persists then exchanges normal combat without conquest or repeated costs", async ({ alice, bob }) => {
  test.setTimeout(300000)
  let attacker = alice,
    defender = bob
  const details = await test.step("Create and join a seeded two-player Test game", async () =>
    await CreateGamePage.createGame({
      creator: alice,
      participants: [bob],
      settings: { maxPlayers: 2, turnLength: Time.create(1, UnitOfTime.DAYS) },
    }))
  await test.step("Start and assign right-side attacker from the observed homes", async () => {
    await details.reload()
    const firstGalaxy = await details.startGame()
    const participantDetails = new GameDetailsPage(bob.page)
    await participantDetails.reload()
    await participantDetails.openGame()
    const actions = await firstGalaxy.openActions()
    const view = await actions.refreshPlayerView()
    const home = view.galaxy.systems.flatMap((system) => system.planets).find((planet) => planet.ownerPlayerId === view.player.id)
    Assert.isDefined(home)
    if (home.x < 50) [attacker, defender] = [bob, alice]
    const attackView = await (await new GalaxyPage(attacker.page).openActions()).refreshPlayerView()
    expect(
      attackView.galaxy.systems.flatMap((system) => system.planets).find((planet) => planet.ownerPlayerId === attackView.player.id)
        ?.coordinates,
    ).toBe("46:93:25")
  })
  await test.step("Fund both empires through Political Campaign and Extract Metal", async () => {
    await fundCombatEmpires({ attacker, defender })
  })
  for (let turn = 2; turn <= 5; turn++)
    await test.step(`Build attacker40/defender20 using ordinary turn ${turn} actions`, async () => {
      await buildCombatForces({ attacker, defender }, turn)
    })
  await test.step("Select Attack Move30 toward the opposing home with configured rules", async () => {
    await departAttack({ attacker, defender })
  })
  await test.step("Reload the paid bound journey and advance without another Attack", async () => {
    await observePaidAttack({ attacker, defender })
  })
  await test.step("See survivors, released instance and unchanged opposing ownership after combat", async () => {
    await verifyCombatSurvivors({ attacker, defender })
  })
})

type CombatJourney = Readonly<{ attacker: AuthenticatedUser; defender: AuthenticatedUser }>

async function fundCombatEmpires({ attacker, defender }: CombatJourney): Promise<void> {
  for (const user of [attacker, defender]) {
    const actions = await new GalaxyPage(user.page).openActions()
    await actions.toggleActionSelection("Political Campaign")
    await actions.toggleActionSelection("Extract Metal")
  }
  const left = await new GalaxyPage(attacker.page).openPlayers(),
    right = await new GalaxyPage(defender.page).openPlayers()
  await left.toggleReady()
  await right.toggleReady()
  await expect(left.turn).toHaveText("Turn 2", { timeout: 15000 })
  await expect(right.turn).toHaveText("Turn 2", { timeout: 15000 })
  await expect(left.resource("Influence")).toHaveAttribute("aria-label", "7 available of 7 Influence")
  await expect(left.resource("Metal")).toHaveAttribute("aria-label", "7 available of 7 Metal")
}

async function buildCombatForces({ attacker, defender }: CombatJourney, turn: number): Promise<void> {
  for (const user of turn <= 3 ? [attacker, defender] : [attacker]) {
    const actions = await new GalaxyPage(user.page).openActions()
    await actions.toggleActionSelection("Build Fleet", "Standard Directive")
    await actions.toggleActionSelection("Political Campaign")
  }
  const left = await new GalaxyPage(attacker.page).openPlayers(),
    right = await new GalaxyPage(defender.page).openPlayers()
  await left.toggleReady()
  await right.toggleReady()
  await expect(left.turn).toHaveText(`Turn ${turn + 1}`, { timeout: 15000 })
  await expect(right.turn).toHaveText(`Turn ${turn + 1}`, { timeout: 15000 })
}

async function departAttack({ attacker, defender }: CombatJourney): Promise<void> {
  const fleets = await new GalaxyPage(attacker.page).openFleets()
  await expect(fleets.strength(fleets.rowByStrength(40))).toHaveText("40")
  await expect(fleets.strength(fleets.rowByStrength(20))).toHaveText("20")
  const actions = await fleets.openActions()
  await expect(actions.resource("Influence")).toHaveAttribute("aria-label", "19 available of 19 Influence")
  await expect(actions.action("Attack Move", "Standard Directive")).toContainText("10 light years per turn")
  await expect(actions.action("Attack Move", "Standard Directive")).toContainText("25 light years")
  await expect(actions.action("Attack Move", "Standard Directive")).toContainText("assault all enemy fleets")
  await expect(actions.actionCost("Attack Move", "5 Influence")).toBeVisible()
  await expect(actions.actionCost("Attack Move", "1 Fuel")).toBeVisible()
  await actions.searchTarget("Attack Move", "Standard Directive", "Planet", "44:96:25")
  await actions.chooseTarget("Planet", "44:96:25")
  await actions.setNumericInput("Attack Move", "Standard Directive", "Strength", "30")
  await actions.toggleActionSelection("Attack Move", "Standard Directive")
  const left = await actions.openPlayers(),
    right = await new GalaxyPage(defender.page).openPlayers()
  await left.toggleReady()
  await right.toggleReady()
  await expect(left.turn).toHaveText("Turn 7", { timeout: 15000 })
  await expect(right.turn).toHaveText("Turn 7", { timeout: 15000 })
}

async function observePaidAttack({ attacker, defender }: CombatJourney): Promise<void> {
  const fleets = await new GalaxyPage(attacker.page).openFleets()
  await expect(fleets.rows).toHaveCount(3)
  await expect(fleets.strength(fleets.rowByStrength(10))).toHaveText("10")
  await expect(fleets.strength(fleets.rowByStrength(20))).toHaveText("20")
  await expect(fleets.remainingDistance(fleets.rowByStrength(30))).toHaveText("7.08 ly")
  await fleets.reload()
  await expect(fleets.remainingDistance(fleets.rowByStrength(30))).toHaveText("7.08 ly")
  const actions = await fleets.openActions()
  await expect(actions.action("Attack Move", "Standard Directive")).toContainText("In progress:")
  await expect(actions.selectActionButton("Attack Move", "Standard Directive")).toHaveCount(0)
  await expect(actions.resource("Influence")).toHaveAttribute("aria-label", "14 available of 14 Influence")
  await expect(actions.resource("Fuel")).toHaveAttribute("aria-label", "0 available of 0 Fuel")
  const view = await actions.refreshPlayerView()
  expect(view.actions.find((action) => action.id === "ATTACK_MOVE_STANDARD_2")?.status).toBe("AVAILABLE")
  const left = await actions.openPlayers(),
    right = await new GalaxyPage(defender.page).openPlayers()
  await left.toggleReady()
  await right.toggleReady()
  await expect(left.turn).toHaveText("Turn 8", { timeout: 15000 })
  await expect(right.turn).toHaveText("Turn 8", { timeout: 15000 })
}

async function verifyCombatSurvivors({ attacker, defender }: CombatJourney): Promise<void> {
  const fleets = await new GalaxyPage(attacker.page).openFleets()
  await expect(fleets.rows).toHaveCount(2)
  await expect(fleets.rowByStrength(20)).toHaveCount(0)
  await expect(fleets.strength(fleets.rowByOriginCoordinate("44:96:25"))).toHaveText("10")
  await expect(fleets.strength(fleets.rowByOriginCoordinate("46:93:25"))).toHaveText("10")
  await expect(fleets.remainingDistance(fleets.rowByOriginCoordinate("44:96:25"))).toHaveText("-")
  const galaxy = await fleets.openOriginPlanet(fleets.rowByOriginCoordinate("44:96:25"))
  await expect(galaxy.fleetStrength(galaxy.fleetMarkerAtStrength(10))).toHaveText("10")
  await expect(galaxy.fleetMarkerAtStrength(20)).toHaveCount(0)
  const actions = await galaxy.openActions()
  await expect(actions.selectActionButton("Attack Move", "Standard Directive")).toHaveText("Select action")
  await expect(actions.resource("Influence")).toHaveAttribute("aria-label", "14 available of 14 Influence")
  await expect(actions.resource("Fuel")).toHaveAttribute("aria-label", "0 available of 0 Fuel")
  const view = await actions.refreshPlayerView(),
    enemyView = await (await new GalaxyPage(defender.page).openActions()).refreshPlayerView()
  expect(view.galaxy.systems.flatMap((system) => system.planets).find((planet) => planet.coordinates === "44:96:25")?.ownerPlayerId).toBe(
    enemyView.player.id,
  )
  const reload = await actions.openFleets()
  await reload.reload()
  await expect(reload.rows).toHaveCount(2)
  await expect(reload.strength(reload.rowByOriginCoordinate("44:96:25"))).toHaveText("10")
}
