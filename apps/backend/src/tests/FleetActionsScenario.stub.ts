import { Assert, branded, Time, UnitOfTime } from "@guillaume-docquier/tools-ts"
import { createGameConfigurationStub } from "shared/domain/games/GameConfiguration.stub.ts"
import type { PlayerId } from "shared/domain/players/PlayerId.ts"
import type { ActionDefinitionId } from "shared/domain/ruleset/action-definitions/ActionDefinitionId.ts"
import { BuildFleetStandard } from "shared/testing/test-ruleset/action-definitions/build-fleet.ts"
import { GainFuel } from "shared/testing/test-ruleset/action-definitions/gain-fuel.ts"
import { GainInfluence } from "shared/testing/test-ruleset/action-definitions/gain-influence.ts"
import { GainMetal } from "shared/testing/test-ruleset/action-definitions/gain-metal.ts"
import { MoveFleetStandard } from "shared/testing/test-ruleset/action-definitions/move-fleet.ts"
import type { GameId, PlayerView } from "#api/types.ts"
import type { ControlledClock } from "#lib/ControlledClock.ts"
import type { AuthenticatedApiClient } from "#tests/ApiClient.ts"
import type { TurnProcessor } from "#turn-processing/TurnProcessor.ts"
import type { TurnsRepository } from "#turn-processing/turns.repository.ts"

/** Gameplay setup exclusively through routers; processing uses production services. */
export class FleetActionsScenario {
  public readonly player: AuthenticatedApiClient
  public readonly gameId: GameId
  private readonly clock: ControlledClock
  private readonly processor: TurnProcessor
  private readonly turnsRepository: TurnsRepository
  public constructor({
    player,
    gameId,
    clock,
    processor,
    turnsRepository,
  }: {
    player: AuthenticatedApiClient
    gameId: GameId
    clock: ControlledClock
    processor: TurnProcessor
    turnsRepository: TurnsRepository
  }) {
    this.player = player
    this.gameId = gameId
    this.clock = clock
    this.processor = processor
    this.turnsRepository = turnsRepository
  }
  public static async create({
    player,
    clock,
    processor,
    turnsRepository,
  }: {
    player: AuthenticatedApiClient
    clock: ControlledClock
    processor: TurnProcessor
    turnsRepository: TurnsRepository
  }): Promise<FleetActionsScenario> {
    const { createdGameId: gameId } = await player.client.games.create.mutate({
      configuration: createGameConfigurationStub({ mapGenerationSeed: 1234, turnIntervalSeconds: 10 }),
    })
    await player.client.games.startGame.mutate({ gameId })
    const scenario = new FleetActionsScenario({ player, gameId, clock, processor, turnsRepository })
    // Fund and build 50 without DB fixture writes or test repositories.
    await scenario.submitDefinition(GainInfluence.id)
    await scenario.submitDefinition(GainMetal.id)
    await scenario.submitDefinition(GainFuel.id)
    await scenario.endTurn()
    for (let build = 0; build < 5; build++) {
      const view = await scenario.view()
      const origin = view.galaxy.systems
        .flatMap((system) => system.planets)
        .find((planet) => planet.ownerPlayerId === branded<PlayerId>(player.account.id))
      Assert.isDefined(origin)
      await scenario.submitDefinition(BuildFleetStandard.id, { planet: origin.id })
      await scenario.submitDefinition(GainInfluence.id)
      await scenario.submitDefinition(GainMetal.id)
      await scenario.submitDefinition(GainFuel.id)
      await scenario.endTurn()
    }
    await scenario.submitDefinition(GainInfluence.id)
    await scenario.endTurn()
    return scenario
  }
  public async view(): Promise<PlayerView> {
    return await this.player.client.gameplay.getPlayerView.query({ gameId: this.gameId })
  }
  public async submitDefinition(
    definition: ActionDefinitionId,
    selectedTargets: Record<string, string> = {},
    selectedInputs: Record<string, number> = {},
  ): Promise<void> {
    const view = await this.view()
    const action = view.actions.find((action) => action.actionDefinitionId === definition && action.status === "AVAILABLE")
    Assert.isDefined(action)
    await this.player.client.gameplay.updateActionSubmission.mutate({
      gameId: this.gameId,
      turn: view.turn,
      submittedActionTargets: { actionId: action.id, selectedTargets, selectedInputs },
    })
  }
  public async move(actionId: string, amount: number, destinationId?: string): Promise<void> {
    const view = await this.view()
    const source = view.fleets.find(
      (fleet) => fleet.ownerPlayerId === branded<PlayerId>(this.player.account.id) && fleet.destinationPlanetId === undefined,
    )
    const destination = view.galaxy.systems.flatMap((system) => system.planets).find((planet) => planet.coordinates === "55:07:50")
    Assert.isDefined(source)
    Assert.isDefined(destination)
    await this.player.client.gameplay.updateActionSubmission.mutate({
      gameId: this.gameId,
      turn: view.turn,
      submittedActionTargets: {
        actionId,
        selectedTargets: { fleet: source.id, planet: destinationId ?? destination.id },
        selectedInputs: { strength: amount },
      },
    })
  }
  public async cancel(actionId: string): Promise<void> {
    const view = await this.view()
    await this.player.client.gameplay.updateActionSubmission.mutate({
      gameId: this.gameId,
      turn: view.turn,
      submittedActionTargets: { actionId, selectedTargets: null, selectedInputs: null },
    })
  }
  public async endTurn(): Promise<string> {
    this.clock.increment({ time: Time.create(10, UnitOfTime.SECONDS) })
    await this.turnsRepository.markDueTurnsAwaitingProcessing({ since: this.clock.now() })
    return await this.processor.processNextDueTurn()
  }
  public async moveInstances(): Promise<string[]> {
    return (await this.view()).actions.filter((action) => action.actionDefinitionId === MoveFleetStandard.id).map((action) => action.id)
  }
}
