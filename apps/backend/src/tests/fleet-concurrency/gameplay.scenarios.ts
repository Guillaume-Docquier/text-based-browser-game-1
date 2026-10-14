import { eq } from "drizzle-orm"
import type { PlayerId } from "shared/domain/players/PlayerId.ts"
import { ResourceType } from "shared/domain/resources/ResourceType.ts"
import { Ruleset } from "shared/domain/ruleset/Ruleset.ts"
import { TurnStatus } from "shared/domain/turns/TurnStatus.ts"
import { BuildFleetStandard } from "shared/testing/test-ruleset/action-definitions/build-fleet.ts"
import { GainFuel } from "shared/testing/test-ruleset/action-definitions/gain-fuel.ts"
import { GainInfluence } from "shared/testing/test-ruleset/action-definitions/gain-influence.ts"
import { GainMetal } from "shared/testing/test-ruleset/action-definitions/gain-metal.ts"
import { MoveFleetStandard } from "shared/testing/test-ruleset/action-definitions/move-fleet.ts"
import { TestRuleset } from "shared/testing/test-ruleset/TestRuleset.ts"
import { expect } from "vitest"
import { z } from "zod"
import type { GameId, PlayerView } from "#api/types.ts"
import type { ControlledClock } from "#lib/ControlledClock.ts"
import type { Database } from "#lib/db/createDb.ts"
import { actionsTable, fleetsTable, gamesTable, planetsTable, resourcesTable, turnsProcessingTable, turnsTable } from "#lib/db/schema.ts"
import type { AuthenticatedApiClient } from "#tests/ApiClient.ts"
import type { createTurnProcessorStub } from "#turn-processing/TurnProcessor.stub.ts"
import { type ProcessedTurnModel, TurnsRepository } from "#turn-processing/turns.repository.ts"
import {
  MANUAL_WORKER_CLOCK_ADVANCE,
  RULESET_ID_FOR_STRENGTH_RACES,
  RULESET_ID_FOR_RESOURCE_RACE,
  WorkerBuildFleetForty,
} from "./gameplay.rulesets.ts"
import { sortGameplayRows, type ColonizationPersistenceSnapshot, type WorkerTieFundingRound } from "./gameplay.ts"

export function getWorkerTieFundingRounds(): readonly WorkerTieFundingRound[] {
  return [
    { actionDefinitionIds: [GainInfluence.id], expectedInfluence: 8 },
    { actionDefinitionIds: [GainInfluence.id, WorkerBuildFleetForty.id, GainMetal.id], expectedInfluence: 10 },
    { actionDefinitionIds: [GainInfluence.id, GainFuel.id], expectedInfluence: 13 },
    { actionDefinitionIds: [GainInfluence.id], expectedInfluence: 18 },
    { actionDefinitionIds: [GainInfluence.id], expectedInfluence: 23 },
    { actionDefinitionIds: [GainInfluence.id], expectedInfluence: 28 },
    { actionDefinitionIds: [GainInfluence.id], expectedInfluence: 33 },
    { actionDefinitionIds: [GainInfluence.id], expectedInfluence: 38 },
    { actionDefinitionIds: [GainInfluence.id], expectedInfluence: 43 },
    { actionDefinitionIds: [GainInfluence.id], expectedInfluence: 48 },
    { actionDefinitionIds: [GainInfluence.id], expectedInfluence: 53 },
  ]
}

