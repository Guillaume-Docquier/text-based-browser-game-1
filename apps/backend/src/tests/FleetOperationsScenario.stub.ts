import { Assert } from "@guillaume-docquier/tools-ts"
import type { Fleet } from "shared/domain/world/fleets/Fleet.ts"
import type { FleetId } from "shared/domain/world/fleets/FleetId.ts"
import type { Planet } from "shared/domain/world/planets/Planet.ts"
import type { PlanetId } from "shared/domain/world/planets/PlanetId.ts"
import { BuildFleetStandard } from "shared/testing/test-ruleset/action-definitions/build-fleet.ts"
import { GainFuel } from "shared/testing/test-ruleset/action-definitions/gain-fuel.ts"
import { GainInfluence } from "shared/testing/test-ruleset/action-definitions/gain-influence.ts"
import { GainMetal } from "shared/testing/test-ruleset/action-definitions/gain-metal.ts"
import type { PlayerView } from "#api/types.ts"
import { createCombatActionsScenario } from "#tests/CombatActionsScenario.stub.ts"
import type { FleetActionsScenario } from "#tests/FleetActionsScenario.stub.ts"

/** Exact I5-01 normal funding, generated geometry and explicit original source IDs. */
export async function createFleetOperationsScenario(options: Parameters<typeof createCombatActionsScenario>[0]): Promise<
  Awaited<ReturnType<typeof createCombatActionsScenario>> & {
    right: FleetActionsScenario
    left: FleetActionsScenario
    before: PlayerView
    opposing: PlayerView
    rightHome: Planet
    leftHome: Planet
    rightSource: Fleet
    leftSource: Fleet
    destination: Planet
    checkpoints: PlayerView[]
  }
> {
  const fixture = await createCombatActionsScenario({ ...options, defenderBuildThroughTurn: 5 })
  const { attacker: right, defender: left } = fixture
  const checkpoints = [fixture.funded]
  const rightHome = await observedHome(right),
    leftHome = await observedHome(left)
  for (let turn = 6; turn <= 11; turn++) {
    for (const side of [right, left]) {
      if (turn <= 7 || (side === right && turn <= 9))
        await side.submitDefinition(BuildFleetStandard.id, { planet: side === right ? rightHome.id : leftHome.id })
      if (side === right && turn === 8) await side.submitDefinition(GainMetal.id)
      if (side === right && turn === 10) await side.submitDefinition(GainFuel.id)
      await side.submitDefinition(GainInfluence.id)
    }
    Assert.isTrue((await right.endTurn()) === "processed")
    checkpoints.push(await right.view())
  }
  const before = await right.view(),
    opposing = await left.view()
  const rightSource = before.fleets.find((fleet) => fleet.ownerPlayerId === before.player.id),
    leftSource = opposing.fleets.find((fleet) => fleet.ownerPlayerId === opposing.player.id)
  const destination = before.galaxy.systems.flatMap((system) => system.planets).find((planet) => planet.coordinates === "35:35:40")
  Assert.isDefined(rightSource)
  Assert.isDefined(leftSource)
  Assert.isDefined(destination)
  return { ...fixture, right, left, before, opposing, rightHome, leftHome, rightSource, leftSource, destination, checkpoints }
}

/** Explicit source identity avoids selecting an incidental station after arrival. */
type FleetOrder = Readonly<{
  side: FleetActionsScenario
  actionId: string
  source: FleetId
  destination: PlanetId
  amount: number
  mapping?: Readonly<{ source: string; destination: string; strength: string }>
}>

export const authoredFleetOrderMapping = { source: "craft", destination: "world", strength: "force" } as const

export async function submitFleetOrder({
  side,
  actionId,
  source,
  destination,
  amount,
  mapping = { source: "fleet", destination: "planet", strength: "strength" },
}: FleetOrder): Promise<void> {
  const view = await side.view()
  await side.player.client.gameplay.updateActionSubmission.mutate({
    gameId: side.gameId,
    turn: view.turn,
    submittedActionTargets: {
      actionId,
      selectedTargets: { [mapping.source]: source, [mapping.destination]: destination },
      selectedInputs: { [mapping.strength]: amount },
    },
  })
}

async function observedHome(side: FleetActionsScenario): Promise<Planet> {
  const view = await side.view()
  const planet = view.galaxy.systems.flatMap((system) => system.planets).find((planet) => planet.ownerPlayerId === view.player.id)
  Assert.isDefined(planet)
  return planet
}
