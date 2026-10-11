import { Assert } from "@guillaume-docquier/tools-ts"
import { createGameConfigurationStub } from "shared/domain/games/GameConfiguration.stub.ts"
import { BuildFleetStandard } from "shared/testing/test-ruleset/action-definitions/build-fleet.ts"
import { GainInfluence } from "shared/testing/test-ruleset/action-definitions/gain-influence.ts"
import { GainMetal } from "shared/testing/test-ruleset/action-definitions/gain-metal.ts"
import type { PlayerView, GameId } from "#api/types.ts"
import type { ControlledClock } from "#lib/ControlledClock.ts"
import type { AuthenticatedApiClient } from "#tests/ApiClient.ts"
import { FleetActionsScenario } from "#tests/FleetActionsScenario.stub.ts"
import type { TurnProcessor } from "#turn-processing/TurnProcessor.ts"
import type { TurnsRepository } from "#turn-processing/turns.repository.ts"

/** Two seeded homes and all funding/Strength reached through normal router actions. */
export async function createCombatActionsScenario({
  players,
  clock,
  processor,
  turnsRepository,
  defenderBuildThroughTurn = 3,
}: {
  players: [AuthenticatedApiClient, AuthenticatedApiClient]
  clock: ControlledClock
  processor: TurnProcessor
  turnsRepository: TurnsRepository
  defenderBuildThroughTurn?: number
}): Promise<{ attacker: FleetActionsScenario; defender: FleetActionsScenario; funded: PlayerView; gameId: GameId }> {
  const [creator, joiner] = players
  const { createdGameId: gameId } = await creator.client.games.create.mutate({
    configuration: createGameConfigurationStub({ nbSeats: 2, mapGenerationSeed: 1234, turnIntervalSeconds: 10 }),
  })
  await joiner.client.games.join.mutate({ gameId })
  await creator.client.games.startGame.mutate({ gameId })
  const first = new FleetActionsScenario({ player: creator, clock, processor, turnsRepository, gameId })
  const second = new FleetActionsScenario({ player: joiner, clock, processor, turnsRepository, gameId })
  const view = await first.view()
  const home = view.galaxy.systems.flatMap((system) => system.planets).find((planet) => planet.ownerPlayerId === view.player.id)
  Assert.isDefined(home)
  const [attacker, defender] = home.x > 50 ? [first, second] : [second, first]
  for (const scenario of [attacker, defender]) {
    await scenario.submitDefinition(GainInfluence.id)
    await scenario.submitDefinition(GainMetal.id)
  }
  await attacker.endTurn()
  const funded = await attacker.view()
  for (let turn = 2; turn <= 5; turn++) {
    for (const scenario of turn <= defenderBuildThroughTurn ? [attacker, defender] : [attacker]) {
      const own = await scenario.view()
      const origin = own.galaxy.systems.flatMap((system) => system.planets).find((planet) => planet.ownerPlayerId === own.player.id)
      Assert.isDefined(origin)
      await scenario.submitDefinition(BuildFleetStandard.id, { planet: origin.id })
      await scenario.submitDefinition(GainInfluence.id)
    }
    await attacker.endTurn()
  }
  return { attacker, defender, funded, gameId }
}