export async function readColonizationPersistenceSnapshot(db: Database, gameId: GameId): Promise<ColonizationPersistenceSnapshot> {
  const [actions, fleets, games, planets, resources, turns, turnsProcessing] = await Promise.all([
    db.select().from(actionsTable).where(eq(actionsTable.gameId, gameId)),
    db.select().from(fleetsTable).where(eq(fleetsTable.gameId, gameId)),
    db.select().from(gamesTable).where(eq(gamesTable.id, gameId)),
    db.select().from(planetsTable).where(eq(planetsTable.gameId, gameId)),
    db.select().from(resourcesTable).where(eq(resourcesTable.gameId, gameId)),
    db.select().from(turnsTable).where(eq(turnsTable.gameId, gameId)),
    db.select().from(turnsProcessingTable).where(eq(turnsProcessingTable.gameId, gameId)),
  ])

  return {
    actions: sortGameplayRows(actions),
    fleets: sortGameplayRows(fleets),
    games: sortGameplayRows(games),
    planets: sortGameplayRows(planets),
    resources: sortGameplayRows(resources),
    turns: sortGameplayRows(turns),
    turnsProcessing: sortGameplayRows(turnsProcessing),
  }
}

export class InvalidOwnerProjectionTurnsRepository extends TurnsRepository {
  private readonly invalidOwnerPlayerId: PlayerId
  private readonly beforeInvalidSave: (processedTurn: ProcessedTurnModel) => Promise<void>
  private injectInvalidOwnerProjection = true

  public constructor({
    db,
    logger,
    invalidOwnerPlayerId,
    beforeInvalidSave,
  }: ConstructorParameters<typeof TurnsRepository>[0] & {
    invalidOwnerPlayerId: PlayerId
    beforeInvalidSave: (processedTurn: ProcessedTurnModel) => Promise<void>
  }) {
    super({ db, logger })
    this.invalidOwnerPlayerId = invalidOwnerPlayerId
    this.beforeInvalidSave = beforeInvalidSave
  }

  public allowOwnershipChangesForRetry(): void {
    this.injectInvalidOwnerProjection = false
  }

  public override async saveProcessedTurn(
    processedTurn: ProcessedTurnModel,
    db?: Parameters<TurnsRepository["saveProcessedTurn"]>[1],
  ): Promise<Awaited<ReturnType<TurnsRepository["saveProcessedTurn"]>>> {
    if (processedTurn.planetOwnershipChanges.length === 0 || !this.injectInvalidOwnerProjection) {
      return await super.saveProcessedTurn(processedTurn, db)
    }

    await this.beforeInvalidSave(processedTurn)
    return await super.saveProcessedTurn(
      {
        ...processedTurn,
        planetOwnershipChanges: processedTurn.planetOwnershipChanges.map((change) => ({
          ...change,
          ownerPlayerId: this.invalidOwnerPlayerId,
        })),
      },
      db,
    )
  }
}

export function findUnoccupiedUnclaimedAssaultDestination(
  view: PlayerView,
  source: PlayerView["galaxy"]["systems"][number]["planets"][number],
  excludedPlanetId: PlayerView["galaxy"]["systems"][number]["planets"][number]["id"],
): PlayerView["galaxy"]["systems"][number]["planets"][number] | undefined {
  return view.galaxy.systems
    .flatMap(({ planets }) => planets)
    .find((planet) => {
      const distance = Math.hypot(planet.x - source.x, planet.y - source.y)
      const isUnclaimed = planet.ownerPlayerId === null || planet.ownerPlayerId === undefined
      const isUnoccupied = view.fleets.every(
        ({ originPlanetId, destinationPlanetId }) => originPlanetId !== planet.id && destinationPlanetId !== planet.id,
      )
      return isUnclaimed && planet.id !== excludedPlanetId && distance > 4.418312565270031 && distance <= 5 && isUnoccupied
    })
}

export const StrengthRaceRuleset = Ruleset.create({
  ...TestRuleset,
  id: RULESET_ID_FOR_STRENGTH_RACES,
  actionPool: [
    ...TestRuleset.actionPool,
    { id: "MOVE_FLEET_STANDARD_2", actionDefinitionId: MoveFleetStandard.id },
    { id: "MOVE_FLEET_STANDARD_3", actionDefinitionId: MoveFleetStandard.id },
  ],
  startingResources: {
    ...TestRuleset.startingResources,
    [ResourceType.INFLUENCE]: 16,
    [ResourceType.METAL]: 5,
    [ResourceType.FUEL]: 2,
  },
})

export const ComposedReservationRaceRuleset = Ruleset.create({
  ...TestRuleset,
  id: "test_composed_reservation_race",
  startingResources: {
    ...TestRuleset.startingResources,
    [ResourceType.INFLUENCE]: 18,
    [ResourceType.METAL]: 10,
    [ResourceType.FUEL]: 2,
  },
})

export const ResourceRaceRuleset = Ruleset.create({
  ...TestRuleset,
  id: RULESET_ID_FOR_RESOURCE_RACE,
  actionPool: [...TestRuleset.actionPool, { id: "BUILD_FLEET_STANDARD_2", actionDefinitionId: BuildFleetStandard.id }],
  startingResources: {
    ...TestRuleset.startingResources,
    [ResourceType.INFLUENCE]: 3,
    [ResourceType.METAL]: 2,
  },
})

export async function markManualDeadlineDue(input: MarkManualDeadlineDueInput): Promise<void> {
  input.clock.increment({ time: MANUAL_WORKER_CLOCK_ADVANCE })
  await input.turnsRepository.markDueTurnsAwaitingProcessing({ since: input.clock.now() })
}

export async function processManualDeadlineTurn(input: ProcessManualDeadlineTurnInput): Promise<void> {
  await markManualDeadlineDue({ ...input })
  expect(await input.turnProcessor.processNextDueTurn()).toBe("processed")
  const nextView = await input.client.gameplay.getPlayerView.query({ gameId: input.gameId })
  expect(nextView.turn).toBe(input.turn + 1)
  expect(nextView.turnStatus).toBe(TurnStatus.COLLECTING_ACTIONS)
}

export function normalizeApiDate(value: Date | string): Date {
  return z.coerce.date().parse(value)
}

export async function waitForCollectingSuccessor(
  input: WaitForCollectingSuccessorInput,
): Promise<Awaited<ReturnType<AuthenticatedApiClient["client"]["gameplay"]["getPlayerView"]["query"]>>> {
  await expect
    .poll(
      async () => {
        const view = await input.client.gameplay.getPlayerView.query({ gameId: input.gameId })
        return { turn: view.turn, turnStatus: view.turnStatus }
      },
      { interval: 100, timeout: 12_000 },
    )
    .toStrictEqual({ turn: input.closedTurn + 1, turnStatus: "COLLECTING_ACTIONS" })

  return await input.client.gameplay.getPlayerView.query({ gameId: input.gameId })
}

export function createStartGate(parties: number): () => Promise<void> {
  const gate = Promise.withResolvers<undefined>()
  let arrivals = 0
  return async () => {
    arrivals += 1
    if (arrivals === parties) {
      gate.resolve(undefined)
    }
    await gate.promise
  }
}

type MarkManualDeadlineDueInput = {
  clock: ControlledClock
  turnsRepository: TurnsRepository
}

type ProcessManualDeadlineTurnInput = {
  clock: ControlledClock
  turnProcessor: Awaited<ReturnType<typeof createTurnProcessorStub>>["turnProcessor"]
  turnsRepository: TurnsRepository
  client: AuthenticatedApiClient["client"]
  gameId: GameId
  turn: number
}

type WaitForCollectingSuccessorInput = {
  client: AuthenticatedApiClient["client"]
  gameId: number
  closedTurn: number
}

type SubmitActionAfterGateInput = {
  client: AuthenticatedApiClient["client"]
  submission: Parameters<AuthenticatedApiClient["client"]["gameplay"]["updateActionSubmission"]["mutate"]>[0]
}
export async function submitActionAfterGate(
  waitAtStart: () => Promise<void>,
  { client, submission }: SubmitActionAfterGateInput,
): Promise<void> {
  await waitAtStart()
  await client.gameplay.updateActionSubmission.mutate(submission)
}
