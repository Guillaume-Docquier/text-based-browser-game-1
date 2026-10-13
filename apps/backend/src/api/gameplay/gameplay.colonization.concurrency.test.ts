import { Assert, branded, indexBy, Logger, mulberry32Prng, Rng, Time, UnitOfTime, type DeepUnbranded } from "@guillaume-docquier/tools-ts"
import { typedParse } from "@guillaume-docquier/tools-ts/schemas"
import { eq } from "drizzle-orm"
import { compareOrdinalStrings } from "shared/domain/compareOrdinalStrings.ts"
import { createGameConfigurationStub } from "shared/domain/games/GameConfiguration.stub.ts"
import { GameIdSchema } from "shared/domain/games/GameId.ts"
import { PlayerIdSchema, type PlayerId } from "shared/domain/players/PlayerId.ts"
import { ResourceType } from "shared/domain/resources/ResourceType.ts"
import { ActionDefinitionSchema, type ActionDefinition } from "shared/domain/ruleset/action-definitions/ActionDefinition.ts"
import type { ActionDefinitionId } from "shared/domain/ruleset/action-definitions/ActionDefinitionId.ts"
import { ActionTier } from "shared/domain/ruleset/action-definitions/ActionTier.ts"
import { ActionType } from "shared/domain/ruleset/action-definitions/ActionType.ts"
import type { TargetTag } from "shared/domain/ruleset/action-definitions/TargetTag.ts"
import { FleetAssaultEffectDefinition } from "shared/domain/ruleset/effect-definitions/FleetAssaultEffectDefinition.ts"
import { FleetBuildEffectDefinition } from "shared/domain/ruleset/effect-definitions/FleetBuildEffectDefinition.ts"
import { FleetColonizeEffectDefinition } from "shared/domain/ruleset/effect-definitions/FleetColonizeEffectDefinition.ts"
import { FleetMoveEffectDefinition } from "shared/domain/ruleset/effect-definitions/FleetMoveEffectDefinition.ts"
import { ResourceLossEffectDefinition } from "shared/domain/ruleset/effect-definitions/ResourceLossEffectDefinition.ts"
import { Ruleset } from "shared/domain/ruleset/Ruleset.ts"
import { AtFleetPlanetConstraint } from "shared/domain/ruleset/target-definitions/AtFleetPlanetTargetConstraint.ts"
import { DifferentFromFleetOriginConstraint } from "shared/domain/ruleset/target-definitions/DifferentFromFleetOriginTargetConstraint.ts"
import { OwnedBySubmittingPlayerConstraint } from "shared/domain/ruleset/target-definitions/OwnedBySubmittingPlayerTargetConstraint.ts"
import { StationaryFleetConstraint } from "shared/domain/ruleset/target-definitions/StationaryFleetTargetConstraint.ts"
import { TargetType } from "shared/domain/ruleset/target-definitions/TargetType.ts"
import { UnclaimedPlanetConstraint } from "shared/domain/ruleset/target-definitions/UnclaimedPlanetTargetConstraint.ts"
import { WithinFleetRangeConstraint } from "shared/domain/ruleset/target-definitions/WithinFleetRangeTargetConstraint.ts"
import type { EffectOutcome } from "shared/domain/turns/actions/EffectOutcome.ts"
import { TurnStatus } from "shared/domain/turns/TurnStatus.ts"
import { AttackMoveTest, StationaryAssaultTest } from "shared/testing/test-ruleset/action-definitions/attack-move.ts"
import { BuildFleetStandard } from "shared/testing/test-ruleset/action-definitions/build-fleet.ts"
import { ColonizeHereTest, ColonizePlanetTest } from "shared/testing/test-ruleset/action-definitions/colonize.ts"
import { MoveFleetExceptional, MoveFleetStandard } from "shared/testing/test-ruleset/action-definitions/move-fleet.ts"
import { TestRuleset } from "shared/testing/test-ruleset/TestRuleset.ts"
import type { ResolvedTurnState } from "shared/turn-resolution/ResolvedTurnState.ts"
import { resolveTurn } from "shared/turn-resolution/resolveTurn.ts"
import { describe, expect, it } from "vitest"
import type { SubmittedActionTargetsDto } from "#api/gameplay/SubmittedActionTargetsDto.ts"
import type { PlayerView } from "#api/types.ts"
import { ControlledClock } from "#lib/ControlledClock.ts"
import { TransactionRollbackError } from "#lib/db/drizzle/TransactionRollbackError.ts"
import { fleetsTable, turnsTable } from "#lib/db/schema.ts"
import { RulesetsRepository } from "#lib/rulesets/rulesets.repository.ts"
import type { AuthenticatedApiClient } from "#tests/ApiClient.ts"
import { ConcurrencyTestApiServer } from "#tests/ConcurrencyTestApiServer.ts"
import { createTurnProcessorStub } from "#turn-processing/TurnProcessor.stub.ts"
import type { TurnToProcessModel } from "#turn-processing/turns.repository.ts"

const MANUAL_TURN_INTERVAL = Time.create(1, UnitOfTime.HOURS)
const MANUAL_CLOCK_ADVANCE = Time.create(2, UnitOfTime.HOURS)
const PUBLIC_COLONIZATION_FIXTURE_RULESET_ID = "test_public_colonization_routes"
const PUBLIC_NATURAL_COLONIZATION_RULESET_ID = "test_public_natural_colonization"

const SeedOutpost: ActionDefinition = typedParse(ActionDefinitionSchema, {
  id: "TEST_SEED_OUTPOST",
  name: "Seed Outpost",
  type: ActionType.DIRECTIVE,
  tier: ActionTier.IMPROVED,
  inputs: { quota: { type: "POSITIVE_INTEGER", label: "Fleet strength" } },
  targets: {
    force: {
      targetType: TargetType.FLEET,
      constraints: [OwnedBySubmittingPlayerConstraint.create(), StationaryFleetConstraint.create()],
    },
    site: {
      targetType: TargetType.PLANET,
      constraints: [
        WithinFleetRangeConstraint.create({ sourceFleetTag: "force", maxDistance: 3 }),
        DifferentFromFleetOriginConstraint.create({ sourceFleetTag: "force" }),
        UnclaimedPlanetConstraint.create(),
      ],
    },
  },
  costs: [
    ResourceLossEffectDefinition.create({ quantity: 7, resourceType: ResourceType.INFLUENCE }),
    ResourceLossEffectDefinition.create({ quantity: 2, resourceType: ResourceType.FUEL }),
  ],
  effects: [
    FleetMoveEffectDefinition.create({ fleetTag: "force", planetTag: "site", strengthTag: "quota", speed: 2 }),
    FleetColonizeEffectDefinition.create({ fleetTag: "force", planetTag: "site", strengthRequirement: 30 }),
  ],
})

const SeedOutpostHere: ActionDefinition = typedParse(ActionDefinitionSchema, {
  id: "TEST_SEED_OUTPOST_HERE",
  name: "Seed Outpost Here",
  type: ActionType.DIRECTIVE,
  tier: ActionTier.IMPROVED,
  inputs: {},
  targets: {
    force: {
      targetType: TargetType.FLEET,
      constraints: [OwnedBySubmittingPlayerConstraint.create(), StationaryFleetConstraint.create()],
    },
    site: {
      targetType: TargetType.PLANET,
      constraints: [AtFleetPlanetConstraint.create({ sourceFleetTag: "force" }), UnclaimedPlanetConstraint.create()],
    },
  },
  costs: [
    ResourceLossEffectDefinition.create({ quantity: 7, resourceType: ResourceType.INFLUENCE }),
    ResourceLossEffectDefinition.create({ quantity: 2, resourceType: ResourceType.FUEL }),
  ],
  effects: [FleetColonizeEffectDefinition.create({ fleetTag: "force", planetTag: "site", strengthRequirement: 30 })],
})

const BuildFleet20ForExactColonize = createFixtureBuildFleetAction("FIXTURE_BUILD20_EXACT", 20)

const PublicNaturalColonizationRuleset = Ruleset.create({
  ...TestRuleset,
  id: PUBLIC_NATURAL_COLONIZATION_RULESET_ID,
  name: "Public Natural Colonization Fixture",
  actionDefinitions: indexBy("id", [...Object.values(TestRuleset.actionDefinitions), SeedOutpost, BuildFleet20ForExactColonize]),
  actionPool: [
    ...TestRuleset.actionPool,
    { id: "TEST_SEED_OUTPOST_1", actionDefinitionId: SeedOutpost.id },
    { id: "TEST_BUILD20_EXACT_1", actionDefinitionId: BuildFleet20ForExactColonize.id },
    { id: "TEST_MOVE_FLEET_STANDARD_2", actionDefinitionId: MoveFleetStandard.id },
  ],
  startingResources: {
    ...TestRuleset.startingResources,
    [ResourceType.INFLUENCE]: 60,
    [ResourceType.METAL]: 5,
    [ResourceType.FUEL]: 10,
    [ResourceType.COLONY]: 0,
  },
})

const PublicBudgetBuild35: ActionDefinition = typedParse(ActionDefinitionSchema, {
  ...BuildFleetStandard,
  id: "FIXTURE_PUBLIC_BUDGET_BUILD35",
  name: "Public Budget Build 35",
  costs: [],
  effects: [FleetBuildEffectDefinition.create({ planetTag: "planet", strength: 35 })],
})
const PublicBudgetBuild5: ActionDefinition = typedParse(ActionDefinitionSchema, {
  ...BuildFleetStandard,
  id: "FIXTURE_PUBLIC_BUDGET_BUILD5",
  name: "Public Budget Build 5",
  costs: [],
  effects: [FleetBuildEffectDefinition.create({ planetTag: "planet", strength: 5 })],
})
const PublicBudgetBuild30: ActionDefinition = typedParse(ActionDefinitionSchema, {
  ...BuildFleetStandard,
  id: "FIXTURE_PUBLIC_BUDGET_BUILD30",
  name: "Public Budget Build 30",
  costs: [],
  effects: [FleetBuildEffectDefinition.create({ planetTag: "planet", strength: 30 })],
})
const PublicBudgetStageFleet: ActionDefinition = typedParse(ActionDefinitionSchema, {
  ...MoveFleetStandard,
  id: "FIXTURE_PUBLIC_BUDGET_STAGE_FLEET",
  name: "Public Budget Stage Fleet",
  costs: [],
  effects: [FleetMoveEffectDefinition.create({ fleetTag: "fleet", planetTag: "planet", strengthTag: "strength", speed: 10 })],
})
const PublicBudgetSecondColonizeHere: ActionDefinition = typedParse(ActionDefinitionSchema, {
  ...ColonizeHereTest,
  id: "FIXTURE_BUDGET_COLONIZE_HERE_2",
  name: "Public Budget Colonize Here 2",
})
const PublicColonizationBudgetRuleset = Ruleset.create({
  ...TestRuleset,
  id: "test_public_colonization_budget",
  name: "Public Colonization Budget Fixture",
  actionDefinitions: indexBy("id", [
    ...Object.values(TestRuleset.actionDefinitions),
    PublicBudgetBuild35,
    PublicBudgetBuild5,
    PublicBudgetBuild30,
    PublicBudgetStageFleet,
    PublicBudgetSecondColonizeHere,
  ]),
  actionPool: [
    ...TestRuleset.actionPool,
    { id: "PUBLIC_BUDGET_BUILD35", actionDefinitionId: PublicBudgetBuild35.id },
    { id: "PUBLIC_BUDGET_BUILD5", actionDefinitionId: PublicBudgetBuild5.id },
    { id: "PUBLIC_BUDGET_BUILD30", actionDefinitionId: PublicBudgetBuild30.id },
    { id: "PUBLIC_BUDGET_STAGE_FLEET", actionDefinitionId: PublicBudgetStageFleet.id },
    { id: "PUBLIC_BUDGET_COLONIZE_HERE_2", actionDefinitionId: PublicBudgetSecondColonizeHere.id },
  ],
  startingResources: {
    ...TestRuleset.startingResources,
    [ResourceType.INFLUENCE]: 100,
    [ResourceType.METAL]: 0,
    [ResourceType.FUEL]: 10,
    [ResourceType.COLONY]: 0,
  },
})

const PublicStationarySeedOutpostRuleset = Ruleset.create({
  ...PublicColonizationBudgetRuleset,
  id: "test_public_stationary_seed_outpost",
  name: "Public Stationary Seed Outpost Fixture",
  actionDefinitions: indexBy("id", [...Object.values(PublicColonizationBudgetRuleset.actionDefinitions), SeedOutpostHere]),
  actionPool: [...PublicColonizationBudgetRuleset.actionPool, { id: "TEST_SEED_OUTPOST_HERE_1", actionDefinitionId: SeedOutpostHere.id }],
})

function createFixtureBuildFleetAction(id: string, strength: number): ActionDefinition {
  return typedParse(ActionDefinitionSchema, {
    ...BuildFleetStandard,
    id,
    name: `Fixture Build ${strength}`,
    effects: [FleetBuildEffectDefinition.create({ planetTag: "planet", strength })],
  })
}

function createFixtureMoveFleetAction(id: string, speed: number): ActionDefinition {
  return typedParse(ActionDefinitionSchema, {
    ...MoveFleetExceptional,
    id,
    name: `Fixture Move ${speed}`,
    effects: [FleetMoveEffectDefinition.create({ fleetTag: "fleet", planetTag: "planet", strengthTag: "strength", speed })],
  })
}

function createFixtureColonizeAction(id: string, speed: number): ActionDefinition {
  return typedParse(ActionDefinitionSchema, {
    ...ColonizePlanetTest,
    id,
    name: `Fixture Colonize ${speed}`,
    effects: [
      FleetMoveEffectDefinition.create({ fleetTag: "fleet", planetTag: "planet", strengthTag: "strength", speed }),
      FleetColonizeEffectDefinition.create({ fleetTag: "fleet", planetTag: "planet", strengthRequirement: 20 }),
    ],
  })
}

const BuildFleet10ForStaging = createFixtureBuildFleetAction("FIXTURE_BUILD_FLEET_10_STAGING", 10)
const BuildFleet16ForStaging = createFixtureBuildFleetAction("FIXTURE_BUILD_FLEET_16_STAGING", 16)
const BuildFleet10ForRoute = createFixtureBuildFleetAction("FIXTURE_BUILD_FLEET_10_ROUTE", 10)
const BuildFleet35 = createFixtureBuildFleetAction("FIXTURE_BUILD_FLEET_35", 35)
const BuildFleet48 = createFixtureBuildFleetAction("FIXTURE_BUILD_FLEET_48", 48)
const BuildFleet50 = createFixtureBuildFleetAction("FIXTURE_BUILD_FLEET_50", 50)
const BuildFleet70 = createFixtureBuildFleetAction("FIXTURE_BUILD_FLEET_70", 70)
const MoveFleetSpeed10 = createFixtureMoveFleetAction("FIXTURE_MOVE_FLEET_SPEED_10", 10)
const ColonizeFleetSpeed2 = createFixtureColonizeAction("FIXTURE_COLONIZE_FLEET_SPEED_2", 2)
const ColonizeFleetSpeed4 = createFixtureColonizeAction("FIXTURE_COLONIZE_FLEET_SPEED_4", 4)
const ColonizeFleetSpeed01 = createFixtureColonizeAction("FIXTURE_COLONIZE_FLEET_SPEED_01", 0.1)
const ColonizeFarFleetSpeed5: ActionDefinition = typedParse(ActionDefinitionSchema, {
  ...ColonizePlanetTest,
  id: "FIXTURE_COLONIZE_FAR_FLEET_SPEED_5",
  name: "Fixture Colonize Far Fleet Speed 5",
  targets: {
    ...ColonizePlanetTest.targets,
    planet: {
      ...required(ColonizePlanetTest.targets[branded<TargetTag>("planet")]),
      constraints: [
        WithinFleetRangeConstraint.create({ sourceFleetTag: "fleet", maxDistance: 25 }),
        DifferentFromFleetOriginConstraint.create({ sourceFleetTag: "fleet" }),
        UnclaimedPlanetConstraint.create(),
      ],
    },
  },
  effects: [
    FleetMoveEffectDefinition.create({ fleetTag: "fleet", planetTag: "planet", strengthTag: "strength", speed: 5 }),
    FleetColonizeEffectDefinition.create({ fleetTag: "fleet", planetTag: "planet", strengthRequirement: 20 }),
  ],
})
const deadEarlierAttackPlanetTarget = required(AttackMoveTest.targets[branded<TargetTag>("planet")])
const DeadEarlierAttackColonize: ActionDefinition = typedParse(ActionDefinitionSchema, {
  ...AttackMoveTest,
  id: "FIXTURE_ATTACK_MOVE_COLONIZE",
  name: "Fixture Attack Move Colonize",
  targets: {
    ...AttackMoveTest.targets,
    planet: {
      ...deadEarlierAttackPlanetTarget,
      constraints: [...deadEarlierAttackPlanetTarget.constraints, UnclaimedPlanetConstraint.create()],
    },
  },
  effects: [
    FleetMoveEffectDefinition.create({ fleetTag: "fleet", planetTag: "planet", strengthTag: "strength", speed: 1 }),
    FleetAssaultEffectDefinition.create({ fleetTag: "fleet", planetTag: "planet" }),
    FleetColonizeEffectDefinition.create({ fleetTag: "fleet", planetTag: "planet", strengthRequirement: 20 }),
  ],
})
const ComposedSuccessAttackColonize: ActionDefinition = typedParse(ActionDefinitionSchema, {
  ...DeadEarlierAttackColonize,
  id: "FIXTURE_COMPOSED_ASSAULT_COLONIZE",
  name: "Fixture Composed Success Attack Colonize",
  costs: [ResourceLossEffectDefinition.create({ quantity: 25, resourceType: ResourceType.INFLUENCE })],
  effects: [
    FleetColonizeEffectDefinition.create({ fleetTag: "fleet", planetTag: "planet", strengthRequirement: 20 }),
    FleetAssaultEffectDefinition.create({ fleetTag: "fleet", planetTag: "planet" }),
    FleetMoveEffectDefinition.create({ fleetTag: "fleet", planetTag: "planet", strengthTag: "strength", speed: 1 }),
  ],
})
const DeadFarAttackColonize: ActionDefinition = typedParse(ActionDefinitionSchema, {
  ...DeadEarlierAttackColonize,
  id: "FIXTURE_ATTACK_FAR_MOVE_COLONIZE",
  name: "Fixture Far Attack Move Colonize",
  targets: {
    ...DeadEarlierAttackColonize.targets,
    planet: {
      ...required(DeadEarlierAttackColonize.targets[branded<TargetTag>("planet")]),
      constraints: [
        WithinFleetRangeConstraint.create({ sourceFleetTag: "fleet", maxDistance: 25 }),
        DifferentFromFleetOriginConstraint.create({ sourceFleetTag: "fleet" }),
        UnclaimedPlanetConstraint.create(),
      ],
    },
  },
  effects: [
    FleetMoveEffectDefinition.create({
      fleetTag: "fleet",
      planetTag: "planet",
      strengthTag: "strength",
      speed: 5,
    }),
    FleetAssaultEffectDefinition.create({ fleetTag: "fleet", planetTag: "planet" }),
    FleetColonizeEffectDefinition.create({ fleetTag: "fleet", planetTag: "planet", strengthRequirement: 20 }),
  ],
})

const publicColonizationFixtureActions = [
  BuildFleet10ForStaging,
  BuildFleet16ForStaging,
  BuildFleet10ForRoute,
  BuildFleet35,
  BuildFleet48,
  BuildFleet50,
  BuildFleet70,
  MoveFleetSpeed10,
  ColonizeFleetSpeed2,
  ColonizeFleetSpeed4,
  ColonizeFleetSpeed01,
  ColonizeFarFleetSpeed5,
  DeadEarlierAttackColonize,
  ComposedSuccessAttackColonize,
  BuildFleet20ForExactColonize,
  DeadFarAttackColonize,
] as const

const PublicColonizationFixtureRuleset = Ruleset.create({
  ...TestRuleset,
  id: PUBLIC_COLONIZATION_FIXTURE_RULESET_ID,
  name: "Public Colonization Worker Fixture",
  actionDefinitions: indexBy("id", [...Object.values(TestRuleset.actionDefinitions), ...publicColonizationFixtureActions]),
  actionPool: [
    ...TestRuleset.actionPool,
    ...publicColonizationFixtureActions.map((actionDefinition, index) => ({
      id: `PUBLIC_FIXTURE_${index}`,
      actionDefinitionId: actionDefinition.id,
    })),
  ],
  startingResources: {
    ...TestRuleset.startingResources,
    [ResourceType.INFLUENCE]: 500,
    [ResourceType.METAL]: 100,
    [ResourceType.FUEL]: 100,
    [ResourceType.COLONY]: 0,
  },
})

type PublicClient = AuthenticatedApiClient

function logReceipt(label: string, receipt: unknown): void {
  Logger.get().info(`${label} ${JSON.stringify(receipt)}`)
}

function required<T>(value: T | null | undefined): T {
  Assert.isDefined(value)
  return value
}

function playerIdFor(client: AuthenticatedApiClient): PlayerId {
  return typedParse(PlayerIdSchema, client.account.id)
}
type PublicPlanet = PlayerView["galaxy"]["systems"][number]["planets"][number]
type PublicFleet = PlayerView["fleets"][number]
type PublicFleetMatchView = {
  id: string
  ownerPlayerId: string
  originPlanetId: string
  destinationPlanetId?: string | undefined
  strength: number
  movement?: { submission: { id: string } } | undefined
  arrivedAtTick?: number | undefined
}
type PublicFleetMatch = Readonly<{
  fleetId?: PublicFleet["id"]
  ownerPlayerId?: PlayerId
  originPlanetId?: PublicPlanet["id"]
  destinationPlanetId?: PublicPlanet["id"]
  strength?: number
  movementSubmissionId?: string
  arrivedAtTick?: number
  stationary?: boolean
}>

function matchesPublicFleet(fleet: PublicFleetMatchView, match: PublicFleetMatch): boolean {
  return (
    (match.fleetId === undefined || fleet.id === match.fleetId) &&
    (match.ownerPlayerId === undefined || fleet.ownerPlayerId === match.ownerPlayerId) &&
    (match.originPlanetId === undefined || fleet.originPlanetId === match.originPlanetId) &&
    (match.destinationPlanetId === undefined || fleet.destinationPlanetId === match.destinationPlanetId) &&
    (match.strength === undefined || fleet.strength === match.strength) &&
    (match.movementSubmissionId === undefined || fleet.movement?.submission.id === match.movementSubmissionId) &&
    (match.arrivedAtTick === undefined || fleet.arrivedAtTick === match.arrivedAtTick) &&
    (match.stationary !== true || fleet.movement === undefined)
  )
}

function findPublicFleet<T extends PublicFleetMatchView>(fleets: readonly T[], match: PublicFleetMatch): T | undefined {
  return fleets.find((fleet) => matchesPublicFleet(fleet, match))
}

function hasResolvedResult(outcome: EffectOutcome, phrase: string): boolean {
  return outcome.type === "RESOLVED" && outcome.result.includes(phrase)
}

function hasPreventedReason(outcome: EffectOutcome, phrase: string): boolean {
  return outcome.type === "PREVENTED" && outcome.reason.includes(phrase)
}

function describeOutcome(outcome: EffectOutcome): string {
  return outcome.type === "RESOLVED" ? outcome.result : outcome.reason
}

function findPlayerAction<T extends { id: string; playerId: PlayerId }>(
  actions: readonly T[],
  actionId: string,
  playerId: PlayerId,
): T | undefined {
  return actions.find((action) => action.id === actionId && action.playerId === playerId)
}

function isColonizeDefinitionId(actionDefinitionId: ActionDefinitionId): boolean {
  return actionDefinitionId === ColonizeHereTest.id || actionDefinitionId === PublicBudgetSecondColonizeHere.id
}

function hasPreventedOrColonized(outcome: EffectOutcome): boolean {
  return outcome.type === "PREVENTED" || hasResolvedResult(outcome, " colonized Planet ")
}

function findResolvedAction<T extends { submittedAction: { id: string; playerId: PlayerId } }>(
  actions: readonly T[],
  actionId: string,
  playerId: PlayerId,
): T | undefined {
  return actions.find(({ submittedAction }) => submittedAction.id === actionId && submittedAction.playerId === playerId)
}

function describeOutcomeRecord(outcome: EffectOutcome): EffectOutcome {
  return outcome.type === "RESOLVED" ? { type: outcome.type, result: outcome.result } : { type: outcome.type, reason: outcome.reason }
}

function isUnselectedActionWithDefinition(
  action: { actionDefinitionId: ActionDefinitionId; selectedTargets: unknown },
  actionDefinitionId: ActionDefinitionId,
): boolean {
  return action.actionDefinitionId === actionDefinitionId && action.selectedTargets === null
}
function isActionSelected(action: { selectedTargets: unknown }): boolean {
  return action.selectedTargets !== null
}

function startTogether(parties: number): () => Promise<void> {
  let release: () => void = () => {}
  const released = new Promise<void>((resolve) => {
    release = resolve
  })
  let arrivals = 0
  return async (): Promise<void> => {
    arrivals += 1
    if (arrivals === parties) release()
    await released
  }
}
type PublicTurnProcessor = Awaited<ReturnType<typeof createTurnProcessorStub>>
type PublicNaturalRouteFixture = {
  player: PublicClient
  gameId: number
  clock: ControlledClock
  turnProcessor: PublicTurnProcessor["turnProcessor"]
  turnsRepository: PublicTurnProcessor["turnsRepository"]
  view: PlayerView
  home: PublicPlanet
  target: PublicPlanet
}
type PublicTwoPlayerFixture = {
  alice: PublicClient
  bob: PublicClient
  clients: readonly [PublicClient, PublicClient]
  gameId: number
  clock: ControlledClock
  turnProcessor: PublicTurnProcessor["turnProcessor"]
  turnsRepository: PublicTurnProcessor["turnsRepository"]
  views: PlayerView[]
  homeA: PublicPlanet
  homeB: PublicPlanet
  target: PublicPlanet
}

async function submitAction({
  client,
  gameId,
  view,
  actionDefinitionId,
  selectedTargets,
  selectedInputs,
}: {
  client: AuthenticatedApiClient["client"]
  gameId: number
  view: PlayerView
  actionDefinitionId: ActionDefinitionId
  selectedTargets: DeepUnbranded<SubmittedActionTargetsDto["selectedTargets"]>
  selectedInputs: DeepUnbranded<SubmittedActionTargetsDto["selectedInputs"]>
}): Promise<string> {
  const action = view.actions.find(({ actionDefinitionId: candidate }) => candidate === actionDefinitionId)
  Assert.isDefined(action)
  await client.gameplay.updateActionSubmission.mutate({
    gameId,
    turn: view.turn,
    submittedActionTargets: { actionId: action.id, selectedTargets, selectedInputs },
  })
  return action.id
}

async function readViews(clients: readonly PublicClient[], gameId: number): Promise<PlayerView[]> {
  return await Promise.all(clients.map(async ({ client }) => await client.gameplay.getPlayerView.query({ gameId })))
}

async function createPublicTwoPlayerFixture(server: ConcurrencyTestApiServer): Promise<PublicTwoPlayerFixture> {
  const rulesetsRepository = new RulesetsRepository({ db: server.database, logger: Logger.get() })
  Assert.isSuccess(await rulesetsRepository.upsertRuleset(PublicColonizationFixtureRuleset))
  const alice = await server.createClient({ authenticated: true, id: "00000000-0000-4000-8000-000000000021" })
  const bob = await server.createClient({ authenticated: true, id: "00000000-0000-4000-8000-000000000022" })
  const clients = [alice, bob] as const
  const { createdGameId: gameId } = await alice.client.games.create.mutate({
    configuration: createGameConfigurationStub({
      rulesetId: PublicColonizationFixtureRuleset.id,
      nbSeats: 2,
      turnIntervalSeconds: Time.in(MANUAL_TURN_INTERVAL, UnitOfTime.SECONDS),
      mapGenerationSeed: 1,
    }),
  })
  await bob.client.games.join.mutate({ gameId })
  await alice.client.games.startGame.mutate({ gameId })
  const clock = new ControlledClock({ startDate: new Date() })
  const { turnProcessor, turnsRepository } = await createTurnProcessorStub({ db: server.database, clock })
  const views = await readViews(clients, gameId)
  const homeA = getHome(required(views[0]))
  const homeB = getHome(required(views[1]))
  const target = getPlanets(required(views[0])).find(({ id }) => id === "86c709b0-6751-54a5-92c1-d37b6207e8ce")
  Assert.isDefined(target)
  expect({ id: homeA.id, name: homeA.name, coordinates: homeA.coordinates, x: homeA.x, y: homeA.y }).toStrictEqual({
    id: "281f3101-1ae1-583c-a7c1-9da25e44b142",
    name: "planet 352230",
    coordinates: "56:10:20",
    x: 60.50725647418779,
    y: 51.19200923932836,
  })
  expect({ id: homeB.id, name: homeB.name, coordinates: homeB.coordinates, x: homeB.x, y: homeB.y }).toStrictEqual({
    id: "a9bf69be-5a14-50b0-bede-c380e5c915b0",
    name: "planet 251588",
    coordinates: "54:00:40",
    x: 40.4052595066424,
    y: 50.58150615406917,
  })
  expect({ id: target.id, name: target.name, coordinates: target.coordinates, x: target.x, y: target.y }).toStrictEqual({
    id: "86c709b0-6751-54a5-92c1-d37b6207e8ce",
    name: "planet 649967",
    coordinates: "55:19:10",
    x: 59.252817521739225,
    y: 51.03250029247926,
  })
  expect(Math.hypot(homeA.x - target.x, homeA.y - target.y)).toBeCloseTo(1.2645395167985714, 12)
  expect(Math.hypot(homeB.x - homeA.x, homeB.y - homeA.y)).toBeCloseTo(20.111265402761585, 12)

  return { alice, bob, clients, gameId, clock, turnProcessor, turnsRepository, views, homeA, homeB, target }
}

async function createPublicNaturalRouteFixture(server: ConcurrencyTestApiServer, accountId: string): Promise<PublicNaturalRouteFixture> {
  const rulesetsRepository = new RulesetsRepository({ db: server.database, logger: Logger.get() })
  Assert.isSuccess(await rulesetsRepository.upsertRuleset(PublicNaturalColonizationRuleset))
  const player = await server.createClient({ authenticated: true, id: accountId })
  const { createdGameId: gameId } = await player.client.games.create.mutate({
    configuration: createGameConfigurationStub({
      rulesetId: PublicNaturalColonizationRuleset.id,
      nbSeats: 1,
      turnIntervalSeconds: Time.in(MANUAL_TURN_INTERVAL, UnitOfTime.SECONDS),
      mapGenerationSeed: 1234,
    }),
  })
  await player.client.games.startGame.mutate({ gameId })
  const clock = new ControlledClock({ startDate: new Date() })
  const { turnProcessor, turnsRepository } = await createTurnProcessorStub({ db: server.database, clock })
  const view = await player.client.gameplay.getPlayerView.query({ gameId })
  const planets = getPlanets(view)
  const home = getHome(view)
  const target = planets.find(({ coordinates }) => coordinates === "55:07:50")
  Assert.isDefined(target)
  expect({ id: home.id, name: home.name, coordinates: home.coordinates, x: home.x, y: home.y }).toStrictEqual({
    id: "78821e36-f066-5df0-adbd-19785571d245",
    name: "planet 278494",
    coordinates: "45:98:30",
    x: 58.43842436611536,
    y: 49.61917707239218,
  })
  expect({ id: target.id, name: target.name, coordinates: target.coordinates, x: target.x, y: target.y }).toStrictEqual({
    id: "a34e5eae-656c-5330-ac90-9f9a7e0afa5d",
    name: "planet 684163",
    coordinates: "55:07:50",
    x: 57.77998524757335,
    y: 50.556704120958045,
  })
  expect(Math.hypot(home.x - target.x, home.y - target.y)).toBeCloseTo(1.1456435045942517, 12)
  expect(target.ownerPlayerId).toBeNull()
  logReceipt("[C3-14/C3-20 frozen public route fixture receipt]", {
    gameId,
    seed: 1234,
    player: view.player.id,
    home: { id: home.id, name: home.name, coordinates: home.coordinates, x: home.x, y: home.y },
    target: { id: target.id, name: target.name, coordinates: target.coordinates, x: target.x, y: target.y },
    routeDistance: Math.hypot(home.x - target.x, home.y - target.y),
  })
  return { player, gameId, clock, turnProcessor, turnsRepository, view, home, target }
}

async function publiclyBuildFleetToFifty(fixture: PublicNaturalRouteFixture): Promise<{ view: PlayerView; fleet: PublicFleet }> {
  const { player, gameId, clock, turnProcessor, turnsRepository, home } = fixture
  let view = fixture.view
  for (let build = 0; build < 5; build += 1) {
    await submitAction({
      client: player.client,
      gameId,
      view,
      actionDefinitionId: BuildFleetStandard.id,
      selectedTargets: { planet: home.id },
      selectedInputs: {},
    })
    const selectedBuildView = await player.client.gameplay.getPlayerView.query({ gameId })
    expect(selectedBuildView.actions.find(({ actionDefinitionId }) => actionDefinitionId === BuildFleetStandard.id)).toMatchObject({
      actionDefinitionId: BuildFleetStandard.id,
      selectedTargets: { planet: home.id },
    })
    view = await processTurn({ clock, turnsRepository, turnProcessor, client: player.client, gameId, turn: view.turn })
  }
  const fleet = getFleetAt(view, view.player.id, home.id, 50)
  expect(view.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 50, uncommitted: 50 })
  expect(view.resources[ResourceType.METAL]).toStrictEqual({ total: 0, uncommitted: 0 })
  expect(view.resources[ResourceType.FUEL]).toStrictEqual({ total: 10, uncommitted: 10 })
  expect(view.resources[ResourceType.COLONY]).toStrictEqual({ total: 0, uncommitted: 0 })
  return { view, fleet }
}

type PublicStagedMergeScenario = {
  fixture: PublicTwoPlayerFixture
  views: PlayerView[]
  stagedFriendly: PublicFleet
  bobAtSource: PublicFleet
  aliceSource: PublicFleet
  bobStageActionId: string
}

async function stagePublicMergeScenario(
  server: ConcurrencyTestApiServer,
  fixture: PublicTwoPlayerFixture,
): Promise<PublicStagedMergeScenario> {
  const { alice, bob, clients, gameId, clock, turnProcessor, turnsRepository, homeA, homeB, target } = fixture
  let views = fixture.views
  await submitAction({
    client: alice.client,
    gameId,
    view: required(views[0]),
    actionDefinitionId: BuildFleet10ForStaging.id,
    selectedTargets: { planet: homeA.id },
    selectedInputs: {},
  })
  await submitAction({
    client: bob.client,
    gameId,
    view: required(views[1]),
    actionDefinitionId: BuildFleet35.id,
    selectedTargets: { planet: homeB.id },
    selectedInputs: {},
  })
  await processTurn({ clock, turnsRepository, turnProcessor, client: alice.client, gameId, turn: required(views[0]).turn })
  views = await readViews(clients, gameId)
  const aliceStagingFleet = getFleetAt(required(views[0]), required(views[0]).player.id, homeA.id, 10)
  const bobSourceFleet = getFleetAt(required(views[1]), required(views[1]).player.id, homeB.id, 35)

  await submitAction({
    client: alice.client,
    gameId,
    view: required(views[0]),
    actionDefinitionId: MoveFleetExceptional.id,
    selectedTargets: { fleet: aliceStagingFleet.id, planet: target.id },
    selectedInputs: { strength: 10 },
  })
  await submitAction({
    client: alice.client,
    gameId,
    view: required(views[0]),
    actionDefinitionId: BuildFleet50.id,
    selectedTargets: { planet: homeA.id },
    selectedInputs: {},
  })
  const bobStageActionId = await submitAction({
    client: bob.client,
    gameId,
    view: required(views[1]),
    actionDefinitionId: MoveFleetExceptional.id,
    selectedTargets: { fleet: bobSourceFleet.id, planet: homeA.id },
    selectedInputs: { strength: 35 },
  })
  let stage = await processTurnWithReplay({ server, clock, turnsRepository, turnProcessor, clients, gameId, turn: required(views[0]).turn })
  views = stage.views
  const stagedArrival = Object.values(stage.resolved.fleets).find(
    ({ ownerPlayerId, originPlanetId, strength }) =>
      ownerPlayerId === required(views[0]).player.id && originPlanetId === target.id && strength === 10,
  )
  Assert.isDefined(stagedArrival)
  expect(stagedArrival.arrivedAtTick).toBe(6)
  expect(stage.resolved.removedFleetIds).toContain(aliceStagingFleet.id)
  const bobJourney = required(views[1]).fleets.find(({ movement }) => movement?.submission.id === bobStageActionId)
  Assert.isDefined(bobJourney)
  const bobJourneyId = bobJourney.id
  expect(bobJourney.distanceToEnd).toBeCloseTo(15.111265402761585, 12)

  for (const expectedDistance of [10.111265402761585, 5.111265402761585, 0.111265402761585]) {
    stage = await processTurnWithReplay({ server, clock, turnsRepository, turnProcessor, clients, gameId, turn: required(views[0]).turn })
    views = stage.views
    const currentJourney = required(views[1]).fleets.find(({ id }) => id === bobJourneyId)
    Assert.isDefined(currentJourney)
    expect(currentJourney.distanceToEnd).toBeCloseTo(expectedDistance, 12)
  }
  stage = await processTurnWithReplay({ server, clock, turnsRepository, turnProcessor, clients, gameId, turn: required(views[0]).turn })
  views = stage.views
  expect(stage.resolved.fleets[bobJourneyId]?.arrivedAtTick).toBe(1)
  const bobAtSource = getFleetAt(required(views[1]), required(views[1]).player.id, homeA.id, 35)
  expect(bobAtSource.id).toBe(bobJourneyId)
  const aliceSource = getFleetAt(required(views[0]), required(views[0]).player.id, homeA.id, 50)
  const stagedFriendly = getFleetAt(required(views[0]), required(views[0]).player.id, target.id, 10)
  expect(stagedFriendly.id).toBe(stagedArrival.id)
  return { fixture, views, stagedFriendly, bobAtSource, aliceSource, bobStageActionId }
}

function getPlanets(view: PlayerView): PublicPlanet[] {
  return view.galaxy.systems.flatMap(({ planets }) => planets)
}

function getHome(view: PlayerView): PublicPlanet {
  const home = getPlanets(view).find(({ ownerPlayerId }) => ownerPlayerId === view.player.id)
  Assert.isDefined(home)
  return home
}

function getFleetAt(view: PlayerView, ownerPlayerId: PlayerId, planetId: PublicPlanet["id"], strength: number): PublicFleet {
  const fleet = view.fleets.find(
    ({ ownerPlayerId: candidateOwner, originPlanetId, movement, strength: candidateStrength }) =>
      candidateOwner === ownerPlayerId && originPlanetId === planetId && movement === undefined && candidateStrength === strength,
  )
  if (fleet === undefined) {
    throw new Error(
      `Expected stationary Fleet strength ${strength} for owner ${ownerPlayerId} at ${planetId}; observed ${JSON.stringify(view.fleets)}`,
    )
  }
  return fleet
}

async function processTurn({
  clock,
  turnsRepository,
  turnProcessor,
  client,
  gameId,
  turn,
}: {
  clock: ControlledClock
  turnsRepository: PublicTurnProcessor["turnsRepository"]
  turnProcessor: PublicTurnProcessor["turnProcessor"]
  client: AuthenticatedApiClient["client"]
  gameId: number
  turn: number
}): Promise<PlayerView> {
  clock.increment({ time: MANUAL_CLOCK_ADVANCE })
  await turnsRepository.markDueTurnsAwaitingProcessing({ since: clock.now() })
  expect(await turnProcessor.processNextDueTurn()).toBe("processed")
  const nextView = await client.gameplay.getPlayerView.query({ gameId })
  expect(nextView.turn).toBe(turn + 1)
  expect(nextView.turnStatus).toBe(TurnStatus.COLLECTING_ACTIONS)
  return nextView
}

async function processTurnWithReplay({
  server,
  clock,
  turnsRepository,
  turnProcessor,
  clients,
  gameId,
  turn,
}: {
  server: ConcurrencyTestApiServer
  clock: ControlledClock
  turnsRepository: PublicTurnProcessor["turnsRepository"]
  turnProcessor: PublicTurnProcessor["turnProcessor"]
  clients: readonly PublicClient[]
  gameId: number
  turn: number
}): Promise<{ views: PlayerView[]; resolved: ResolvedTurnState }> {
  const workerInput = await captureWorkerInput({ server, clock, turnsRepository, gameId, turn })
  const replay = replayWorkerInput(workerInput)
  Assert.isSuccess(replay)
  expect(await turnProcessor.processNextDueTurn()).toBe("processed")
  const views = await readViews(clients, gameId)
  expect(views[0]?.turn).toBe(turn + 1)
  expect(views[0]?.turnStatus).toBe(TurnStatus.COLLECTING_ACTIONS)
  return { views, resolved: replay.value }
}

async function captureWorkerInput({
  server,
  clock,
  turnsRepository,
  gameId,
  turn,
}: {
  server: ConcurrencyTestApiServer
  clock: ControlledClock
  turnsRepository: PublicTurnProcessor["turnsRepository"]
  gameId: number
  turn: number
}): Promise<TurnToProcessModel> {
  clock.increment({ time: MANUAL_CLOCK_ADVANCE })
  await turnsRepository.markDueTurnsAwaitingProcessing({ since: clock.now() })
  let observed: TurnToProcessModel | undefined
  const rollbackMessage = `Intentional public colonization observation rollback for game ${gameId} turn ${turn}`
  await expect(
    server.database.transaction(async (tx) => {
      const nextTurn = await turnsRepository.getNextTurnForProcessing({ since: clock.now() }, tx)
      Assert.isDefined(nextTurn)
      expect(nextTurn.gameId).toBe(gameId)
      expect(nextTurn.turn).toBe(turn)
      observed = structuredClone(await turnsRepository.startTurnProcessing({ turn: nextTurn, processingStartedAt: clock.now() }, tx))
      throw new TransactionRollbackError(rollbackMessage)
    }),
  ).rejects.toMatchObject({ name: "TransactionRollbackError", message: rollbackMessage })
  Assert.isDefined(observed)
  return observed
}

function replayWorkerInput(input: TurnToProcessModel, reverseEnumeration = false): ReturnType<typeof resolveTurn> {
  return replayWorkerInputWithState(input, reverseEnumeration).resolved
}

function compareOrdinalPair(first: string, second: string, nextFirst: string, nextSecond: string): number {
  const primaryComparison = compareOrdinalStrings(first, second)
  return primaryComparison === 0 ? compareOrdinalStrings(nextFirst, nextSecond) : primaryComparison
}
function canonicalizeResolvedTurn(resolved: ResolvedTurnState): ResolvedTurnState {
  return {
    ...resolved,
    resolvedActions: resolved.resolvedActions.toSorted((first, second) =>
      compareOrdinalPair(
        first.submittedAction.playerId,
        second.submittedAction.playerId,
        first.submittedAction.id,
        second.submittedAction.id,
      ),
    ),
    resolvedContinuations: resolved.resolvedContinuations.toSorted((first, second) =>
      compareOrdinalPair(
        first.originatingSubmission.playerId,
        second.originatingSubmission.playerId,
        first.originatingSubmission.id,
        second.originatingSubmission.id,
      ),
    ),
  }
}

function replayWorkerInputWithState(
  input: TurnToProcessModel,
  reverseEnumeration = false,
): {
  resolved: ReturnType<typeof resolveTurn>
  nextRngState: ReturnType<ReturnType<typeof Rng.fromState>["getState"]>
} {
  const rng = Rng.fromState(structuredClone(input.rngState), mulberry32Prng)
  const ordered = <T>(values: T[]): T[] => (reverseEnumeration ? values.toReversed() : values)
  const resolved = resolveTurn(
    {
      gameId: input.gameId,
      turn: input.turn,
      submittedActions: ordered(structuredClone(input.submittedActions)),
      players: indexBy("id", ordered(structuredClone(Object.values(input.players)))),
      planets: indexBy("id", ordered(structuredClone(Object.values(input.planets)))),
      fleets: indexBy("id", ordered(structuredClone(Object.values(input.fleets)))),
      winnerPlayerId: undefined,
    },
    input.ruleset,
    rng,
  )
  return { resolved, nextRngState: rng.getState() }
}

describe("public Colonization worker companions", () => {
  it("should preserve composed Move, Assault, and Colonize phase order through public worker turns", async () => {
    await using server = await ConcurrencyTestApiServer.create()
    const fixture = await createPublicTwoPlayerFixture(server)
    const { alice, bob, clients, gameId, clock, turnProcessor, turnsRepository, homeA, homeB, target } = fixture
    let views = fixture.views
    const attackerDistance = Math.hypot(homeA.x - target.x, homeA.y - target.y)
    const defenderDistance = Math.hypot(homeB.x - target.x, homeB.y - target.y)
    expect(attackerDistance).toBeCloseTo(1.2645395167985714, 12)
    expect(defenderDistance).toBeCloseTo(18.852953053708077, 12)
    expect(target.ownerPlayerId).toBeNull()

    await submitAction({
      client: alice.client,
      gameId,
      view: required(views[0]),
      actionDefinitionId: BuildFleet50.id,
      selectedTargets: { planet: homeA.id },
      selectedInputs: {},
    })
    await submitAction({
      client: bob.client,
      gameId,
      view: required(views[1]),
      actionDefinitionId: BuildFleet10ForStaging.id,
      selectedTargets: { planet: homeB.id },
      selectedInputs: {},
    })
    let stage = await processTurnWithReplay({
      server,
      clock,
      turnsRepository,
      turnProcessor,
      clients,
      gameId,
      turn: required(views[0]).turn,
    })
    views = stage.views
    const attacker = getFleetAt(required(views[0]), required(views[0]).player.id, homeA.id, 50)
    const defenderSource = getFleetAt(required(views[1]), required(views[1]).player.id, homeB.id, 10)
    expect(views.map(({ resources }) => resources[ResourceType.INFLUENCE].total)).toStrictEqual([498, 498])
    expect(views.map(({ resources }) => resources[ResourceType.METAL].total)).toStrictEqual([99, 99])

    const defenderMoveId = await submitAction({
      client: bob.client,
      gameId,
      view: required(views[1]),
      actionDefinitionId: MoveFleetSpeed10.id,
      selectedTargets: { fleet: defenderSource.id, planet: target.id },
      selectedInputs: { strength: 10 },
    })
    stage = await processTurnWithReplay({ server, clock, turnsRepository, turnProcessor, clients, gameId, turn: required(views[0]).turn })
    views = stage.views
    const defenderJourney = required(views[1]).fleets.find(({ movement }) => movement?.submission.id === defenderMoveId)
    Assert.isDefined(defenderJourney)
    expect(defenderJourney.distanceToEnd).toBeCloseTo(8.852953053708077, 12)
    expect(getPlanets(required(views[0])).find(({ id }) => id === target.id)?.ownerPlayerId).toBeNull()

    stage = await processTurnWithReplay({ server, clock, turnsRepository, turnProcessor, clients, gameId, turn: required(views[0]).turn })
    views = stage.views
    expect(stage.resolved.fleets[defenderJourney.id]?.arrivedAtTick).toBe(18)
    const defender = getFleetAt(required(views[1]), required(views[1]).player.id, target.id, 10)
    expect(getPlanets(required(views[0])).find(({ id }) => id === target.id)?.ownerPlayerId).toBeNull()
    expect(required(views[1]).resources[ResourceType.INFLUENCE].total).toBe(495)
    expect(required(views[1]).resources[ResourceType.FUEL].total).toBe(95)

    const composedActionId = await submitAction({
      client: alice.client,
      gameId,
      view: required(views[0]),
      actionDefinitionId: ComposedSuccessAttackColonize.id,
      selectedTargets: { fleet: attacker.id, planet: target.id },
      selectedInputs: { strength: 50 },
    })
    const selectedViews = await readViews(clients, gameId)
    expect(required(selectedViews[0]).actions.find(({ id }) => id === composedActionId)).toMatchObject({
      actionDefinitionId: ComposedSuccessAttackColonize.id,
      selectedTargets: { fleet: attacker.id, planet: target.id },
      selectedInputs: { strength: 50 },
    })
    expect(required(selectedViews[0]).resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 498, uncommitted: 473 })
    expect(required(selectedViews[0]).resources[ResourceType.FUEL]).toStrictEqual({ total: 100, uncommitted: 100 })

    stage = await processTurnWithReplay({
      server,
      clock,
      turnsRepository,
      turnProcessor,
      clients,
      gameId,
      turn: required(selectedViews[0]).turn,
    })
    views = stage.views
    const attackerJourney = required(views[0]).fleets.find(({ movement }) => movement?.submission.id === composedActionId)
    Assert.isDefined(attackerJourney)
    expect(attackerJourney.distanceToEnd).toBeCloseTo(0.2645395167985714, 12)
    expect(required(views[0]).fleets.find(({ id }) => id === attacker.id)).toBeUndefined()
    expect(required(views[1]).fleets.find(({ id }) => id === defender.id)?.strength).toBe(10)
    expect(getPlanets(required(views[0])).find(({ id }) => id === target.id)?.ownerPlayerId).toBeNull()

    const arrivalTurn = required(views[0]).turn
    const arrivalInput = await captureWorkerInput({ server, clock, turnsRepository, gameId, turn: arrivalTurn })
    const arrivalReplay = replayWorkerInputWithState(arrivalInput)
    Assert.isSuccess(arrivalReplay.resolved)
    const loadedDefinition = arrivalInput.ruleset.actionDefinitions[ComposedSuccessAttackColonize.id]
    Assert.isDefined(loadedDefinition)
    expect(loadedDefinition.effects.map(({ type }) => type)).toStrictEqual(["FLEET_COLONIZE", "FLEET_ASSAULT", "FLEET_MOVE"])
    expect(loadedDefinition.effects).toMatchObject([
      { targets: { fleet: { actionTargetTag: "fleet" }, planet: { actionTargetTag: "planet" } }, parameters: { strengthRequirement: 20 } },
      { targets: { fleet: { actionTargetTag: "fleet" }, planet: { actionTargetTag: "planet" } } },
      {
        targets: { fleet: { actionTargetTag: "fleet" }, planet: { actionTargetTag: "planet" } },
        inputs: { strength: { actionInputTag: "strength", inputType: "POSITIVE_INTEGER" } },
        parameters: { speed: 1 },
      },
    ])
    const loadedJourney = arrivalInput.fleets[attackerJourney.id]
    Assert.isDefined(loadedJourney)
    expect(loadedJourney).toMatchObject({
      id: attackerJourney.id,
      ownerPlayerId: playerIdFor(alice),
      strength: 50,
      destinationPlanetId: target.id,
      movement: { speed: 1, submission: { id: composedActionId } },
    })
    expect(loadedJourney.movement?.submission).toMatchObject({
      actionDefinitionId: ComposedSuccessAttackColonize.id,
      selectedTargets: { fleet: attacker.id, planet: target.id },
      selectedInputs: { strength: 50 },
    })
    expect(loadedJourney.distanceToEnd).toBeCloseTo(0.2645395167985714, 12)
    expect(
      loadedJourney.movement?.pendingArrivalEffects.map(({ effectDefinition, definitionOrdinal }) => ({
        type: effectDefinition.type,
        definitionOrdinal,
        targets: effectDefinition.targets,
      })),
    ).toStrictEqual([
      {
        type: "FLEET_COLONIZE",
        definitionOrdinal: 1,
        targets: {
          fleet: { actionTargetTag: "fleet", targetType: "FLEET" },
          planet: { actionTargetTag: "planet", targetType: "PLANET" },
        },
      },
      {
        type: "FLEET_ASSAULT",
        definitionOrdinal: 2,
        targets: {
          fleet: { actionTargetTag: "fleet", targetType: "FLEET" },
          planet: { actionTargetTag: "planet", targetType: "PLANET" },
        },
      },
    ])
    expect(arrivalInput.fleets[defender.id]).toMatchObject({ id: defender.id, ownerPlayerId: playerIdFor(bob), strength: 10 })
    expect(arrivalInput.planets[target.id]?.ownerPlayerId).toBeNull()

    const continuation = arrivalReplay.resolved.value.resolvedContinuations.find(
      ({ originatingSubmission }) => originatingSubmission.id === composedActionId,
    )
    Assert.isDefined(continuation)
    expect(continuation.actionOutcomes).toHaveLength(4)
    expect(continuation.actionOutcomes.every(({ type }) => type === "RESOLVED")).toBe(true)
    expect(continuation.actionOutcomes.some((outcome) => hasResolvedResult(outcome, "moved "))).toBe(true)
    expect(continuation.actionOutcomes.some((outcome) => hasResolvedResult(outcome, "arrived on Planet"))).toBe(true)
    expect(continuation.actionOutcomes.some((outcome) => hasResolvedResult(outcome, "exchanged 10 Strength with 10 enemy Strength"))).toBe(
      true,
    )
    expect(continuation.actionOutcomes.some((outcome) => hasResolvedResult(outcome, "colonized Planet"))).toBe(true)
    expect(arrivalReplay.resolved.value.removedFleetIds).toContain(defender.id)
    expect(arrivalReplay.resolved.value.fleets[defender.id]).toBeUndefined()
    expect(arrivalReplay.resolved.value.fleets[attackerJourney.id]).toMatchObject({
      ownerPlayerId: playerIdFor(alice),
      originPlanetId: target.id,
      strength: 20,
      movement: undefined,
      destinationPlanetId: undefined,
      distanceToEnd: undefined,
    })
    expect(arrivalReplay.resolved.value.planets[target.id]?.ownerPlayerId).toBe(playerIdFor(alice))
    expect(arrivalReplay.resolved.value.planetOwnershipChanges).toStrictEqual([{ planetId: target.id, ownerPlayerId: playerIdFor(alice) }])
    expect(arrivalReplay.nextRngState).toStrictEqual(arrivalInput.rngState)

    expect(await turnProcessor.processNextDueTurn()).toBe("processed")
    views = await readViews(clients, gameId)
    expect(required(views[0]).turn).toBe(arrivalTurn + 1)
    expect(getPlanets(required(views[0])).find(({ id }) => id === target.id)?.ownerPlayerId).toBe(playerIdFor(alice))
    expect(getFleetAt(required(views[0]), playerIdFor(alice), target.id, 20).id).toBe(attackerJourney.id)
    expect(required(views[1]).fleets.find(({ id }) => id === defender.id)).toBeUndefined()
    expect(required(views[0]).resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 473, uncommitted: 473 })
    expect(required(views[0]).resources[ResourceType.FUEL]).toStrictEqual({ total: 100, uncommitted: 100 })
    expect(required(views[0]).resources[ResourceType.COLONY]).toStrictEqual({ total: 0, uncommitted: 0 })
    expect(required(views[0]).resources[ResourceType.METAL]).toStrictEqual({ total: 99, uncommitted: 99 })
    expect(required(views[1]).resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 495, uncommitted: 495 })
    expect(required(views[1]).resources[ResourceType.FUEL]).toStrictEqual({ total: 95, uncommitted: 95 })
    expect(required(views[1]).resources[ResourceType.METAL]).toStrictEqual({ total: 99, uncommitted: 99 })
    expect(required(views[0]).actions.find(({ id }) => id === composedActionId)).toMatchObject({
      selectedTargets: null,
      isInProgress: false,
    })
    const savedTurns = await server.database
      .select()
      .from(turnsTable)
      .where(eq(turnsTable.gameId, typedParse(GameIdSchema, gameId)))
    const savedNextTurn = savedTurns.find(({ turn }) => turn === arrivalTurn + 1)
    Assert.isDefined(savedNextTurn)
    const persistedNextRngState = { generatorState: savedNextTurn.rngGeneratorState, spareNormal: savedNextTurn.rngSpareNormal }
    expect(persistedNextRngState).toStrictEqual(arrivalReplay.nextRngState)

    logReceipt("[C3-15 public composed success receipt]", {
      gameId,
      seed: 1,
      homes: [
        { id: homeA.id, coordinates: homeA.coordinates, x: homeA.x, y: homeA.y },
        { id: homeB.id, coordinates: homeB.coordinates, x: homeB.x, y: homeB.y },
      ],
      target: { id: target.id, coordinates: target.coordinates, x: target.x, y: target.y },
      distances: { attacker: attackerDistance, defender: defenderDistance },
      defender: { journeyId: defenderJourney.id, strength: 10, actualArrivalTick: 18, atTargetBeforeAttack: true },
      attacker: { journeyId: attackerJourney.id, strengthBeforeCombat: 50, actualArrivalTick: 6 },
      capturedEffectTypes: loadedDefinition.effects.map(({ type }) => type),
      capturedMappings: loadedDefinition.effects.map((effect) => ({ type: effect.type, targets: effect.targets })),
      outcomes: continuation.actionOutcomes,
      result: { owner: required(views[0]).player.id, strength: 20, defenderFleetRemoved: true },
      influence: { paidOnce: 25, remaining: required(views[0]).resources[ResourceType.INFLUENCE].total },
      rng: { preResolution: arrivalInput.rngState, replayNext: arrivalReplay.nextRngState, persistedNext: persistedNextRngState },
    })
  })

  it.each([
    {
      attackerStrength: 35,
      attackerBuildDefinitionId: BuildFleet35.id,
      defenderStrength: 16,
      defenderBuildDefinitionId: BuildFleet16ForStaging.id,
      expectedSurvivingAttackerStrength: 19,
      expectedAttackerRemovalCount: 0,
      expectedAttackerFleetCount: 1,
      expectedAttackerAtTargetCount: 1,
      preventedReason: "Fleet has 19 Strength, below the 20 required to colonize",
    },
    {
      attackerStrength: 20,
      attackerBuildDefinitionId: BuildFleet20ForExactColonize.id,
      defenderStrength: 20,
      defenderBuildDefinitionId: BuildFleet20ForExactColonize.id,
      expectedSurvivingAttackerStrength: undefined,
      expectedAttackerRemovalCount: 1,
      expectedAttackerFleetCount: 0,
      expectedAttackerAtTargetCount: 0,
      preventedReason: "destroyed before colonization",
    },
  ])(
    "should persist composed Assault before Colonize at strength $attackerStrength versus $defenderStrength",
    async ({
      attackerStrength,
      defenderStrength,
      attackerBuildDefinitionId,
      defenderBuildDefinitionId,
      expectedSurvivingAttackerStrength,
      expectedAttackerRemovalCount,
      expectedAttackerFleetCount,
      expectedAttackerAtTargetCount,
      preventedReason,
    }) => {
      // Arrange
      await using server = await ConcurrencyTestApiServer.create()
      const fixture = await createPublicTwoPlayerFixture(server)
      const { alice, bob, clients, gameId, clock, turnProcessor, turnsRepository, homeA, homeB, target } = fixture
      let views = fixture.views
      const defenderDistance = Math.hypot(homeB.x - target.x, homeB.y - target.y)
      expect(defenderDistance).toBeCloseTo(18.852953053708077, 12)
      expect(target.ownerPlayerId).toBeNull()

      await submitAction({
        client: alice.client,
        gameId,
        view: required(views[0]),
        actionDefinitionId: attackerBuildDefinitionId,
        selectedTargets: { planet: homeA.id },
        selectedInputs: {},
      })
      await submitAction({
        client: bob.client,
        gameId,
        view: required(views[1]),
        actionDefinitionId: defenderBuildDefinitionId,
        selectedTargets: { planet: homeB.id },
        selectedInputs: {},
      })
      let stage = await processTurnWithReplay({
        server,
        clock,
        turnsRepository,
        turnProcessor,
        clients,
        gameId,
        turn: required(views[0]).turn,
      })
      views = stage.views
      const attacker = getFleetAt(required(views[0]), required(views[0]).player.id, homeA.id, attackerStrength)
      const defenderSource = getFleetAt(required(views[1]), required(views[1]).player.id, homeB.id, defenderStrength)
      const defenderMoveId = await submitAction({
        client: bob.client,
        gameId,
        view: required(views[1]),
        actionDefinitionId: MoveFleetSpeed10.id,
        selectedTargets: { fleet: defenderSource.id, planet: target.id },
        selectedInputs: { strength: defenderStrength },
      })
      stage = await processTurnWithReplay({
        server,
        clock,
        turnsRepository,
        turnProcessor,
        clients,
        gameId,
        turn: required(views[0]).turn,
      })
      views = stage.views
      const defenderJourney = required(views[1]).fleets.find(({ movement }) => movement?.submission.id === defenderMoveId)
      Assert.isDefined(defenderJourney)
      expect(defenderJourney.distanceToEnd).toBeCloseTo(8.852953053708077, 12)

      expect(getPlanets(required(views[0])).find(({ id }) => id === target.id)?.ownerPlayerId).toBeNull()
      // Act & Assert
      const composedActionId = await submitAction({
        client: alice.client,
        gameId,
        view: required(views[0]),
        actionDefinitionId: ComposedSuccessAttackColonize.id,
        selectedTargets: { fleet: attacker.id, planet: target.id },
        selectedInputs: { strength: attackerStrength },
      })
      const selectedViews = await readViews(clients, gameId)
      const selectedInfluence = required(selectedViews[0]).resources[ResourceType.INFLUENCE]
      expect(selectedInfluence.uncommitted).toBe(selectedInfluence.total - 25)
      expect(required(selectedViews[0]).resources[ResourceType.COLONY]).toStrictEqual({ total: 0, uncommitted: 0 })

      stage = await processTurnWithReplay({
        server,
        clock,
        turnsRepository,
        turnProcessor,
        clients,
        gameId,
        turn: required(selectedViews[0]).turn,
      })
      views = stage.views
      const arrivingJourney = required(views[0]).fleets.find(({ movement }) => movement?.submission.id === composedActionId)
      Assert.isDefined(arrivingJourney)
      expect(arrivingJourney.distanceToEnd).toBeCloseTo(0.2645395167985714, 12)
      expect(stage.resolved.fleets[defenderJourney.id]?.arrivedAtTick).toBe(18)
      expect(getFleetAt(required(views[1]), required(views[1]).player.id, target.id, defenderStrength).id).toBe(defenderJourney.id)
      expect(getPlanets(required(views[0])).find(({ id }) => id === target.id)?.ownerPlayerId).toBeNull()

      const workerInput = await captureWorkerInput({ server, clock, turnsRepository, gameId, turn: required(views[0]).turn })
      const replay = replayWorkerInputWithState(workerInput)
      Assert.isSuccess(replay.resolved)
      const loadedAttacker = Object.values(workerInput.fleets).find(({ movement }) => movement?.submission.id === composedActionId)
      Assert.isDefined(loadedAttacker)
      const loadedDefender = workerInput.fleets[defenderJourney.id]
      Assert.isDefined(loadedDefender)
      expect(loadedAttacker).toMatchObject({ strength: attackerStrength, movement: { submission: { id: composedActionId } } })
      expect(loadedDefender).toMatchObject({ strength: defenderStrength, originPlanetId: target.id })
      expect(loadedDefender.movement).toBeUndefined()
      expect(
        loadedAttacker.movement?.pendingArrivalEffects.map(({ effectDefinition, definitionOrdinal }) => ({
          type: effectDefinition.type,
          definitionOrdinal,
        })),
      ).toStrictEqual([
        { type: "FLEET_COLONIZE", definitionOrdinal: 1 },
        { type: "FLEET_ASSAULT", definitionOrdinal: 2 },
      ])

      const replayedTarget = replay.resolved.value.planets[target.id]
      const continuation = replay.resolved.value.resolvedContinuations.find(
        ({ originatingSubmission }) => originatingSubmission.id === composedActionId,
      )
      Assert.isDefined(continuation)
      expect(replayedTarget?.ownerPlayerId).toBeNull()
      expect(replay.resolved.value.planetOwnershipChanges).toStrictEqual([])
      expect(continuation.actionOutcomes).toContainEqual(
        expect.objectContaining({
          type: "RESOLVED",
          result: expect.stringContaining(`exchanged ${defenderStrength} Strength with ${defenderStrength} enemy Strength`),
        }),
      )
      expect(continuation.actionOutcomes.some((outcome) => hasPreventedReason(outcome, preventedReason))).toBe(true)
      expect(replay.resolved.value.fleets[loadedAttacker.id]?.strength).toBe(expectedSurvivingAttackerStrength)
      expect(replay.resolved.value.fleets[loadedDefender.id]).toBeUndefined()
      expect(replay.resolved.value.removedFleetIds).toContain(loadedDefender.id)
      expect(Object.values(replay.resolved.value.fleets).filter(({ id }) => id === loadedAttacker.id)).toHaveLength(
        expectedAttackerFleetCount,
      )
      expect(replay.resolved.value.removedFleetIds.filter((id) => id === loadedAttacker.id)).toHaveLength(expectedAttackerRemovalCount)

      expect(await turnProcessor.processNextDueTurn()).toBe("processed")
      views = await readViews(clients, gameId)
      expect(getPlanets(required(views[0])).find(({ id }) => id === target.id)?.ownerPlayerId).toBeNull()
      expect(required(views[0]).fleets.find(({ id }) => id === loadedDefender.id)).toBeUndefined()
      const persistedAttacker = required(views[0]).fleets.find(({ id }) => id === loadedAttacker.id)
      expect(persistedAttacker?.strength).toBe(expectedSurvivingAttackerStrength)

      expect(persistedAttacker?.movement).toBeUndefined()
      expect(persistedAttacker?.destinationPlanetId).toBeUndefined()
      expect(required(views[0]).resources[ResourceType.INFLUENCE]).toStrictEqual({
        total: selectedInfluence.total - 25,
        uncommitted: selectedInfluence.total - 25,
      })
      expect(required(views[0]).resources[ResourceType.COLONY]).toStrictEqual({ total: 0, uncommitted: 0 })
      expect(required(views[0]).actions.find(({ id }) => id === composedActionId)).toMatchObject({
        selectedTargets: null,
        isInProgress: false,
      })

      const persistedFleetRows = await server.database
        .select()
        .from(fleetsTable)
        .where(eq(fleetsTable.gameId, typedParse(GameIdSchema, gameId)))
      expect(persistedFleetRows.find(({ id }) => id === loadedDefender.id)).toBeUndefined()
      expect(persistedFleetRows.find(({ id }) => id === loadedAttacker.id)?.strength).toBe(expectedSurvivingAttackerStrength)
      expect(persistedFleetRows.filter(({ id }) => id === loadedAttacker.id)).toHaveLength(expectedAttackerFleetCount)
      expect(
        persistedFleetRows.filter(({ id }) => id === loadedAttacker.id).filter(({ originPlanetId }) => originPlanetId === target.id),
      ).toHaveLength(expectedAttackerAtTargetCount)
      const savedTurns = await server.database
        .select()
        .from(turnsTable)
        .where(eq(turnsTable.gameId, typedParse(GameIdSchema, gameId)))
      const savedNextTurn = savedTurns.find(({ turn }) => turn === workerInput.turn + 1)
      Assert.isDefined(savedNextTurn)
      const persistedNextRngState = { generatorState: savedNextTurn.rngGeneratorState, spareNormal: savedNextTurn.rngSpareNormal }
      expect(persistedNextRngState).toStrictEqual(replay.nextRngState)

      logReceipt("[C3-16 public composed prevention receipt]", {
        gameId,
        seed: 1,
        target: { id: target.id, name: target.name, coordinates: target.coordinates, x: target.x, y: target.y },
        routes: { attacker: 1.2645395167985714, defender: defenderDistance },
        forces: {
          attackerBeforeCombat: attackerStrength,
          defenderBeforeCombat: defenderStrength,
          attackerAfterCombat: expectedSurvivingAttackerStrength,
        },
        action: {
          id: composedActionId,
          definitionId: ComposedSuccessAttackColonize.id,
          paidInfluenceOnce: 25,
          pendingTypes: ["FLEET_COLONIZE", "FLEET_ASSAULT"],
        },
        replay: {
          targetOwner: replayedTarget?.ownerPlayerId,
          attacker: replay.resolved.value.fleets[loadedAttacker.id]?.strength,
          defenderRemoved: replay.resolved.value.fleets[loadedDefender.id] === undefined,
          outcomes: continuation.actionOutcomes.map(describeOutcomeRecord),
        },
        persisted: {
          targetOwner: getPlanets(required(views[0])).find(({ id }) => id === target.id)?.ownerPlayerId,
          attacker: persistedAttacker?.strength,
          defenderRemoved: persistedFleetRows.find(({ id }) => id === loadedDefender.id) === undefined,
          influence: required(views[0]).resources[ResourceType.INFLUENCE],
          colony: required(views[0]).resources[ResourceType.COLONY],
          actionReleased: required(views[0]).actions.find(({ id }) => id === composedActionId)?.isInProgress === false,
          persistedNextRngState,
        },
      })
    },
  )

  it("should use the current public stationary force after Move and Assault before Colonization", async () => {
    await using server = await ConcurrencyTestApiServer.create()
    const fixture = await createPublicTwoPlayerFixture(server)
    const { alice, bob, clients, gameId, clock, turnProcessor, turnsRepository, homeA, homeB, target } = fixture
    let views = fixture.views
    const routeDistance = Math.hypot(homeA.x - target.x, homeA.y - target.y)
    const enemyDistance = Math.hypot(homeB.x - target.x, homeB.y - target.y)
    expect(routeDistance).toBeCloseTo(1.2645395167985714, 12)
    expect(enemyDistance).toBeCloseTo(18.852953053708077, 12)
    expect(target.ownerPlayerId).toBeNull()

    await submitAction({
      client: alice.client,
      gameId,
      view: required(views[0]),
      actionDefinitionId: BuildFleet35.id,
      selectedTargets: { planet: homeA.id },
      selectedInputs: {},
    })
    await submitAction({
      client: bob.client,
      gameId,
      view: required(views[1]),
      actionDefinitionId: BuildFleet10ForStaging.id,
      selectedTargets: { planet: homeB.id },
      selectedInputs: {},
    })
    let stage = await processTurnWithReplay({
      server,
      clock,
      turnsRepository,
      turnProcessor,
      clients,
      gameId,
      turn: required(views[0]).turn,
    })
    views = stage.views
    const aliceSource = getFleetAt(required(views[0]), required(views[0]).player.id, homeA.id, 35)
    const bobSource = getFleetAt(required(views[1]), required(views[1]).player.id, homeB.id, 10)

    await submitAction({
      client: alice.client,
      gameId,
      view: required(views[0]),
      actionDefinitionId: MoveFleetSpeed10.id,
      selectedTargets: { fleet: aliceSource.id, planet: target.id },
      selectedInputs: { strength: 35 },
    })
    const bobStageMoveId = await submitAction({
      client: bob.client,
      gameId,
      view: required(views[1]),
      actionDefinitionId: MoveFleetSpeed10.id,
      selectedTargets: { fleet: bobSource.id, planet: target.id },
      selectedInputs: { strength: 1 },
    })
    stage = await processTurnWithReplay({ server, clock, turnsRepository, turnProcessor, clients, gameId, turn: required(views[0]).turn })
    views = stage.views
    const aliceArrival = findPublicFleet(Object.values(stage.resolved.fleets), {
      ownerPlayerId: playerIdFor(alice),
      originPlanetId: target.id,
      strength: 35,
      arrivedAtTick: 3,
    })
    const bobJourney = required(views[1]).fleets.find((fleet) =>
      matchesPublicFleet(fleet, { ownerPlayerId: playerIdFor(bob), movementSubmissionId: bobStageMoveId }),
    )
    Assert.isDefined(aliceArrival)
    Assert.isDefined(bobJourney)
    expect(aliceArrival.arrivedAtTick).toBe(3)
    expect(getFleetAt(required(views[0]), playerIdFor(alice), target.id, 35).id).toBe(aliceArrival.id)
    expect(bobJourney.distanceToEnd).toBeCloseTo(8.852953053708077, 12)
    expect(getPlanets(required(views[0])).find(({ id }) => id === target.id)?.ownerPlayerId).toBeNull()

    stage = await processTurnWithReplay({ server, clock, turnsRepository, turnProcessor, clients, gameId, turn: required(views[0]).turn })
    views = stage.views
    expect(stage.resolved.fleets[bobJourney.id]?.arrivedAtTick).toBe(18)
    const aliceStationary = getFleetAt(required(views[0]), required(views[0]).player.id, target.id, 35)
    const bobAssaultFleet = getFleetAt(required(views[1]), required(views[1]).player.id, target.id, 1)
    expect(getFleetAt(required(views[1]), required(views[1]).player.id, homeB.id, 9).strength).toBe(9)
    expect(getPlanets(required(views[0])).find(({ id }) => id === target.id)?.ownerPlayerId).toBeNull()

    const moveActionId = await submitAction({
      client: alice.client,
      gameId,
      view: required(views[0]),
      actionDefinitionId: MoveFleetStandard.id,
      selectedTargets: { fleet: aliceStationary.id, planet: homeA.id },
      selectedInputs: { strength: 15 },
    })
    const colonizeActionId = await submitAction({
      client: alice.client,
      gameId,
      view: required(views[0]),
      actionDefinitionId: ColonizeHereTest.id,
      selectedTargets: { fleet: aliceStationary.id, planet: target.id },
      selectedInputs: {},
    })
    const assaultActionId = await submitAction({
      client: bob.client,
      gameId,
      view: required(views[1]),
      actionDefinitionId: StationaryAssaultTest.id,
      selectedTargets: { station: bobAssaultFleet.id, battlePlanet: target.id },
      selectedInputs: {},
    })
    const selectedViews = await readViews(clients, gameId)
    expect(required(selectedViews[0]).actions.find(({ id }) => id === moveActionId)).toMatchObject({
      selectedTargets: { fleet: aliceStationary.id, planet: homeA.id },
      selectedInputs: { strength: 15 },
    })
    expect(required(selectedViews[0]).actions.find(({ id }) => id === colonizeActionId)).toMatchObject({
      selectedTargets: { fleet: aliceStationary.id, planet: target.id },
      selectedInputs: {},
    })
    expect(required(selectedViews[1]).actions.find(({ id }) => id === assaultActionId)).toMatchObject({
      selectedTargets: { station: bobAssaultFleet.id, battlePlanet: target.id },
      selectedInputs: {},
    })
    expect(required(selectedViews[0]).resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 495, uncommitted: 467 })
    expect(required(selectedViews[0]).resources[ResourceType.FUEL]).toStrictEqual({ total: 95, uncommitted: 94 })
    expect(required(selectedViews[1]).resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 495, uncommitted: 495 })
    expect(required(selectedViews[1]).resources[ResourceType.FUEL]).toStrictEqual({ total: 95, uncommitted: 95 })

    const turn = required(selectedViews[0]).turn
    const workerInput = await captureWorkerInput({ server, clock, turnsRepository, gameId, turn })
    const replay = replayWorkerInputWithState(workerInput)
    Assert.isSuccess(replay.resolved)
    expect(workerInput.submittedActions).toHaveLength(3)
    expect(workerInput.submittedActions.find(({ id }) => id === moveActionId)).toMatchObject({
      selectedTargets: { fleet: aliceStationary.id, planet: homeA.id },
      selectedInputs: { strength: 15 },
    })
    expect(workerInput.submittedActions.find(({ id }) => id === colonizeActionId)).toMatchObject({
      selectedTargets: { fleet: aliceStationary.id, planet: target.id },
      selectedInputs: {},
    })
    expect(workerInput.submittedActions.find(({ id }) => id === assaultActionId)).toMatchObject({
      selectedTargets: { station: bobAssaultFleet.id, battlePlanet: target.id },
      selectedInputs: {},
    })
    const moveResult = replay.resolved.value.resolvedActions.find(({ submittedAction }) => submittedAction.id === moveActionId)
    const colonizeResult = replay.resolved.value.resolvedActions.find(({ submittedAction }) => submittedAction.id === colonizeActionId)
    const assaultResult = replay.resolved.value.resolvedActions.find(({ submittedAction }) => submittedAction.id === assaultActionId)
    Assert.isDefined(moveResult)
    Assert.isDefined(colonizeResult)
    Assert.isDefined(assaultResult)
    expect(colonizeResult.actionOutcomes).toContainEqual(expect.objectContaining({ type: "PREVENTED" }))
    expect(assaultResult.actionOutcomes).toContainEqual(expect.objectContaining({ type: "RESOLVED" }))
    expect(replay.resolved.value.planets[target.id]?.ownerPlayerId).toBeNull()
    expect(replay.resolved.value.planetOwnershipChanges).toStrictEqual([])
    expect(replay.resolved.value.fleets[aliceStationary.id]?.strength).toBe(19)
    expect(replay.resolved.value.fleets[bobAssaultFleet.id]).toBeUndefined()
    expect(replay.resolved.value.removedFleetIds).toContain(bobAssaultFleet.id)
    const outgoingJourney = Object.values(replay.resolved.value.fleets).find(({ movement }) => movement?.submission.id === moveActionId)
    Assert.isDefined(outgoingJourney)
    expect(outgoingJourney).toMatchObject({
      ownerPlayerId: playerIdFor(alice),
      strength: 15,
      originPlanetId: target.id,
      destinationPlanetId: homeA.id,
      movement: { speed: 0.1, submission: { id: moveActionId }, pendingArrivalEffects: [] },
    })
    expect(outgoingJourney.distanceToEnd).toBeCloseTo(routeDistance - 0.1, 12)
    expect(replay.nextRngState).toStrictEqual(workerInput.rngState)

    expect(await turnProcessor.processNextDueTurn()).toBe("processed")
    views = await readViews(clients, gameId)
    expect(required(views[0]).turn).toBe(turn + 1)
    expect(getPlanets(required(views[0])).find(({ id }) => id === target.id)?.ownerPlayerId).toBeNull()
    expect(getFleetAt(required(views[0]), required(views[0]).player.id, target.id, 19).id).toBe(aliceStationary.id)
    expect(required(views[1]).fleets.find(({ id }) => id === bobAssaultFleet.id)).toBeUndefined()
    const persistedJourney = required(views[0]).fleets.find(({ movement }) => movement?.submission.id === moveActionId)
    Assert.isDefined(persistedJourney)
    expect(persistedJourney).toMatchObject({
      strength: 15,
      originPlanetId: target.id,
      destinationPlanetId: homeA.id,
      movement: { speed: 0.1, submission: { id: moveActionId }, pendingArrivalEffects: [] },
    })
    expect(persistedJourney.distanceToEnd).toBeCloseTo(routeDistance - 0.1, 12)
    expect(required(views[0]).resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 467, uncommitted: 467 })
    expect(required(views[0]).resources[ResourceType.FUEL]).toStrictEqual({ total: 94, uncommitted: 94 })
    expect(required(views[0]).resources[ResourceType.COLONY]).toStrictEqual({ total: 0, uncommitted: 0 })
    expect(required(views[1]).resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 495, uncommitted: 495 })
    expect(required(views[1]).resources[ResourceType.FUEL]).toStrictEqual({ total: 95, uncommitted: 95 })
    expect(required(views[0]).actions.find(({ id }) => id === colonizeActionId)).toMatchObject({
      selectedTargets: null,
      isInProgress: false,
    })
    const savedTurns = await server.database
      .select()
      .from(turnsTable)
      .where(eq(turnsTable.gameId, typedParse(GameIdSchema, gameId)))
    const savedNextTurn = savedTurns.find(({ turn: candidateTurn }) => candidateTurn === turn + 1)
    Assert.isDefined(savedNextTurn)
    const persistedNextRngState = { generatorState: savedNextTurn.rngGeneratorState, spareNormal: savedNextTurn.rngSpareNormal }
    expect(persistedNextRngState).toStrictEqual(replay.nextRngState)

    logReceipt("[C3-19 public stationary post-Move/Assault receipt]", {
      gameId,
      seed: 1,
      target: { id: target.id, coordinates: target.coordinates, x: target.x, y: target.y },
      sourceDistance: routeDistance,
      stagedForces: { alice35: aliceStationary.id, bob1: bobAssaultFleet.id },
      selected: { move15: moveActionId, stationaryColonize20: colonizeActionId, enemyAssault1: assaultActionId },
      workerOutcome: {
        owner: getPlanets(required(views[0])).find(({ id }) => id === target.id)?.ownerPlayerId,
        stationaryAfterAssault: 19,
        colonize: colonizeResult.actionOutcomes,
        defenderRemoved: true,
      },
      outgoingJourney: {
        id: persistedJourney.id,
        strength: persistedJourney.strength,
        destination: homeA.coordinates,
        remainingDistance: persistedJourney.distanceToEnd,
      },
      resourcesAfterUnrefundedCosts: {
        influence: required(views[0]).resources[ResourceType.INFLUENCE].total,
        fuel: required(views[0]).resources[ResourceType.FUEL].total,
      },
      rng: { preResolution: workerInput.rngState, replayNext: replay.nextRngState, persistedNext: persistedNextRngState },
    })
  })

  it("should claim a public35-force source after Move15 while preserving the Q-bound remainder15", async () => {
    await using server = await ConcurrencyTestApiServer.create()
    const rulesetsRepository = new RulesetsRepository({ db: server.database, logger: Logger.get() })
    Assert.isSuccess(await rulesetsRepository.upsertRuleset(PublicColonizationBudgetRuleset))
    const player = await server.createClient({ authenticated: true, id: "00000000-0000-4000-8000-000000000046" })
    const { createdGameId: gameId } = await player.client.games.create.mutate({
      configuration: createGameConfigurationStub({
        rulesetId: PublicColonizationBudgetRuleset.id,
        nbSeats: 1,
        turnIntervalSeconds: Time.in(MANUAL_TURN_INTERVAL, UnitOfTime.SECONDS),
        mapGenerationSeed: 1234,
      }),
    })
    await player.client.games.startGame.mutate({ gameId })
    const clock = new ControlledClock({ startDate: new Date() })
    const { turnProcessor, turnsRepository } = await createTurnProcessorStub({ db: server.database, clock })
    let view = await player.client.gameplay.getPlayerView.query({ gameId })
    const home = getHome(view)
    const target = getPlanets(view).find(({ id }) => id === "a34e5eae-656c-5330-ac90-9f9a7e0afa5d")
    Assert.isDefined(target)
    expect(home.coordinates).toBe("45:98:30")
    expect(target.coordinates).toBe("55:07:50")
    const routeDistance = Math.hypot(home.x - target.x, home.y - target.y)
    expect(routeDistance).toBeCloseTo(1.1456435045942517, 12)
    expect(target.ownerPlayerId).toBeNull()

    const buildActionId = await submitAction({
      client: player.client,
      gameId,
      view,
      actionDefinitionId: PublicBudgetBuild35.id,
      selectedTargets: { planet: home.id },
      selectedInputs: {},
    })
    view = await processTurn({ clock, turnsRepository, turnProcessor, client: player.client, gameId, turn: view.turn })
    const source = getFleetAt(view, view.player.id, home.id, 35)
    const stageActionId = await submitAction({
      client: player.client,
      gameId,
      view,
      actionDefinitionId: PublicBudgetStageFleet.id,
      selectedTargets: { fleet: source.id, planet: target.id },
      selectedInputs: { strength: 35 },
    })
    const staged = await processTurnWithReplay({
      server,
      clock,
      turnsRepository,
      turnProcessor,
      clients: [player],
      gameId,
      turn: view.turn,
    })
    view = required(staged.views[0])
    const stagedArrival = Object.values(staged.resolved.fleets).find((fleet) =>
      matchesPublicFleet(fleet, { ownerPlayerId: view.player.id, originPlanetId: target.id, strength: 35 }),
    )
    Assert.isDefined(stagedArrival)
    expect(stagedArrival.arrivedAtTick).toBeDefined()
    const stationary = getFleetAt(view, view.player.id, target.id, 35)
    expect(stationary.id).toBe(stagedArrival.id)

    const moveActionId = await submitAction({
      client: player.client,
      gameId,
      view,
      actionDefinitionId: MoveFleetStandard.id,
      selectedTargets: { fleet: stationary.id, planet: home.id },
      selectedInputs: { strength: 15 },
    })
    const colonizeActionId = await submitAction({
      client: player.client,
      gameId,
      view,
      actionDefinitionId: ColonizeHereTest.id,
      selectedTargets: { fleet: stationary.id, planet: target.id },
      selectedInputs: {},
    })
    const selectedView = await player.client.gameplay.getPlayerView.query({ gameId })
    expect(selectedView.actions.find(({ id }) => id === moveActionId)).toMatchObject({
      actionDefinitionId: MoveFleetStandard.id,
      selectedTargets: { fleet: stationary.id, planet: home.id },
      selectedInputs: { strength: 15 },
    })
    expect(selectedView.actions.find(({ id }) => id === colonizeActionId)).toMatchObject({
      actionDefinitionId: ColonizeHereTest.id,
      selectedTargets: { fleet: stationary.id, planet: target.id },
      selectedInputs: {},
    })
    expect(selectedView.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 100, uncommitted: 72 })
    expect(selectedView.resources[ResourceType.FUEL]).toStrictEqual({ total: 10, uncommitted: 9 })
    expect(selectedView.resources[ResourceType.COLONY]).toStrictEqual({ total: 0, uncommitted: 0 })

    const workerInput = await captureWorkerInput({ server, clock, turnsRepository, gameId, turn: selectedView.turn })
    const replay = replayWorkerInputWithState(workerInput)
    Assert.isSuccess(replay.resolved)
    expect(workerInput.submittedActions).toHaveLength(2)
    expect(findPlayerAction(workerInput.submittedActions, moveActionId, playerIdFor(player))).toMatchObject({
      selectedTargets: { fleet: stationary.id, planet: home.id },
      selectedInputs: { strength: 15 },
    })
    expect(findPlayerAction(workerInput.submittedActions, colonizeActionId, playerIdFor(player))).toMatchObject({
      selectedTargets: { fleet: stationary.id, planet: target.id },
      selectedInputs: {},
    })
    const moveResult = findResolvedAction(replay.resolved.value.resolvedActions, moveActionId, playerIdFor(player))

    const colonizeResult = findResolvedAction(replay.resolved.value.resolvedActions, colonizeActionId, playerIdFor(player))

    Assert.isDefined(moveResult)
    Assert.isDefined(colonizeResult)
    expect(moveResult.actionOutcomes).toContainEqual(expect.objectContaining({ type: "RESOLVED" }))
    expect(colonizeResult.actionOutcomes).toContainEqual(expect.objectContaining({ type: "RESOLVED" }))
    expect(replay.resolved.value.removedFleetIds).toContain(stationary.id)
    expect(replay.resolved.value.fleets[stationary.id]).toBeUndefined()
    const journey = findPublicFleet(Object.values(replay.resolved.value.fleets), {
      ownerPlayerId: playerIdFor(player),
      originPlanetId: target.id,
      destinationPlanetId: home.id,
      strength: 15,
      movementSubmissionId: moveActionId,
    })
    Assert.isDefined(journey)
    expect(journey.distanceToEnd).toBeCloseTo(routeDistance - 0.1, 12)
    expect(journey.movement).toMatchObject({ speed: 0.1, submission: { id: moveActionId }, pendingArrivalEffects: [] })
    expect(replay.resolved.value.planets[target.id]?.ownerPlayerId).toBe(playerIdFor(player))
    expect(replay.resolved.value.planetOwnershipChanges).toStrictEqual([{ planetId: target.id, ownerPlayerId: playerIdFor(player) }])
    expect(replay.nextRngState).toStrictEqual(workerInput.rngState)

    expect(await turnProcessor.processNextDueTurn()).toBe("processed")
    view = await player.client.gameplay.getPlayerView.query({ gameId })
    expect(view.turn).toBe(selectedView.turn + 1)
    expect(getPlanets(view).find(({ id }) => id === target.id)?.ownerPlayerId).toBe(playerIdFor(player))
    expect(view.fleets).toHaveLength(1)
    expect(view.fleets[0]).toMatchObject({
      id: journey.id,
      strength: 15,
      originPlanetId: target.id,
      destinationPlanetId: home.id,
      movement: { speed: 0.1, submission: { id: moveActionId }, pendingArrivalEffects: [] },
    })
    expect(required(view.fleets[0]).distanceToEnd).toBeCloseTo(routeDistance - 0.1, 12)
    expect(view.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 72, uncommitted: 72 })
    expect(view.resources[ResourceType.FUEL]).toStrictEqual({ total: 9, uncommitted: 9 })
    expect(view.resources[ResourceType.COLONY]).toStrictEqual({ total: 0, uncommitted: 0 })
    expect(view.actions.find(({ id }) => id === colonizeActionId)).toMatchObject({ selectedTargets: null, isInProgress: false })
    const savedTurns = await server.database
      .select()
      .from(turnsTable)
      .where(eq(turnsTable.gameId, typedParse(GameIdSchema, gameId)))
    const savedNextTurn = savedTurns.find(({ turn: candidateTurn }) => candidateTurn === workerInput.turn + 1)
    Assert.isDefined(savedNextTurn)
    const persistedNextRngState = { generatorState: savedNextTurn.rngGeneratorState, spareNormal: savedNextTurn.rngSpareNormal }
    expect(persistedNextRngState).toStrictEqual(replay.nextRngState)

    logReceipt("[C3-19 public Move15+stationary Colonize20 success receipt]", {
      gameId,
      seed: 1234,
      home: { id: home.id, coordinates: home.coordinates, x: home.x, y: home.y },
      target: { id: target.id, coordinates: target.coordinates, x: target.x, y: target.y },
      routeDistance,
      staging: { buildActionId, stageActionId, strength: 35, actualArrivalTick: stagedArrival.arrivedAtTick },
      selected: { move15: moveActionId, stationaryColonize20: colonizeActionId },
      result: {
        owner: playerIdFor(player),
        stationary35Consumed: true,
        journey: { id: journey.id, strength: journey.strength, distanceToEnd: journey.distanceToEnd },
      },
      payment: { influence: 28, fuel: 1, remaining: { influence: 72, fuel: 9 } },
      rng: { preResolution: workerInput.rngState, replayNext: replay.nextRngState, persistedNext: persistedNextRngState },
    })
  })

  it("should persist exact20 Colonization as an owned Planet with no surviving Fleet row", async () => {
    await using server = await ConcurrencyTestApiServer.create()
    const fixture = await createPublicNaturalRouteFixture(server, "00000000-0000-4000-8000-000000000041")
    const { player, gameId, clock, turnProcessor, turnsRepository, home, target } = fixture
    const buildAction = fixture.view.actions.find(({ actionDefinitionId }) => actionDefinitionId === BuildFleet20ForExactColonize.id)
    Assert.isDefined(buildAction)

    await submitAction({
      client: player.client,
      gameId,
      view: fixture.view,
      actionDefinitionId: BuildFleet20ForExactColonize.id,
      selectedTargets: { planet: home.id },
      selectedInputs: {},
    })
    const builtView = await processTurn({
      clock,
      turnsRepository,
      turnProcessor,
      client: player.client,
      gameId,
      turn: fixture.view.turn,
    })
    const sourceFleet = getFleetAt(builtView, builtView.player.id, home.id, 20)
    expect(builtView.resources[ResourceType.INFLUENCE].total).toBe(58)
    expect(builtView.resources[ResourceType.METAL].total).toBe(4)

    const colonizeActionId = await submitAction({
      client: player.client,
      gameId,
      view: builtView,
      actionDefinitionId: ColonizePlanetTest.id,
      selectedTargets: { fleet: sourceFleet.id, planet: target.id },
      selectedInputs: { strength: 20 },
    })
    const selectedView = await player.client.gameplay.getPlayerView.query({ gameId })
    expect(selectedView.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 58, uncommitted: 33 })
    expect(selectedView.resources[ResourceType.COLONY]).toStrictEqual({ total: 0, uncommitted: 0 })

    const departedView = await processTurn({
      clock,
      turnsRepository,
      turnProcessor,
      client: player.client,
      gameId,
      turn: selectedView.turn,
    })
    const journey = departedView.fleets.find(({ movement }) => movement?.submission.id === colonizeActionId)
    Assert.isDefined(journey)
    expect(departedView.fleets.find(({ id }) => id === sourceFleet.id)).toBeUndefined()
    expect(getPlanets(departedView).find(({ id }) => id === target.id)?.ownerPlayerId).toBeNull()
    expect(departedView.resources[ResourceType.INFLUENCE].total).toBe(33)

    const arrivalInput = await captureWorkerInput({
      server,
      clock,
      turnsRepository,
      gameId,
      turn: departedView.turn,
    })
    const replay = replayWorkerInputWithState(arrivalInput)
    Assert.isSuccess(replay.resolved)
    expect(replay.resolved.value.removedFleetIds).toContain(journey.id)
    expect(replay.resolved.value.planetOwnershipChanges).toStrictEqual([{ planetId: target.id, ownerPlayerId: playerIdFor(player) }])
    expect(replay.nextRngState).toStrictEqual(arrivalInput.rngState)
    expect(await turnProcessor.processNextDueTurn()).toBe("processed")

    const arrivedView = await player.client.gameplay.getPlayerView.query({ gameId })
    expect(arrivedView.turn).toBe(departedView.turn + 1)
    expect(getPlanets(arrivedView).find(({ id }) => id === target.id)?.ownerPlayerId).toBe(playerIdFor(player))
    expect(arrivedView.fleets.find(({ id }) => id === journey.id)).toBeUndefined()
    expect(arrivedView.fleets.filter(({ originPlanetId }) => originPlanetId === target.id)).toHaveLength(0)
    expect(arrivedView.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 33, uncommitted: 33 })
    expect(arrivedView.resources[ResourceType.COLONY]).toStrictEqual({ total: 0, uncommitted: 0 })
    expect(arrivedView.actions.find(({ id }) => id === colonizeActionId)).toMatchObject({ selectedTargets: null, isInProgress: false })
    expect(
      await server.database
        .select()
        .from(fleetsTable)
        .where(eq(fleetsTable.gameId, typedParse(GameIdSchema, gameId))),
    ).not.toContainEqual(expect.objectContaining({ id: journey.id }))

    const emptyTurnInput = await captureWorkerInput({
      server,
      clock,
      turnsRepository,
      gameId,
      turn: arrivedView.turn,
    })
    expect(emptyTurnInput.submittedActions).toHaveLength(0)
    const emptyTurnReplay = replayWorkerInputWithState(emptyTurnInput)
    Assert.isSuccess(emptyTurnReplay.resolved)
    expect(emptyTurnReplay.resolved.value.removedFleetIds).toStrictEqual([])
    expect(emptyTurnReplay.resolved.value.planetOwnershipChanges).toStrictEqual([])
    expect(emptyTurnReplay.nextRngState).toStrictEqual(emptyTurnInput.rngState)
    expect(await turnProcessor.processNextDueTurn()).toBe("processed")
    const emptyTurnView = await player.client.gameplay.getPlayerView.query({ gameId })
    expect(emptyTurnView.turn).toBe(arrivedView.turn + 1)
    expect(getPlanets(emptyTurnView).find(({ id }) => id === target.id)?.ownerPlayerId).toBe(playerIdFor(player))
    expect(emptyTurnView.fleets).toHaveLength(0)
    expect(emptyTurnView.resources).toStrictEqual(arrivedView.resources)
    expect(emptyTurnView.actions.find(({ id }) => id === colonizeActionId)).toMatchObject({
      selectedTargets: null,
      isInProgress: false,
    })
    expect(
      await server.database
        .select()
        .from(fleetsTable)
        .where(eq(fleetsTable.gameId, typedParse(GameIdSchema, gameId))),
    ).toHaveLength(0)

    logReceipt("[C3-03 public exact20 deletion receipt]", {
      gameId,
      seed: 1234,
      player: playerIdFor(player),
      home: { id: home.id, name: home.name, coordinates: home.coordinates },
      target: { id: target.id, name: target.name, coordinates: target.coordinates },
      builtStrength: sourceFleet.strength,
      departure: { turn: selectedView.turn, selected: 20, journeyId: journey.id },
      arrival: {
        turn: arrivedView.turn,
        owner: getPlanets(arrivedView).find(({ id }) => id === target.id)?.ownerPlayerId,
        removedFleetIds: replay.resolved.value.removedFleetIds,
        changedPlanets: replay.resolved.value.planetOwnershipChanges,
      },
      resources: {
        influence: arrivedView.resources[ResourceType.INFLUENCE].total,
        metal: arrivedView.resources[ResourceType.METAL].total,
        colony: arrivedView.resources[ResourceType.COLONY].total,
      },
      nextEmptyTurn: {
        turn: emptyTurnView.turn,
        owner: getPlanets(emptyTurnView).find(({ id }) => id === target.id)?.ownerPlayerId,
        fleets: emptyTurnView.fleets.length,
        unchangedResources: JSON.stringify(emptyTurnView.resources) === JSON.stringify(arrivedView.resources),
        colonizeActionAvailable: emptyTurnView.actions.find(({ id }) => id === colonizeActionId)?.isInProgress === false,
      },
    })
  })

  it("should prevent both exact20 public claimants after their Assaults destroy both Fleets", async () => {
    await using server = await ConcurrencyTestApiServer.create()
    const fixture = await createPublicTwoPlayerFixture(server)
    const { alice, bob, clients, gameId, clock, turnProcessor, turnsRepository, homeA, homeB, target } = fixture
    let views = fixture.views

    for (const [client, view, home] of [
      [alice, required(views[0]), homeA],
      [bob, required(views[1]), homeB],
    ] as const) {
      await submitAction({
        client: client.client,
        gameId,
        view,
        actionDefinitionId: BuildFleet20ForExactColonize.id,
        selectedTargets: { planet: home.id },
        selectedInputs: {},
      })
    }
    await processTurn({ clock, turnsRepository, turnProcessor, client: alice.client, gameId, turn: required(views[0]).turn })
    views = await readViews(clients, gameId)
    const aliceFleet = getFleetAt(required(views[0]), required(views[0]).player.id, homeA.id, 20)
    const bobFleet = getFleetAt(required(views[1]), required(views[1]).player.id, homeB.id, 20)
    const aliceDistance = Math.hypot(homeA.x - target.x, homeA.y - target.y)
    const bobDistance = Math.hypot(homeB.x - target.x, homeB.y - target.y)
    expect(aliceDistance).toBeCloseTo(1.2645395167985714, 12)
    expect(bobDistance).toBeCloseTo(18.852953053708077, 12)
    const bobAttemptId = await submitAction({
      client: bob.client,
      gameId,
      view: required(views[1]),
      actionDefinitionId: DeadFarAttackColonize.id,
      selectedTargets: { fleet: bobFleet.id, planet: target.id },
      selectedInputs: { strength: 20 },
    })
    let stage = await processTurnWithReplay({
      server,
      clock,
      turnsRepository,
      turnProcessor,
      clients,
      gameId,
      turn: required(views[0]).turn,
    })
    views = stage.views
    const bobJourney = required(views[1]).fleets.find(({ movement }) => movement?.submission.id === bobAttemptId)
    Assert.isDefined(bobJourney)
    expect(bobJourney.distanceToEnd).toBeCloseTo(13.852953053708077, 12)
    for (const expectedDistance of [8.852953053708077]) {
      stage = await processTurnWithReplay({ server, clock, turnsRepository, turnProcessor, clients, gameId, turn: required(views[0]).turn })
      views = stage.views
      const movingBob: PublicFleet | undefined = required(views[1]).fleets.find(({ id }) => id === bobJourney.id)
      Assert.isDefined(movingBob)
      const remainingDistance = movingBob.distanceToEnd
      Assert.isDefined(remainingDistance)
      expect(remainingDistance).toBeCloseTo(expectedDistance, 12)
    }
    const aliceAttemptId = await submitAction({
      client: alice.client,
      gameId,
      view: required(views[0]),
      actionDefinitionId: DeadEarlierAttackColonize.id,
      selectedTargets: { fleet: aliceFleet.id, planet: target.id },
      selectedInputs: { strength: 20 },
    })
    const selectedViews = await readViews(clients, gameId)
    expect(selectedViews.map(({ resources }) => resources[ResourceType.INFLUENCE])).toStrictEqual([
      { total: 498, uncommitted: 493 },
      { total: 493, uncommitted: 493 },
    ])
    expect(selectedViews.map(({ resources }) => resources[ResourceType.FUEL].total)).toStrictEqual([100, 99])
    expect(selectedViews.map(({ resources }) => resources[ResourceType.COLONY].total)).toStrictEqual([0, 0])
    expect(required(selectedViews[1]).fleets.find(({ id }) => id === bobJourney.id)?.distanceToEnd).toBeCloseTo(8.852953053708077, 12)
    const finalMovement = await processTurnWithReplay({
      server,
      clock,
      turnsRepository,
      turnProcessor,
      clients,
      gameId,
      turn: required(selectedViews[0]).turn,
    })
    views = finalMovement.views
    const finalAliceJourney = required(views[0]).fleets.find(({ movement }) => movement?.submission.id === aliceAttemptId)
    Assert.isDefined(finalAliceJourney)
    expect(finalAliceJourney.distanceToEnd).toBeCloseTo(0.2645395167985714, 12)
    expect(required(views[1]).fleets.find(({ id }) => id === bobJourney.id)?.distanceToEnd).toBeCloseTo(3.852953053708077, 12)
    expect(getPlanets(required(views[0])).find(({ id }) => id === target.id)?.ownerPlayerId).toBeNull()

    const workerInput = await captureWorkerInput({
      server,
      clock,
      turnsRepository,
      gameId,
      turn: required(views[0]).turn,
    })
    const replay = replayWorkerInputWithState(workerInput)
    Assert.isSuccess(replay.resolved)
    const loadedAliceJourney = Object.values(workerInput.fleets).find(({ movement }) => movement?.submission.id === aliceAttemptId)
    const loadedBobJourney = Object.values(workerInput.fleets).find(({ id }) => id === bobJourney.id)
    Assert.isDefined(loadedAliceJourney)
    Assert.isDefined(loadedBobJourney)
    expect(loadedBobJourney.movement?.submission.id).toBe(bobAttemptId)
    expect(replay.resolved.value.removedFleetIds).toStrictEqual(expect.arrayContaining([loadedAliceJourney.id, loadedBobJourney.id]))
    expect(replay.resolved.value.fleets[loadedAliceJourney.id]).toBeUndefined()
    expect(replay.resolved.value.fleets[loadedBobJourney.id]).toBeUndefined()
    expect(replay.resolved.value.planets[target.id]?.ownerPlayerId).toBeNull()
    expect(replay.resolved.value.planetOwnershipChanges).toStrictEqual([])
    const aliceContinuation = replay.resolved.value.resolvedContinuations.find(
      ({ originatingSubmission }) => originatingSubmission.id === aliceAttemptId,
    )
    const bobContinuation = replay.resolved.value.resolvedContinuations.find(
      ({ originatingSubmission }) => originatingSubmission.id === bobAttemptId,
    )
    Assert.isDefined(aliceContinuation)
    Assert.isDefined(bobContinuation)
    for (const continuation of [aliceContinuation, bobContinuation]) {
      expect(continuation.actionOutcomes).toContainEqual(
        expect.objectContaining({ type: "RESOLVED", result: expect.stringContaining("arrived on Planet") }),
      )
    }
    const finalOutcomes = [...aliceContinuation.actionOutcomes, ...bobContinuation.actionOutcomes]
    expect(finalOutcomes.filter((outcome) => hasResolvedResult(outcome, "exchanged 20 Strength with 20 enemy Strength"))).toHaveLength(1)
    expect(finalOutcomes.filter((outcome) => hasPreventedReason(outcome, "before colonization"))).toHaveLength(2)
    expect(finalOutcomes.filter((outcome) => hasPreventedReason(outcome, "before its Assault"))).toHaveLength(1)
    expect(finalOutcomes).not.toContainEqual(
      expect.objectContaining({ type: "RESOLVED", result: expect.stringContaining(" colonized Planet ") }),
    )
    expect(await turnProcessor.processNextDueTurn()).toBe("processed")
    views = await readViews(clients, gameId)
    expect(getPlanets(required(views[0])).find(({ id }) => id === target.id)?.ownerPlayerId).toBeNull()
    expect(views.map(({ fleets }) => fleets)).toStrictEqual([[], []])
    expect(views.map(({ resources }) => resources[ResourceType.INFLUENCE])).toStrictEqual([
      { total: 493, uncommitted: 493 },
      { total: 493, uncommitted: 493 },
    ])
    expect(views.map(({ resources }) => resources[ResourceType.FUEL].total)).toStrictEqual([99, 99])
    expect(views.map(({ resources }) => resources[ResourceType.COLONY].total)).toStrictEqual([0, 0])
    for (const [view, actionId] of [
      [required(views[0]), aliceAttemptId],
      [required(views[1]), bobAttemptId],
    ] as const) {
      expect(view.actions.find(({ id }) => id === actionId)).toMatchObject({ selectedTargets: null, isInProgress: false })
    }
    expect(
      await server.database
        .select()
        .from(fleetsTable)
        .where(eq(fleetsTable.gameId, typedParse(GameIdSchema, gameId))),
    ).toHaveLength(0)
    const savedTurns = await server.database
      .select()
      .from(turnsTable)
      .where(eq(turnsTable.gameId, typedParse(GameIdSchema, gameId)))
    const savedNextTurn = savedTurns.find(({ turn }) => turn === workerInput.turn + 1)
    Assert.isDefined(savedNextTurn)
    const persistedNextRngState = { generatorState: savedNextTurn.rngGeneratorState, spareNormal: savedNextTurn.rngSpareNormal }
    expect(persistedNextRngState).toStrictEqual(replay.nextRngState)

    logReceipt("[C3-05/16 public exact20 mutual Assault receipt]", {
      gameId,
      seed: 1,
      homes: [homeA, homeB].map(({ id, name, coordinates }) => ({ id, name, coordinates })),
      target: { id: target.id, name: target.name, coordinates: target.coordinates },
      routes: { aliceDistance, bobDistance, speed: { alice: 1, bob: 5 } },
      loadedForces: { alice: { fleetId: aliceFleet.id, strength: 20 }, bob: { fleetId: bobFleet.id, strength: 20 } },
      removedFleetIds: replay.resolved.value.removedFleetIds,
      arrivalTurn: workerInput.turn,
      continuations: [aliceContinuation, bobContinuation].map(({ originatingSubmission, departureTurn }) => ({
        actionId: originatingSubmission.id,
        departureTurn,
      })),
      outcomeTrace: finalOutcomes.map(describeOutcomeRecord),

      persistedOwner: getPlanets(required(views[0])).find(({ id }) => id === target.id)?.ownerPlayerId,
      persistedFleets: views.flatMap(({ fleets }) => fleets),
      persistedResources: views.map(({ resources }) => ({
        influence: resources[ResourceType.INFLUENCE].total,
        fuel: resources[ResourceType.FUEL].total,
        colony: resources[ResourceType.COLONY].total,
      })),
      loadedRngState: workerInput.rngState,
      replayNextRngState: replay.nextRngState,
      persistedNextRngState,
    })
  })

  it("should prevent a captured Colonize intent after its target is claimed while the Fleet is in transit", async () => {
    await using server = await ConcurrencyTestApiServer.create()
    const fixture = await createPublicTwoPlayerFixture(server)
    const { alice, bob, clients, gameId, clock, turnProcessor, turnsRepository, homeA, homeB, target } = fixture
    let views = fixture.views

    for (const [client, view, home] of [
      [alice, required(views[0]), homeA],
      [bob, required(views[1]), homeB],
    ] as const) {
      await submitAction({
        client: client.client,
        gameId,
        view,
        actionDefinitionId: BuildFleet35.id,
        selectedTargets: { planet: home.id },
        selectedInputs: {},
      })
    }
    await processTurn({ clock, turnsRepository, turnProcessor, client: alice.client, gameId, turn: required(views[0]).turn })
    views = await readViews(clients, gameId)
    const aliceSource = getFleetAt(required(views[0]), required(views[0]).player.id, homeA.id, 35)
    const bobSource = getFleetAt(required(views[1]), required(views[1]).player.id, homeB.id, 35)

    const stageMoveId = await submitAction({
      client: alice.client,
      gameId,
      view: required(views[0]),
      actionDefinitionId: MoveFleetExceptional.id,
      selectedTargets: { fleet: aliceSource.id, planet: target.id },
      selectedInputs: { strength: 35 },
    })
    let stage = await processTurnWithReplay({
      server,
      clock,
      turnsRepository,
      turnProcessor,
      clients,
      gameId,
      turn: required(views[0]).turn,
    })
    views = stage.views
    const stagedAlice = getFleetAt(required(views[0]), required(views[0]).player.id, target.id, 35)
    expect(stage.resolved.removedFleetIds).toContain(aliceSource.id)
    expect(required(views[0]).fleets.find(({ id }) => id === aliceSource.id)).toBeUndefined()
    expect(getPlanets(required(views[0])).find(({ id }) => id === target.id)?.ownerPlayerId).toBeNull()
    expect(required(views[0]).actions.find(({ id }) => id === stageMoveId)).toMatchObject({ selectedTargets: null, isInProgress: false })

    const bobColonizeId = await submitAction({
      client: bob.client,
      gameId,
      view: required(views[1]),
      actionDefinitionId: ColonizeFarFleetSpeed5.id,
      selectedTargets: { fleet: bobSource.id, planet: target.id },
      selectedInputs: { strength: 35 },
    })
    const aliceColonizeId = await submitAction({
      client: alice.client,
      gameId,
      view: required(views[0]),
      actionDefinitionId: ColonizeHereTest.id,
      selectedTargets: { fleet: stagedAlice.id, planet: target.id },
      selectedInputs: {},
    })
    const selectedViews = await readViews(clients, gameId)
    expect(required(selectedViews[0]).resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 495, uncommitted: 470 })
    expect(required(selectedViews[0]).resources[ResourceType.FUEL].total).toBe(95)
    expect(required(selectedViews[1]).resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 498, uncommitted: 473 })
    expect(required(selectedViews[1]).resources[ResourceType.FUEL].total).toBe(100)

    stage = await processTurnWithReplay({
      server,
      clock,
      turnsRepository,
      turnProcessor,
      clients,
      gameId,
      turn: required(selectedViews[0]).turn,
    })
    views = stage.views
    const bobJourney = required(views[1]).fleets.find(({ movement }) => movement?.submission.id === bobColonizeId)
    Assert.isDefined(bobJourney)
    expect(bobJourney.distanceToEnd).toBeCloseTo(13.852953053708077, 12)
    expect(getPlanets(required(views[0])).find(({ id }) => id === target.id)?.ownerPlayerId).toBe(playerIdFor(alice))
    expect(getFleetAt(required(views[0]), playerIdFor(alice), target.id, 15).id).toBe(stagedAlice.id)
    expect(required(views[0]).actions.find(({ id }) => id === aliceColonizeId)).toMatchObject({
      selectedTargets: null,
      isInProgress: false,
    })
    expect(required(views[1]).actions.find(({ id }) => id === bobColonizeId)).toMatchObject({ isInProgress: true })
    const transitDistances = [13.852953053708077]

    for (const expectedDistance of [8.852953053708077, 3.852953053708077]) {
      stage = await processTurnWithReplay({
        server,
        clock,
        turnsRepository,
        turnProcessor,
        clients,
        gameId,
        turn: required(views[0]).turn,
      })
      views = stage.views
      const movingBob: PublicFleet | undefined = required(views[1]).fleets.find(({ id }) => id === bobJourney.id)
      Assert.isDefined(movingBob)
      const remainingDistance = movingBob.distanceToEnd
      Assert.isDefined(remainingDistance)
      expect(remainingDistance).toBeCloseTo(expectedDistance, 12)
      expect(getPlanets(required(views[0])).find(({ id }) => id === target.id)?.ownerPlayerId).toBe(playerIdFor(alice))
      expect(getFleetAt(required(views[0]), playerIdFor(alice), target.id, 15).id).toBe(stagedAlice.id)
      expect(required(views[1]).actions.find(({ id }) => id === bobColonizeId)).toMatchObject({ isInProgress: true })
      transitDistances.push(remainingDistance)
    }

    const workerInput = await captureWorkerInput({
      server,
      clock,
      turnsRepository,
      gameId,
      turn: required(views[0]).turn,
    })
    const replay = replayWorkerInputWithState(workerInput)
    Assert.isSuccess(replay.resolved)
    const loadedBobJourney = Object.values(workerInput.fleets).find(({ id }) => id === bobJourney.id)
    Assert.isDefined(loadedBobJourney)
    expect(loadedBobJourney.movement?.submission.id).toBe(bobColonizeId)
    expect(replay.resolved.value.planets[target.id]?.ownerPlayerId).toBe(playerIdFor(alice))
    expect(replay.resolved.value.fleets[bobJourney.id]).toMatchObject({
      ownerPlayerId: playerIdFor(bob),
      originPlanetId: target.id,
      strength: 35,
      movement: undefined,
    })
    const bobContinuation = replay.resolved.value.resolvedContinuations.find(
      ({ originatingSubmission }) => originatingSubmission.id === bobColonizeId,
    )
    Assert.isDefined(bobContinuation)
    expect(bobContinuation.actionOutcomes).toContainEqual(
      expect.objectContaining({ type: "RESOLVED", result: expect.stringContaining("arrived on Planet") }),
    )
    expect(bobContinuation.actionOutcomes).toContainEqual(
      expect.objectContaining({ type: "PREVENTED", reason: "Planet is already claimed" }),
    )
    expect(replay.resolved.value.planetOwnershipChanges).toStrictEqual([])

    expect(await turnProcessor.processNextDueTurn()).toBe("processed")
    views = await readViews(clients, gameId)
    expect(getPlanets(required(views[0])).find(({ id }) => id === target.id)?.ownerPlayerId).toBe(playerIdFor(alice))
    expect(getFleetAt(required(views[0]), playerIdFor(alice), target.id, 15).id).toBe(stagedAlice.id)
    expect(getFleetAt(required(views[0]), playerIdFor(bob), target.id, 35).id).toBe(bobJourney.id)
    expect(required(views[0]).resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 470, uncommitted: 470 })
    expect(required(views[0]).resources[ResourceType.FUEL]).toStrictEqual({ total: 95, uncommitted: 95 })
    expect(required(views[1]).resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 473, uncommitted: 473 })
    expect(required(views[1]).resources[ResourceType.FUEL]).toStrictEqual({ total: 100, uncommitted: 100 })
    expect(views.map(({ resources }) => resources[ResourceType.COLONY].total)).toStrictEqual([0, 0])
    expect(required(views[1]).actions.find(({ id }) => id === bobColonizeId)).toMatchObject({ selectedTargets: null, isInProgress: false })
    const savedTurns = await server.database
      .select()
      .from(turnsTable)
      .where(eq(turnsTable.gameId, typedParse(GameIdSchema, gameId)))
    const savedNextTurn = savedTurns.find(({ turn }) => turn === workerInput.turn + 1)
    Assert.isDefined(savedNextTurn)
    const persistedNextRngState = { generatorState: savedNextTurn.rngGeneratorState, spareNormal: savedNextTurn.rngSpareNormal }
    expect(persistedNextRngState).toStrictEqual(replay.nextRngState)

    logReceipt("[C3-06 public claimed-in-transit Colonize receipt]", {
      gameId,
      seed: 1,
      homes: [homeA, homeB].map(({ id, name, coordinates }) => ({ id, name, coordinates })),
      target: { id: target.id, name: target.name, coordinates: target.coordinates },
      routes: { aliceDistance: 1.2645395167985714, bobDistance: 18.852953053708077, bobSpeed: 5 },
      ownerWhileTransit: playerIdFor(alice),
      transitDistances,
      finalArrivalTurn: workerInput.turn,
      finalFleet: replay.resolved.value.fleets[bobJourney.id],
      continuationOutcomes: bobContinuation.actionOutcomes,
      persistedOwner: getPlanets(required(views[0])).find(({ id }) => id === target.id)?.ownerPlayerId,
      persistedFleets: views.flatMap(({ fleets }) => fleets),
      persistedResources: views.map(({ resources }) => ({
        influence: resources[ResourceType.INFLUENCE].total,
        fuel: resources[ResourceType.FUEL].total,
        colony: resources[ResourceType.COLONY].total,
      })),
      loadedRngState: workerInput.rngState,
      replayNextRngState: replay.nextRngState,
      persistedNextRngState,
    })
  })

  it("should persist an ordinary public Move35 beside enemy10 without combat or claiming", async () => {
    // Arrange the seeded public game and Build submissions.
    await using server = await ConcurrencyTestApiServer.create()
    const fixture = await createPublicTwoPlayerFixture(server)
    const { alice, bob, clients, gameId, clock, turnProcessor, turnsRepository, homeA, homeB, target } = fixture
    let views = fixture.views

    const aliceBuildId = await submitAction({
      client: alice.client,
      gameId,
      view: required(views[0]),
      actionDefinitionId: BuildFleet35.id,
      selectedTargets: { planet: homeA.id },
      selectedInputs: {},
    })
    const bobBuildId = await submitAction({
      client: bob.client,
      gameId,
      view: required(views[1]),
      actionDefinitionId: BuildFleet10ForStaging.id,
      selectedTargets: { planet: homeB.id },
      selectedInputs: {},
    })
    // Act: process the public Build submissions.
    let stage = await processTurnWithReplay({
      server,
      clock,
      turnsRepository,
      turnProcessor,
      clients,
      gameId,
      turn: required(views[0]).turn,
    })
    views = stage.views
    // Assert both public Builds created the expected forces.
    const aliceSource = getFleetAt(required(views[0]), required(views[0]).player.id, homeA.id, 35)
    const bobSource = getFleetAt(required(views[1]), required(views[1]).player.id, homeB.id, 10)
    expect(required(views[0]).actions.find(({ id }) => id === aliceBuildId)).toMatchObject({ selectedTargets: null, isInProgress: false })
    expect(required(views[1]).actions.find(({ id }) => id === bobBuildId)).toMatchObject({ selectedTargets: null, isInProgress: false })

    // Act: submit Bob ordinary Move.
    const bobMoveId = await submitAction({
      client: bob.client,
      gameId,
      view: required(views[1]),
      actionDefinitionId: MoveFleetSpeed10.id,
      selectedTargets: { fleet: bobSource.id, planet: target.id },
      selectedInputs: { strength: 10 },
    })
    // Act: process Bob Move departure Turn.
    stage = await processTurnWithReplay({
      server,
      clock,
      turnsRepository,
      turnProcessor,
      clients,
      gameId,
      turn: required(views[0]).turn,
    })
    views = stage.views
    // Assert Bob captured journey follows the pinned route while the target stays unclaimed.
    const bobJourney = required(views[1]).fleets.find(({ movement }) => movement?.submission.id === bobMoveId)
    Assert.isDefined(bobJourney)
    expect(bobJourney.distanceToEnd).toBeCloseTo(8.852953053708077, 12)
    expect(getPlanets(required(views[0])).find(({ id }) => id === target.id)?.ownerPlayerId).toBeNull()

    // Act: process Bob arrival Turn.
    stage = await processTurnWithReplay({
      server,
      clock,
      turnsRepository,
      turnProcessor,
      clients,
      gameId,
      turn: required(views[0]).turn,
    })
    views = stage.views
    // Assert Bob arrived at strength10 while the target remains unclaimed.
    const persistedEnemy = getFleetAt(required(views[1]), required(views[1]).player.id, target.id, 10)
    expect(persistedEnemy.id).toBe(bobJourney.id)
    const bobReplayArrivalTick = stage.resolved.fleets[bobJourney.id]?.arrivedAtTick
    expect(getPlanets(required(views[0])).find(({ id }) => id === target.id)?.ownerPlayerId).toBeNull()
    expect(getFleetAt(required(views[0]), required(views[0]).player.id, homeA.id, 35).id).toBe(aliceSource.id)

    // Act: submit Alice ordinary Move35.
    const aliceMoveId = await submitAction({
      client: alice.client,
      gameId,
      view: required(views[0]),
      actionDefinitionId: MoveFleetSpeed10.id,
      selectedTargets: { fleet: aliceSource.id, planet: target.id },
      selectedInputs: { strength: 35 },
    })
    expect(MoveFleetSpeed10.effects.map(({ type }) => type)).toStrictEqual(["FLEET_MOVE"])
    // Act: resolve Alice captured Move input through the real processor.
    const ordinaryArrival = await processTurnWithReplay({
      server,
      clock,
      turnsRepository,
      turnProcessor,
      clients,
      gameId,
      turn: required(views[0]).turn,
    })
    views = ordinaryArrival.views
    // Assert copied-input replay separately from the persisted player-view read-through.
    const replayMoveFleet = findPublicFleet(Object.values(ordinaryArrival.resolved.fleets), {
      ownerPlayerId: playerIdFor(alice),
      originPlanetId: target.id,
      strength: 35,
    })
    Assert.isDefined(replayMoveFleet)
    expect(replayMoveFleet.arrivedAtTick).toBe(3)
    const persistedMoveFleet = getFleetAt(required(views[0]), required(views[0]).player.id, target.id, 35)
    expect(persistedMoveFleet.id).toBe(replayMoveFleet.id)

    expect(getFleetAt(required(views[1]), required(views[1]).player.id, target.id, 10).id).toBe(bobJourney.id)
    expect(getPlanets(required(views[0])).find(({ id }) => id === target.id)?.ownerPlayerId).toBeNull()
    expect(required(views[0]).actions.find(({ id }) => id === aliceMoveId)).toMatchObject({
      selectedTargets: null,
      isInProgress: false,
    })
    const aliceMoveOutcomes = ordinaryArrival.resolved.resolvedActions.find(
      ({ submittedAction }) => submittedAction.id === aliceMoveId,
    )?.actionOutcomes
    expect(aliceMoveOutcomes?.every(({ type }) => type === "RESOLVED")).toBe(true)

    logReceipt("[C3-11 public ordinary Move35/enemy10 control receipt]", {
      gameId,
      mapSeed: 1,
      homes: [
        { player: playerIdFor(alice), id: homeA.id, name: homeA.name, coordinates: homeA.coordinates },
        { player: playerIdFor(bob), id: homeB.id, name: homeB.name, coordinates: homeB.coordinates },
      ],
      target: { id: target.id, name: target.name, coordinates: target.coordinates },
      routes: {
        bobDistance: 18.852953053708077,
        aliceDistance: 1.2645395167985714,
        bobSpeed: 10,
        aliceSpeed: 10,
      },
      publicActions: {
        bobBuild10: bobBuildId,
        bobOrdinaryMove10: bobMoveId,
        aliceBuild35: aliceBuildId,
        aliceOrdinaryMove35: aliceMoveId,
      },
      copiedInputReplay: {
        bobArrivalTick: bobReplayArrivalTick,
        aliceArrivalTick: replayMoveFleet.arrivedAtTick,
        aliceActionOutcomes: ordinaryArrival.resolved.resolvedActions.find(({ submittedAction }) => submittedAction.id === aliceMoveId)
          ?.actionOutcomes,
      },
      persistedApiReadThrough: {
        planetOwner: getPlanets(required(views[0])).find(({ id }) => id === target.id)?.ownerPlayerId,
        fleets: [persistedMoveFleet, persistedEnemy].map(({ id, ownerPlayerId, originPlanetId, strength }) => ({
          id,
          ownerPlayerId,
          originPlanetId,
          strength,
        })),
      },
    })
  })

  it("should colonize an unclaimed Planet with an enemy Fleet present and no Assault", async () => {
    await using server = await ConcurrencyTestApiServer.create()
    const fixture = await createPublicTwoPlayerFixture(server)
    const { alice, bob, clients, gameId, clock, turnProcessor, turnsRepository, homeA, homeB, target } = fixture
    let views = fixture.views
    const aliceBuildId = await submitAction({
      client: alice.client,
      gameId,
      view: required(views[0]),
      actionDefinitionId: BuildFleet35.id,
      selectedTargets: { planet: homeA.id },
      selectedInputs: {},
    })
    const bobBuildId = await submitAction({
      client: bob.client,
      gameId,
      view: required(views[1]),
      actionDefinitionId: BuildFleet35.id,
      selectedTargets: { planet: homeB.id },
      selectedInputs: {},
    })
    const built = await processTurnWithReplay({
      server,
      clock,
      turnsRepository,
      turnProcessor,
      clients,
      gameId,
      turn: required(views[0]).turn,
    })
    views = built.views
    const aliceSource = getFleetAt(required(views[0]), required(views[0]).player.id, homeA.id, 35)
    const bobSource = getFleetAt(required(views[1]), required(views[1]).player.id, homeB.id, 35)
    expect(required(views[0]).actions.find(({ id }) => id === aliceBuildId)).toMatchObject({ selectedTargets: null, isInProgress: false })
    expect(required(views[1]).actions.find(({ id }) => id === bobBuildId)).toMatchObject({ selectedTargets: null, isInProgress: false })

    const slowColonizeId = await submitAction({
      client: alice.client,
      gameId,
      view: required(views[0]),
      actionDefinitionId: ColonizeFleetSpeed01.id,
      selectedTargets: { fleet: aliceSource.id, planet: target.id },
      selectedInputs: { strength: 35 },
    })
    const enemyMoveId = await submitAction({
      client: bob.client,
      gameId,
      view: required(views[1]),
      actionDefinitionId: MoveFleetSpeed10.id,
      selectedTargets: { fleet: bobSource.id, planet: target.id },
      selectedInputs: { strength: 10 },
    })
    expect(Math.hypot(homeA.x - target.x, homeA.y - target.y)).toBeCloseTo(1.2645395167985714, 12)
    expect(Math.hypot(homeB.x - target.x, homeB.y - target.y)).toBeCloseTo(18.852953053708077, 12)

    const departed = await processTurnWithReplay({
      server,
      clock,
      turnsRepository,
      turnProcessor,
      clients,
      gameId,
      turn: required(views[0]).turn,
    })
    views = departed.views
    const aliceJourney = required(views[0]).fleets.find(({ movement }) => movement?.submission.id === slowColonizeId)
    const bobJourney = required(views[1]).fleets.find(({ movement }) => movement?.submission.id === enemyMoveId)
    Assert.isDefined(aliceJourney)
    Assert.isDefined(bobJourney)
    expect(aliceJourney.strength).toBe(35)
    expect(aliceJourney.distanceToEnd).toBeCloseTo(Number("1.1645395167985714"), 12)
    expect(bobJourney.strength).toBe(10)
    expect(bobJourney.distanceToEnd).toBeCloseTo(8.852953053708077, 12)
    expect(getPlanets(required(views[0])).find(({ id }) => id === target.id)?.ownerPlayerId).toBeNull()

    const enemyArrival = await processTurnWithReplay({
      server,
      clock,
      turnsRepository,
      turnProcessor,
      clients,
      gameId,
      turn: required(views[0]).turn,
    })
    views = enemyArrival.views
    expect(getPlanets(required(views[0])).find(({ id }) => id === target.id)?.ownerPlayerId).toBeNull()
    expect(getFleetAt(required(views[1]), required(views[1]).player.id, target.id, 10)).toMatchObject({
      ownerPlayerId: required(views[1]).player.id,
      strength: 10,
    })
    const stillMovingColonizer = required(views[0]).fleets.find(({ movement }) => movement?.submission.id === slowColonizeId)
    Assert.isDefined(stillMovingColonizer)
    expect(stillMovingColonizer.distanceToEnd).toBeCloseTo(1.0645395167985714, 12)
    expect(required(views[0]).actions.find(({ id }) => id === slowColonizeId)?.isInProgress).toBe(true)

    for (let turn = 0; turn < 10; turn += 1) {
      const continued = await processTurnWithReplay({
        server,
        clock,
        turnsRepository,
        turnProcessor,
        clients,
        gameId,
        turn: required(views[0]).turn,
      })
      views = continued.views
      expect(getPlanets(required(views[0])).find(({ id }) => id === target.id)?.ownerPlayerId).toBeNull()
      expect(getFleetAt(required(views[1]), required(views[1]).player.id, target.id, 10).strength).toBe(10)
      expect(required(views[0]).actions.find(({ id }) => id === slowColonizeId)?.isInProgress).toBe(true)
    }
    const beforeFinalArrival = required(views[0]).fleets.find(({ movement }) => movement?.submission.id === slowColonizeId)
    Assert.isDefined(beforeFinalArrival)
    expect(beforeFinalArrival.distanceToEnd).toBeCloseTo(0.0645395167985714, 12)

    const finalArrival = await processTurnWithReplay({
      server,
      clock,
      turnsRepository,
      turnProcessor,
      clients,
      gameId,
      turn: required(views[0]).turn,
    })
    views = finalArrival.views
    const claimed = getPlanets(required(views[0])).find(({ id }) => id === target.id)
    Assert.isDefined(claimed)
    expect(claimed.ownerPlayerId).toBe(required(views[0]).player.id)
    expect(getFleetAt(required(views[0]), required(views[0]).player.id, target.id, 15)).toBeDefined()
    expect(getFleetAt(required(views[1]), required(views[1]).player.id, target.id, 10)).toBeDefined()
    expect(getFleetAt(required(views[1]), required(views[1]).player.id, homeB.id, 25)).toBeDefined()
    expect(required(views[0]).actions.find(({ id }) => id === slowColonizeId)).toMatchObject({ selectedTargets: null, isInProgress: false })
    expect(required(views[1]).actions.find(({ id }) => id === enemyMoveId)).toMatchObject({ selectedTargets: null, isInProgress: false })
    expect(required(views[0]).resources[ResourceType.INFLUENCE].total).toBe(473)
    expect(required(views[1]).resources[ResourceType.INFLUENCE].total).toBe(495)
    expect(required(views[0]).resources[ResourceType.COLONY].total).toBe(0)
    expect(required(views[1]).resources[ResourceType.COLONY].total).toBe(0)
    const colonizeContinuation = finalArrival.resolved.resolvedContinuations.find(
      ({ originatingSubmission }) => originatingSubmission.id === slowColonizeId,
    )
    Assert.isDefined(colonizeContinuation)
    expect(colonizeContinuation.actionOutcomes).toContainEqual(
      expect.objectContaining({ type: "RESOLVED", result: expect.stringContaining(' colonized Planet "planet 649967" with 20 Strength') }),
    )
    logReceipt("[C3-11 public enemy-presence receipt]", {
      seed: 1,
      target: { id: target.id, name: target.name, coordinates: target.coordinates },
      arrivalDistance: {
        alice: Math.hypot(homeA.x - target.x, homeA.y - target.y),
        bob: Math.hypot(homeB.x - target.x, homeB.y - target.y),
      },
      enemyArrivalBeforeClaim: { owner: required(views[1]).player.id, strength: 10 },
      finalOwner: claimed.ownerPlayerId,
      colonizerSurvivor: 15,
      enemySurvivor: 10,
      colonizerInfluence: required(views[0]).resources[ResourceType.INFLUENCE].total,
      enemyInfluence: required(views[1]).resources[ResourceType.INFLUENCE].total,
    })
  })

  it("should preserve the public natural-route cost and locked intent across reloads", async () => {
    await using server = await ConcurrencyTestApiServer.create()
    const fixture = await createPublicNaturalRouteFixture(server, "00000000-0000-4000-8000-000000000031")
    const { player, gameId, clock, turnProcessor, turnsRepository, home, target } = fixture
    const { view: builtView, fleet: sourceFleet } = await publiclyBuildFleetToFifty(fixture)

    const colonizeActionId = await submitAction({
      client: player.client,
      gameId,
      view: builtView,
      actionDefinitionId: ColonizePlanetTest.id,
      selectedTargets: { fleet: sourceFleet.id, planet: target.id },
      selectedInputs: { strength: 35 },
    })
    const selectedView = await player.client.gameplay.getPlayerView.query({ gameId })
    expect(selectedView.actions.find(({ id }) => id === colonizeActionId)).toMatchObject({
      selectedTargets: { fleet: sourceFleet.id, planet: target.id },
      selectedInputs: { strength: 35 },
      isInProgress: false,
    })
    expect(selectedView.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 50, uncommitted: 25 })
    expect(selectedView.resources[ResourceType.FUEL]).toStrictEqual({ total: 10, uncommitted: 10 })

    const departedView = await processTurn({
      clock,
      turnsRepository,
      turnProcessor,
      client: player.client,
      gameId,
      turn: selectedView.turn,
    })
    const journey = departedView.fleets.find(({ movement }) => movement?.submission.id === colonizeActionId)
    const sourceRemainder = findPublicFleet(departedView.fleets, { fleetId: sourceFleet.id, stationary: true })
    Assert.isDefined(journey)
    Assert.isDefined(sourceRemainder)
    expect(journey).toMatchObject({
      strength: 35,
      originPlanetId: home.id,
      destinationPlanetId: target.id,
      distanceToEnd: expect.closeTo(0.1456435045942517, 12),
      movement: {
        speed: 1,
        departureTurn: selectedView.turn,
        submission: {
          id: colonizeActionId,
          actionDefinitionId: ColonizePlanetTest.id,
          selectedTargets: { fleet: sourceFleet.id, planet: target.id },
          selectedInputs: { strength: 35 },
        },
        pendingArrivalEffects: [
          {
            definitionOrdinal: 2,
            effectDefinition: {
              type: "FLEET_COLONIZE",
              targets: {
                fleet: { actionTargetTag: "fleet" },
                planet: { actionTargetTag: "planet" },
              },
              parameters: { strengthRequirement: 20 },
            },
          },
        ],
      },
    })
    expect(sourceRemainder).toMatchObject({ id: sourceFleet.id, name: sourceFleet.name, strength: 15, originPlanetId: home.id })
    expect(getPlanets(departedView).find(({ id }) => id === target.id)?.ownerPlayerId).toBeNull()
    expect(departedView.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 25, uncommitted: 25 })
    expect(departedView.resources[ResourceType.FUEL]).toStrictEqual({ total: 10, uncommitted: 10 })
    expect(departedView.actions.find(({ id }) => id === colonizeActionId)?.isInProgress).toBe(true)

    await expect(
      player.client.gameplay.updateActionSubmission.mutate({
        gameId,
        turn: departedView.turn,
        submittedActionTargets: {
          actionId: colonizeActionId,
          selectedTargets: { fleet: journey.id, planet: target.id },
          selectedInputs: { strength: 34 },
        },
      }),
    ).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } })
    await expect(
      player.client.gameplay.updateActionSubmission.mutate({
        gameId,
        turn: departedView.turn,
        submittedActionTargets: { actionId: colonizeActionId, selectedTargets: null, selectedInputs: null },
      }),
    ).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } })
    expect(await player.client.gameplay.getPlayerView.query({ gameId })).toStrictEqual(departedView)

    const arrivalInput = await captureWorkerInput({
      server,
      clock,
      turnsRepository,
      gameId,
      turn: departedView.turn,
    })
    const arrivalReplay = replayWorkerInput(arrivalInput)
    Assert.isSuccess(arrivalReplay)
    const replayedArrival = arrivalReplay.value.fleets[journey.id]
    Assert.isDefined(replayedArrival)
    expect(replayedArrival.arrivedAtTick).toBe(3)

    const arrivedView = await processTurn({
      clock,
      turnsRepository,
      turnProcessor,
      client: player.client,
      gameId,
      turn: departedView.turn,
    })
    const claimedFleet = getFleetAt(arrivedView, arrivedView.player.id, target.id, 15)
    expect(getPlanets(arrivedView).find(({ id }) => id === target.id)?.ownerPlayerId).toBe(arrivedView.player.id)
    expect(claimedFleet.strength).toBe(15)
    expect(claimedFleet.movement).toBeUndefined()
    expect(getFleetAt(arrivedView, arrivedView.player.id, home.id, 15)).toMatchObject({ id: sourceFleet.id })
    expect(arrivedView.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 25, uncommitted: 25 })
    expect(arrivedView.resources[ResourceType.FUEL]).toStrictEqual({ total: 10, uncommitted: 10 })
    expect(arrivedView.resources[ResourceType.COLONY]).toStrictEqual({ total: 0, uncommitted: 0 })
    expect(arrivedView.actions.find(({ id }) => id === colonizeActionId)).toMatchObject({ selectedTargets: null, isInProgress: false })
    logReceipt("[C3-14 public natural route receipt]", {
      gameId,
      seed: 1234,
      player: arrivedView.player.id,
      home: { id: home.id, name: home.name, coordinates: home.coordinates, x: home.x, y: home.y },
      target: { id: target.id, name: target.name, coordinates: target.coordinates, x: target.x, y: target.y },
      routeDistance: 1.1456435045942517,
      buildSubmissions: 5,
      departure: { turn: selectedView.turn, selected: 35, sourceRemainder: 15, journeyForce: 35, remainingDistance: 0.1456435045942517 },
      arrival: { turn: arrivedView.turn, tick: 3, owner: arrivedView.player.id, targetForce: claimedFleet.strength },
      observedReplay: {
        source: "captured genuine worker input before real worker processing",
        inputTurn: arrivalInput.turn,
        arrivedAtTick: replayedArrival.arrivedAtTick,
      },
      resources: {
        influence: arrivedView.resources[ResourceType.INFLUENCE].total,
        fuel: arrivedView.resources[ResourceType.FUEL].total,
        colony: arrivedView.resources[ResourceType.COLONY].total,
      },
      pendingActionAfterDeparture: departedView.actions.find(({ id }) => id === colonizeActionId),
      releasedActionAfterArrival: arrivedView.actions.find(({ id }) => id === colonizeActionId),
    })

    const moveFixture = await createPublicNaturalRouteFixture(server, "00000000-0000-4000-8000-000000000032")
    const {
      player: movePlayer,
      gameId: moveGameId,
      clock: moveClock,
      turnProcessor: moveProcessor,
      turnsRepository: moveTurns,
      home: moveHome,
    } = moveFixture
    const { view: moveBuiltView, fleet: moveSource } = await publiclyBuildFleetToFifty(moveFixture)
    const moveColonizeId = await submitAction({
      client: movePlayer.client,
      gameId: moveGameId,
      view: moveBuiltView,
      actionDefinitionId: ColonizePlanetTest.id,
      selectedTargets: { fleet: moveSource.id, planet: moveFixture.target.id },
      selectedInputs: { strength: 35 },
    })
    const selectedMoveColonize = await movePlayer.client.gameplay.getPlayerView.query({ gameId: moveGameId })
    const moveColonizePending = await processTurn({
      clock: moveClock,
      turnsRepository: moveTurns,
      turnProcessor: moveProcessor,
      client: movePlayer.client,
      gameId: moveGameId,
      turn: selectedMoveColonize.turn,
    })
    const pendingJourney = moveColonizePending.fleets.find(({ movement }) => movement?.submission.id === moveColonizeId)
    Assert.isDefined(pendingJourney)
    const sourceWithFifteen = getFleetAt(moveColonizePending, moveColonizePending.player.id, moveHome.id, 15)
    const moveAction = moveColonizePending.actions.find(({ id }) => id === "TEST_MOVE_FLEET_STANDARD_2")
    Assert.isDefined(moveAction)
    expect(moveAction.actionDefinitionId).toBe(MoveFleetStandard.id)
    const moveDestination = getPlanets(moveColonizePending).find(({ coordinates }) => coordinates === "45:98:25")
    Assert.isDefined(moveDestination)
    const moveDistance = Math.hypot(moveDestination.x - moveHome.x, moveDestination.y - moveHome.y)
    expect({
      id: moveDestination.id,
      name: moveDestination.name,
      coordinates: moveDestination.coordinates,
      x: moveDestination.x,
      y: moveDestination.y,
    }).toStrictEqual({
      id: "3f56a5c2-d379-5b15-a6c5-1d5948724fea",
      name: "planet 499054",
      coordinates: "45:98:25",
      x: 58.43825730690875,
      y: 49.61937512280339,
    })
    expect(moveDistance).toBeCloseTo(0.0002590998724286934, 12)
    await movePlayer.client.gameplay.updateActionSubmission.mutate({
      gameId: moveGameId,
      turn: moveColonizePending.turn,
      submittedActionTargets: {
        actionId: moveAction.id,
        selectedTargets: { fleet: sourceWithFifteen.id, planet: moveDestination.id },
        selectedInputs: { strength: 5 },
      },
    })
    const simultaneousSelections = await movePlayer.client.gameplay.getPlayerView.query({ gameId: moveGameId })
    expect(simultaneousSelections.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 25, uncommitted: 22 })
    expect(simultaneousSelections.resources[ResourceType.FUEL]).toStrictEqual({ total: 10, uncommitted: 9 })
    expect(simultaneousSelections.fleets.find(({ id }) => id === sourceWithFifteen.id)?.strength).toBe(15)
    const moveInput = await captureWorkerInput({
      server,
      clock: moveClock,
      turnsRepository: moveTurns,
      gameId: moveGameId,
      turn: simultaneousSelections.turn,
    })
    const moveReplay = replayWorkerInput(moveInput)
    Assert.isSuccess(moveReplay)
    const replayedMovedFive = findPublicFleet(Object.values(moveReplay.value.fleets), {
      ownerPlayerId: simultaneousSelections.player.id,
      originPlanetId: moveDestination.id,
      strength: 5,
    })
    Assert.isDefined(replayedMovedFive)
    expect(replayedMovedFive.arrivedAtTick).toBe(1)
    const bothInProgress = await processTurn({
      clock: moveClock,
      turnsRepository: moveTurns,
      turnProcessor: moveProcessor,
      client: movePlayer.client,
      gameId: moveGameId,
      turn: simultaneousSelections.turn,
    })
    expect(getPlanets(bothInProgress).find(({ id }) => id === moveFixture.target.id)?.ownerPlayerId).toBe(bothInProgress.player.id)
    expect(getFleetAt(bothInProgress, bothInProgress.player.id, moveHome.id, 10)).toMatchObject({ id: moveSource.id })
    const movedFive = getFleetAt(bothInProgress, bothInProgress.player.id, moveDestination.id, 5)
    expect(movedFive.ownerPlayerId).toBe(bothInProgress.player.id)
    expect(movedFive.movement).toBeUndefined()
    expect(movedFive.id).toBe(replayedMovedFive.id)
    expect(bothInProgress.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 22, uncommitted: 22 })
    expect(bothInProgress.resources[ResourceType.FUEL]).toStrictEqual({ total: 9, uncommitted: 9 })
    expect(bothInProgress.actions.find(({ id }) => id === moveColonizeId)?.isInProgress).toBe(false)
    logReceipt("[C3-14 public reservation positive-control receipt]", {
      gameId: moveGameId,
      home: { id: moveHome.id, name: moveHome.name, coordinates: moveHome.coordinates, x: moveHome.x, y: moveHome.y },
      moveDestination: {
        id: moveDestination.id,
        name: moveDestination.name,
        coordinates: moveDestination.coordinates,
        x: moveDestination.x,
        y: moveDestination.y,
        distance: moveDistance,
      },
      initialSource: 15,
      ordinaryMove: {
        actionContent: "independent TestRuleset Move Fleet Standard",
        selected: 5,
        remainingSource: 10,
        configuredSpeed: 0.1,
      },
      moveArrivalReplay: { inputTurn: moveInput.turn, arrivedAtTick: replayedMovedFive.arrivedAtTick },
      colonizeInstanceRemainedLockedUntilResolution: true,
      resourcesAfterBothCosts: { influence: 22, fuel: 9 },
    })
  })

  it("should resolve the renamed Seed Outpost content using its public tags and exact costs", async () => {
    await using server = await ConcurrencyTestApiServer.create()
    const fixture = await createPublicNaturalRouteFixture(server, "00000000-0000-4000-8000-000000000033")
    const { player, gameId, clock, turnProcessor, turnsRepository, home, target } = fixture
    const { view: builtView, fleet: sourceFleet } = await publiclyBuildFleetToFifty(fixture)
    const seedOutpostAction = builtView.actions.find(({ actionDefinitionId }) => actionDefinitionId === SeedOutpost.id)
    Assert.isDefined(seedOutpostAction)
    const outOfRangeTarget = getPlanets(builtView).find(({ id }) => id === "72f899ea-98e3-5c0e-b896-f41c0b3bf6c5")
    Assert.isDefined(outOfRangeTarget)
    expect({
      id: outOfRangeTarget.id,
      name: outOfRangeTarget.name,
      coordinates: outOfRangeTarget.coordinates,
      x: outOfRangeTarget.x,
      y: outOfRangeTarget.y,
    }).toStrictEqual({
      id: "72f899ea-98e3-5c0e-b896-f41c0b3bf6c5",
      name: "planet 596186",
      coordinates: "54:18:10",
      x: 48.592171610357454,
      y: 51.996922937376276,
    })
    const outOfRangeDistance = Math.hypot(home.x - outOfRangeTarget.x, home.y - outOfRangeTarget.y)
    expect(outOfRangeDistance).toBeCloseTo(10.129282735155494, 12)
    expect(outOfRangeTarget.ownerPlayerId).toBeNull()
    const beforeOutOfRangeAttempt = await player.client.gameplay.getPlayerView.query({ gameId })
    await expect(
      player.client.gameplay.updateActionSubmission.mutate({
        gameId,
        turn: builtView.turn,
        submittedActionTargets: {
          actionId: seedOutpostAction.id,
          selectedTargets: { force: sourceFleet.id, site: outOfRangeTarget.id },
          selectedInputs: { quota: 30 },
        },
      }),
    ).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } })
    expect(await player.client.gameplay.getPlayerView.query({ gameId })).toStrictEqual(beforeOutOfRangeAttempt)
    const unchangedAfterQuotaFailure = await player.client.gameplay.getPlayerView.query({ gameId })
    await expect(
      player.client.gameplay.updateActionSubmission.mutate({
        gameId,
        turn: builtView.turn,
        submittedActionTargets: {
          actionId: seedOutpostAction.id,
          selectedTargets: { force: sourceFleet.id, site: target.id },
          selectedInputs: { quota: 29 },
        },
      }),
    ).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } })
    expect(await player.client.gameplay.getPlayerView.query({ gameId })).toStrictEqual(unchangedAfterQuotaFailure)

    await player.client.gameplay.updateActionSubmission.mutate({
      gameId,
      turn: builtView.turn,
      submittedActionTargets: {
        actionId: seedOutpostAction.id,
        selectedTargets: { force: sourceFleet.id, site: target.id },
        selectedInputs: { quota: 30 },
      },
    })
    const quotaThirtyView = await player.client.gameplay.getPlayerView.query({ gameId })
    expect(quotaThirtyView.actions.find(({ id }) => id === seedOutpostAction.id)).toMatchObject({
      actionDefinitionId: SeedOutpost.id,
      selectedTargets: { force: sourceFleet.id, site: target.id },
      selectedInputs: { quota: 30 },
    })
    expect(quotaThirtyView.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 50, uncommitted: 43 })
    expect(quotaThirtyView.resources[ResourceType.FUEL]).toStrictEqual({ total: 10, uncommitted: 8 })

    await player.client.gameplay.updateActionSubmission.mutate({
      gameId,
      turn: quotaThirtyView.turn,
      submittedActionTargets: {
        actionId: seedOutpostAction.id,
        selectedTargets: { force: sourceFleet.id, site: target.id },
        selectedInputs: { quota: 45 },
      },
    })
    const selectedView = await player.client.gameplay.getPlayerView.query({ gameId })
    expect(selectedView.actions.find(({ id }) => id === seedOutpostAction.id)).toMatchObject({
      actionDefinitionId: SeedOutpost.id,
      selectedTargets: { force: sourceFleet.id, site: target.id },
      selectedInputs: { quota: 45 },
    })
    expect(selectedView.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 50, uncommitted: 43 })
    expect(selectedView.resources[ResourceType.FUEL]).toStrictEqual({ total: 10, uncommitted: 8 })

    const actualWorkerInput = await captureWorkerInput({
      server,
      clock,
      turnsRepository,
      gameId,
      turn: selectedView.turn,
    })
    expect(actualWorkerInput.ruleset.actionDefinitions[SeedOutpost.id]).toMatchObject({
      id: "TEST_SEED_OUTPOST",
      name: "Seed Outpost",
      tier: "IMPROVED",
      inputs: { quota: { type: "POSITIVE_INTEGER" } },
      effects: [
        {
          type: "FLEET_MOVE",
          targets: { fleet: { actionTargetTag: "force" }, planet: { actionTargetTag: "site" } },
          inputs: { strength: { actionInputTag: "quota", inputType: "POSITIVE_INTEGER" } },
          parameters: { speed: 2 },
        },
        {
          type: "FLEET_COLONIZE",
          targets: { fleet: { actionTargetTag: "force" }, planet: { actionTargetTag: "site" } },
          parameters: { strengthRequirement: 30 },
        },
      ],
    })
    expect(actualWorkerInput.submittedActions.find(({ id }) => id === seedOutpostAction.id)).toMatchObject({
      selectedTargets: { force: sourceFleet.id, site: target.id },
      selectedInputs: { quota: 45 },
    })
    const alternateReplay = replayWorkerInput(actualWorkerInput)
    Assert.isSuccess(alternateReplay)
    const replayedSeedFleet = findPublicFleet(Object.values(alternateReplay.value.fleets), {
      ownerPlayerId: selectedView.player.id,
      originPlanetId: target.id,
      strength: 15,
    })
    Assert.isDefined(replayedSeedFleet)
    expect(replayedSeedFleet.arrivedAtTick).toBe(12)

    const resolvedView = await processTurn({
      clock,
      turnsRepository,
      turnProcessor,
      client: player.client,
      gameId,
      turn: selectedView.turn,
    })
    const claimedFleet = getFleetAt(resolvedView, resolvedView.player.id, target.id, 15)
    expect(getPlanets(resolvedView).find(({ id }) => id === target.id)?.ownerPlayerId).toBe(resolvedView.player.id)
    expect(claimedFleet.strength).toBe(15)
    expect(claimedFleet.movement).toBeUndefined()
    expect(getFleetAt(resolvedView, resolvedView.player.id, home.id, 5)).toMatchObject({ id: sourceFleet.id })
    expect(resolvedView.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 43, uncommitted: 43 })
    expect(resolvedView.resources[ResourceType.FUEL]).toStrictEqual({ total: 8, uncommitted: 8 })
    expect(resolvedView.resources[ResourceType.COLONY]).toStrictEqual({ total: 0, uncommitted: 0 })
    expect(resolvedView.actions.find(({ id }) => id === seedOutpostAction.id)).toMatchObject({
      actionDefinitionId: SeedOutpost.id,
      selectedTargets: null,
      isInProgress: false,
    })
    logReceipt("[C3-20 public alternate natural-route receipt]", {
      gameId,
      seed: 1234,
      player: resolvedView.player.id,
      home: { id: home.id, name: home.name, coordinates: home.coordinates, x: home.x, y: home.y },
      target: { id: target.id, name: target.name, coordinates: target.coordinates, x: target.x, y: target.y },
      routeDistance: 1.1456435045942517,
      definition: {
        id: SeedOutpost.id,
        name: SeedOutpost.name,
        tier: SeedOutpost.tier,
        tags: { fleet: "force", planet: "site", input: "quota" },
      },
      apiBoundary: { rejectedQuota: 29, acceptedQuota: 30, finalSelectedForce: 45 },
      arrival: { tick: 12, selectedForce: 45, targetForce: claimedFleet.strength, homeRemainder: 5 },
      observedReplay: {
        source: "captured genuine worker input before real worker processing",
        inputTurn: actualWorkerInput.turn,
        arrivedAtTick: replayedSeedFleet.arrivedAtTick,
      },
      payment: { influence: 7, fuel: 2, remaining: { influence: 43, fuel: 8 } },
      loadedActionDefinition: actualWorkerInput.ruleset.actionDefinitions[SeedOutpost.id],
      loadedSubmission: actualWorkerInput.submittedActions.find(({ id }) => id === seedOutpostAction.id),
    })
  })

  it("should claim a stationary public Seed Outpost with exactly30 Strength after worker arrival", async () => {
    await using server = await ConcurrencyTestApiServer.create()
    const rulesetsRepository = new RulesetsRepository({ db: server.database, logger: Logger.get() })
    Assert.isSuccess(await rulesetsRepository.upsertRuleset(PublicStationarySeedOutpostRuleset))
    const player = await server.createClient({ authenticated: true, id: "00000000-0000-4000-8000-000000000045" })
    const { createdGameId: gameId } = await player.client.games.create.mutate({
      configuration: createGameConfigurationStub({
        rulesetId: PublicStationarySeedOutpostRuleset.id,
        nbSeats: 1,
        turnIntervalSeconds: Time.in(MANUAL_TURN_INTERVAL, UnitOfTime.SECONDS),
        mapGenerationSeed: 1234,
      }),
    })
    await player.client.games.startGame.mutate({ gameId })
    const clock = new ControlledClock({ startDate: new Date() })
    const { turnProcessor, turnsRepository } = await createTurnProcessorStub({ db: server.database, clock })
    let view = await player.client.gameplay.getPlayerView.query({ gameId })
    const home = getHome(view)
    const target = getPlanets(view).find(({ id }) => id === "a34e5eae-656c-5330-ac90-9f9a7e0afa5d")
    Assert.isDefined(target)
    expect({ id: home.id, name: home.name, coordinates: home.coordinates, x: home.x, y: home.y }).toStrictEqual({
      id: "78821e36-f066-5df0-adbd-19785571d245",
      name: "planet 278494",
      coordinates: "45:98:30",
      x: 58.43842436611536,
      y: 49.61917707239218,
    })
    expect({ id: target.id, name: target.name, coordinates: target.coordinates, x: target.x, y: target.y }).toStrictEqual({
      id: "a34e5eae-656c-5330-ac90-9f9a7e0afa5d",
      name: "planet 684163",
      coordinates: "55:07:50",
      x: 57.77998524757335,
      y: 50.556704120958045,
    })
    const routeDistance = Math.hypot(home.x - target.x, home.y - target.y)
    expect(routeDistance).toBeCloseTo(1.1456435045942517, 12)
    expect(target.ownerPlayerId).toBeNull()
    expect(view.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 100, uncommitted: 100 })
    expect(view.resources[ResourceType.FUEL]).toStrictEqual({ total: 10, uncommitted: 10 })

    const buildAction = view.actions.find(({ actionDefinitionId }) => actionDefinitionId === PublicBudgetBuild30.id)
    Assert.isDefined(buildAction)
    await player.client.gameplay.updateActionSubmission.mutate({
      gameId,
      turn: view.turn,
      submittedActionTargets: {
        actionId: buildAction.id,
        selectedTargets: { planet: home.id },
        selectedInputs: {},
      },
    })
    view = await processTurn({ clock, turnsRepository, turnProcessor, client: player.client, gameId, turn: view.turn })
    const homeFleet = getFleetAt(view, view.player.id, home.id, 30)
    const stageAction = view.actions.find(({ actionDefinitionId }) => actionDefinitionId === PublicBudgetStageFleet.id)
    Assert.isDefined(stageAction)
    await player.client.gameplay.updateActionSubmission.mutate({
      gameId,
      turn: view.turn,
      submittedActionTargets: {
        actionId: stageAction.id,
        selectedTargets: { fleet: homeFleet.id, planet: target.id },
        selectedInputs: { strength: 30 },
      },
    })
    const staged = await processTurnWithReplay({
      server,
      clock,
      turnsRepository,
      turnProcessor,
      clients: [player],
      gameId,
      turn: view.turn,
    })
    view = required(staged.views[0])
    const arrival = Object.values(staged.resolved.fleets).find((fleet) =>
      matchesPublicFleet(fleet, { ownerPlayerId: view.player.id, originPlanetId: target.id, strength: 30 }),
    )
    Assert.isDefined(arrival)
    expect(arrival.arrivedAtTick).toBeDefined()
    const stationary = getFleetAt(view, view.player.id, target.id, 30)
    expect(stationary.id).toBe(arrival.id)
    expect(getPlanets(view).find(({ id }) => id === target.id)?.ownerPlayerId).toBeNull()

    const colonizeActionId = await submitAction({
      client: player.client,
      gameId,
      view,
      actionDefinitionId: SeedOutpostHere.id,
      selectedTargets: { force: stationary.id, site: target.id },
      selectedInputs: {},
    })
    const selectedView = await player.client.gameplay.getPlayerView.query({ gameId })
    expect(selectedView.actions.find(({ id }) => id === colonizeActionId)).toMatchObject({
      actionDefinitionId: SeedOutpostHere.id,
      selectedTargets: { force: stationary.id, site: target.id },
      selectedInputs: {},
    })
    expect(selectedView.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 100, uncommitted: 93 })
    expect(selectedView.resources[ResourceType.FUEL]).toStrictEqual({ total: 10, uncommitted: 8 })

    const workerInput = await captureWorkerInput({
      server,
      clock,
      turnsRepository,
      gameId,
      turn: selectedView.turn,
    })
    const replay = replayWorkerInputWithState(workerInput)
    Assert.isSuccess(replay.resolved)
    expect(findPlayerAction(workerInput.submittedActions, colonizeActionId, playerIdFor(player))).toMatchObject({
      actionDefinitionId: SeedOutpostHere.id,
      selectedTargets: { force: stationary.id, site: target.id },
      selectedInputs: {},
    })
    expect(workerInput.ruleset.actionDefinitions[SeedOutpostHere.id]).toMatchObject({
      id: "TEST_SEED_OUTPOST_HERE",
      name: "Seed Outpost Here",
      tier: "IMPROVED",
      targets: {
        force: { targetType: "FLEET" },
        site: { targetType: "PLANET" },
      },
      effects: [{ type: "FLEET_COLONIZE", parameters: { strengthRequirement: 30 } }],
    })
    expect(replay.resolved.value.removedFleetIds).toContain(stationary.id)
    expect(replay.resolved.value.fleets[stationary.id]).toBeUndefined()
    expect(replay.resolved.value.planets[target.id]?.ownerPlayerId).toBe(playerIdFor(player))
    expect(replay.resolved.value.planetOwnershipChanges).toStrictEqual([{ planetId: target.id, ownerPlayerId: playerIdFor(player) }])
    expect(replay.nextRngState).toStrictEqual(workerInput.rngState)

    expect(await turnProcessor.processNextDueTurn()).toBe("processed")
    view = await player.client.gameplay.getPlayerView.query({ gameId })
    expect(view.turn).toBe(selectedView.turn + 1)
    expect(getPlanets(view).find(({ id }) => id === target.id)?.ownerPlayerId).toBe(playerIdFor(player))
    expect(view.fleets.filter(({ originPlanetId }) => originPlanetId === target.id)).toHaveLength(0)
    expect(view.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 93, uncommitted: 93 })
    expect(view.resources[ResourceType.FUEL]).toStrictEqual({ total: 8, uncommitted: 8 })
    expect(view.resources[ResourceType.COLONY]).toStrictEqual({ total: 0, uncommitted: 0 })
    expect(view.actions.find(({ id }) => id === colonizeActionId)).toMatchObject({ selectedTargets: null, isInProgress: false })
    expect(
      await server.database
        .select()
        .from(fleetsTable)
        .where(eq(fleetsTable.gameId, typedParse(GameIdSchema, gameId))),
    ).not.toContainEqual(expect.objectContaining({ id: stationary.id }))
    const savedTurns = await server.database
      .select()
      .from(turnsTable)
      .where(eq(turnsTable.gameId, typedParse(GameIdSchema, gameId)))
    const savedNextTurn = savedTurns.find(({ turn: candidateTurn }) => candidateTurn === workerInput.turn + 1)
    Assert.isDefined(savedNextTurn)
    const persistedNextRngState = { generatorState: savedNextTurn.rngGeneratorState, spareNormal: savedNextTurn.rngSpareNormal }
    expect(persistedNextRngState).toStrictEqual(replay.nextRngState)

    logReceipt("[C3-20 public stationary Seed Outpost exact30 receipt]", {
      gameId,
      seed: 1234,
      home: { id: home.id, coordinates: home.coordinates, x: home.x, y: home.y },
      target: { id: target.id, coordinates: target.coordinates, x: target.x, y: target.y },
      routeDistance,
      publicSetup: { built: 30, moved: 30, actualArrivalTick: arrival.arrivedAtTick },
      loadedAction: workerInput.ruleset.actionDefinitions[SeedOutpostHere.id],
      result: {
        owner: playerIdFor(player),
        survivingTargetFleetRows: view.fleets.filter(({ originPlanetId }) => originPlanetId === target.id).length,
      },
      payment: { influence: 7, fuel: 2, remaining: { influence: 93, fuel: 8 } },
      rng: { preResolution: workerInput.rngState, replayNext: replay.nextRngState, persistedNext: persistedNextRngState },
    })
  })

  it("should let the later surviving public claimant succeed after a third-owner Assault weakens the earlier force", async () => {
    await using server = await ConcurrencyTestApiServer.create()
    const clock = new ControlledClock({ startDate: new Date() })
    const rulesetsRepository = new RulesetsRepository({ db: server.database, logger: Logger.get() })
    Assert.isSuccess(await rulesetsRepository.upsertRuleset(PublicColonizationFixtureRuleset))
    const alice = await server.createClient({ authenticated: true, id: "00000000-0000-4000-8000-000000000011" })
    const bob = await server.createClient({ authenticated: true, id: "00000000-0000-4000-8000-000000000012" })
    const carol = await server.createClient({ authenticated: true, id: "00000000-0000-4000-8000-000000000013" })
    const clients = [alice, bob, carol] as const

    const { createdGameId: gameId } = await alice.client.games.create.mutate({
      configuration: createGameConfigurationStub({
        rulesetId: PublicColonizationFixtureRuleset.id,
        nbSeats: 3,
        turnIntervalSeconds: Time.in(MANUAL_TURN_INTERVAL, UnitOfTime.SECONDS),
        mapGenerationSeed: 1,
      }),
    })
    await bob.client.games.join.mutate({ gameId })
    await carol.client.games.join.mutate({ gameId })
    await alice.client.games.startGame.mutate({ gameId })
    const { turnProcessor, turnsRepository } = await createTurnProcessorStub({ db: server.database, clock })

    let views = await readViews(clients, gameId)
    const homes = views.map(getHome)
    const homeIdsByPlayer = views.map(({ player }) => player.id)
    const target = getPlanets(required(views[0])).find(({ id }) => id === "838f0f2a-3fe5-5c47-bf22-ce0d74d8653b")
    Assert.isDefined(target)
    expect({ id: target.id, name: target.name, coordinates: target.coordinates, x: target.x, y: target.y }).toStrictEqual({
      id: "838f0f2a-3fe5-5c47-bf22-ce0d74d8653b",
      name: "planet 457985",
      coordinates: "54:59:10",
      x: 49.41298329646574,
      y: 55.182944416215065,
    })
    expect(homes.map(({ id, name, coordinates, x, y }) => ({ id, name, coordinates, x, y }))).toStrictEqual([
      {
        id: "2e5272ce-7a3a-545c-ab41-a924ca3bb5b5",
        name: "planet 624762",
        coordinates: "55:19:35",
        x: 59.252656901227056,
        y: 51.03193990849681,
      },
      {
        id: "7262a26b-70f2-5f0b-8996-55211b146f71",
        name: "planet 483980",
        coordinates: "54:86:30",
        x: 46.68780205926124,
        y: 58.26889186923308,
      },
      {
        id: "e38464f2-ed30-5425-929d-47b6f76cde94",
        name: "planet 811907",
        coordinates: "34:91:45",
        x: 41.62708888195861,
        y: 39.759154606188055,
      },
    ])
    const distances = homes.map((home) => Math.hypot(home.x - target.x, home.y - target.y))
    expect(distances[0]).toBeCloseTo(10.679420165502142, 12)
    expect(distances[1]).toBeCloseTo(4.116999448433268, 12)
    expect(distances[2]).toBeCloseTo(17.277541605730438, 12)
    expect(target.ownerPlayerId).toBeNull()

    const buildDefinitions = [BuildFleet35, BuildFleet70, BuildFleet48] as const
    for (let index = 0; index < clients.length; index += 1) {
      const client = clients[index]
      const view = views[index]
      const home = homes[index]
      const buildDefinition = buildDefinitions[index]
      Assert.isDefined(client)
      Assert.isDefined(view)
      Assert.isDefined(home)
      Assert.isDefined(buildDefinition)
      await submitAction({
        client: client.client,
        gameId,
        view,
        actionDefinitionId: buildDefinition.id,
        selectedTargets: { planet: home.id },
        selectedInputs: {},
      })
    }
    await processTurn({ clock, turnsRepository, turnProcessor, client: alice.client, gameId, turn: required(views[0]).turn })
    views = await readViews(clients, gameId)

    await submitAction({
      client: alice.client,
      gameId,
      view: required(views[0]),
      actionDefinitionId: MoveFleetExceptional.id,
      selectedTargets: {
        fleet: getFleetAt(required(views[0]), required(homeIdsByPlayer[0]), required(homes[0]).id, 35).id,
        planet: target.id,
      },
      selectedInputs: { strength: 35 },
    })
    await submitAction({
      client: carol.client,
      gameId,
      view: required(views[2]),
      actionDefinitionId: MoveFleetExceptional.id,
      selectedTargets: {
        fleet: getFleetAt(required(views[2]), required(homeIdsByPlayer[2]), required(homes[2]).id, 48).id,
        planet: target.id,
      },
      selectedInputs: { strength: 48 },
    })
    let stage = await processTurnWithReplay({
      server,
      clock,
      turnsRepository,
      turnProcessor,
      clients,
      gameId,
      turn: required(views[0]).turn,
    })
    views = stage.views
    const stagedAliceJourney = findPublicFleet(required(views[0]).fleets, {
      ownerPlayerId: required(homeIdsByPlayer[0]),
      destinationPlanetId: target.id,
    })
    const stagedCarolJourney = findPublicFleet(required(views[2]).fleets, {
      ownerPlayerId: required(homeIdsByPlayer[2]),
      destinationPlanetId: target.id,
    })
    Assert.isDefined(stagedAliceJourney)
    Assert.isDefined(stagedCarolJourney)
    const stagedAliceJourneyId = stagedAliceJourney.id
    const stagedCarolJourneyId = stagedCarolJourney.id
    expect(stagedAliceJourney.distanceToEnd).toBeCloseTo(5.679420165502142, 12)
    expect(stagedCarolJourney.distanceToEnd).toBeCloseTo(12.277541605730438, 12)
    const stagingResolutions = [stage.resolved]
    for (const expectedJourneyStates of [
      [
        { moving: true, originPlanetId: required(homes[0]).id, distanceToEnd: expect.closeTo(0.679420165502142, 12) },
        { moving: true, originPlanetId: required(homes[2]).id, distanceToEnd: expect.closeTo(7.277541605730438, 12) },
      ],
      [
        { moving: false, originPlanetId: target.id, distanceToEnd: undefined },
        { moving: true, originPlanetId: required(homes[2]).id, distanceToEnd: expect.closeTo(2.277541605730438, 12) },
      ],
      [
        { moving: false, originPlanetId: target.id, distanceToEnd: undefined },
        { moving: false, originPlanetId: target.id, distanceToEnd: undefined },
      ],
    ]) {
      stage = await processTurnWithReplay({ server, clock, turnsRepository, turnProcessor, clients, gameId, turn: required(views[0]).turn })
      views = stage.views
      stagingResolutions.push(stage.resolved)
      const aliceJourney = required(views[0]).fleets.find(({ id }) => id === stagedAliceJourneyId)
      const carolJourney = required(views[2]).fleets.find(({ id }) => id === stagedCarolJourneyId)
      Assert.isDefined(aliceJourney)
      Assert.isDefined(carolJourney)
      expect([
        {
          moving: aliceJourney.movement !== undefined,
          originPlanetId: aliceJourney.originPlanetId,
          distanceToEnd: aliceJourney.distanceToEnd,
        },
        {
          moving: carolJourney.movement !== undefined,
          originPlanetId: carolJourney.originPlanetId,
          distanceToEnd: carolJourney.distanceToEnd,
        },
      ]).toStrictEqual(expectedJourneyStates)
    }
    const aliceStagingArrival = stagingResolutions.find(({ fleets }) => fleets[stagedAliceJourneyId]?.arrivedAtTick !== undefined)
    const carolStagingArrival = stagingResolutions.find(({ fleets }) => fleets[stagedCarolJourneyId]?.arrivedAtTick !== undefined)
    Assert.isDefined(aliceStagingArrival)
    Assert.isDefined(carolStagingArrival)
    expect(aliceStagingArrival.fleets[stagedAliceJourneyId]?.arrivedAtTick).toBe(3)
    expect(carolStagingArrival.fleets[stagedCarolJourneyId]?.arrivedAtTick).toBe(10)
    const stagedAlice = getFleetAt(required(views[0]), required(homeIdsByPlayer[0]), target.id, 35)
    const stagedCarol = getFleetAt(required(views[2]), required(homeIdsByPlayer[2]), target.id, 48)
    expect(
      required(views[0])
        .galaxy.systems.flatMap(({ planets }) => planets)
        .find(({ id }) => id === target.id)?.ownerPlayerId,
    ).toBeNull()

    const bobColonizeActionId = await submitAction({
      client: bob.client,
      gameId,
      view: required(views[1]),
      actionDefinitionId: ColonizePlanetTest.id,
      selectedTargets: {
        fleet: getFleetAt(required(views[1]), required(homeIdsByPlayer[1]), required(homes[1]).id, 70).id,
        planet: target.id,
      },
      selectedInputs: { strength: 70 },
    })
    let bobDeparture = await processTurnWithReplay({
      server,
      clock,
      turnsRepository,
      turnProcessor,
      clients,
      gameId,
      turn: required(views[0]).turn,
    })
    views = bobDeparture.views
    const movingBob = required(views[1]).fleets.find((fleet) =>
      matchesPublicFleet(fleet, { ownerPlayerId: required(homeIdsByPlayer[1]), destinationPlanetId: target.id }),
    )
    Assert.isDefined(movingBob)
    const movingBobId = movingBob.id
    expect(movingBob.distanceToEnd).toBeCloseTo(3.116999448433268, 12)
    const bobContinuationDistances = [2.116999448433268, 1.116999448433268, 0.116999448433268]
    for (const expectedDistance of bobContinuationDistances) {
      bobDeparture = await processTurnWithReplay({
        server,
        clock,
        turnsRepository,
        turnProcessor,
        clients,
        gameId,
        turn: required(views[0]).turn,
      })
      views = bobDeparture.views
      const currentMovement = required(views[1]).fleets.find(({ id }) => id === movingBobId)
      Assert.isDefined(currentMovement)
      expect(currentMovement.movement).toBeDefined()
      expect(currentMovement.distanceToEnd).toBeCloseTo(expectedDistance, 12)
    }

    const readyViews = views
    const currentAlice = getFleetAt(required(readyViews[0]), required(homeIdsByPlayer[0]), target.id, 35)
    const currentCarol = getFleetAt(required(readyViews[2]), required(homeIdsByPlayer[2]), target.id, 48)
    const bobJourney = required(readyViews[1]).fleets.find(({ id }) => id === movingBobId)
    Assert.isDefined(bobJourney)
    expect(bobJourney.movement).toBeDefined()
    expect(bobJourney.distanceToEnd).toBeCloseTo(0.116999448433268, 12)
    const aliceColonizeActionId = await submitAction({
      client: alice.client,
      gameId,
      view: required(readyViews[0]),
      actionDefinitionId: ColonizeHereTest.id,
      selectedTargets: { fleet: currentAlice.id, planet: target.id },
      selectedInputs: {},
    })
    const carolAssaultActionId = await submitAction({
      client: carol.client,
      gameId,
      view: required(readyViews[2]),
      actionDefinitionId: StationaryAssaultTest.id,
      selectedTargets: { station: currentCarol.id, battlePlanet: target.id },
      selectedInputs: {},
    })

    const finalTurnInput = await captureWorkerInput({
      server,
      clock,
      turnsRepository,
      gameId,
      turn: required(readyViews[0]).turn,
    })
    const finalReplay = replayWorkerInputWithState(finalTurnInput)
    const publicReplay = finalReplay.resolved
    Assert.isSuccess(publicReplay)
    expect(finalReplay.nextRngState).toStrictEqual(finalTurnInput.rngState)
    expect(publicReplay.value.fleets[bobJourney.id]?.arrivedAtTick).toBe(3)
    expect(
      publicReplay.value.resolvedActions.find(({ submittedAction }) => submittedAction.id === aliceColonizeActionId)?.actionOutcomes,
    ).toContainEqual(expect.objectContaining({ type: "PREVENTED" }))
    expect(
      publicReplay.value.resolvedActions.find(({ submittedAction }) => submittedAction.id === carolAssaultActionId)?.actionOutcomes,
    ).toContainEqual(expect.objectContaining({ type: "RESOLVED" }))
    expect(
      publicReplay.value.resolvedContinuations
        .find(({ originatingSubmission }) => originatingSubmission.id === bobColonizeActionId)
        ?.actionOutcomes.at(-1)?.type,
    ).toBe("RESOLVED")
    const ownerByFleet = [stagedAlice.id, stagedCarol.id, bobJourney.id].map((fleetId) => {
      const fleet = publicReplay.value.fleets[fleetId]
      return { ownerPlayerId: fleet?.ownerPlayerId, strength: fleet?.strength }
    })
    expect(ownerByFleet).toContainEqual({ ownerPlayerId: homeIdsByPlayer[0], strength: 19 })
    expect(ownerByFleet).toContainEqual({ ownerPlayerId: homeIdsByPlayer[1], strength: 18 })
    expect(publicReplay.value.fleets[stagedCarol.id]).toBeUndefined()
    expect(publicReplay.value.planets[target.id]?.ownerPlayerId).toBe(homeIdsByPlayer[1])

    expect(await turnProcessor.processNextDueTurn()).toBe("processed")
    views = await readViews(clients, gameId)
    expect(getPlanets(required(views[0])).find(({ id }) => id === target.id)?.ownerPlayerId).toBe(homeIdsByPlayer[1])
    expect(getFleetAt(required(views[0]), required(homeIdsByPlayer[0]), target.id, 19)).toBeDefined()
    expect(getFleetAt(required(views[1]), required(homeIdsByPlayer[1]), target.id, 18)).toBeDefined()
    expect(required(views[2]).fleets.some(({ id }) => id === stagedCarol.id)).toBe(false)
    expect(views.map(({ resources }) => resources[ResourceType.COLONY].total)).toStrictEqual([0, 0, 0])
    expect(views.map(({ resources }) => resources[ResourceType.INFLUENCE].total)).toStrictEqual([470, 473, 495])
    expect(views.map(({ resources }) => resources[ResourceType.METAL].total)).toStrictEqual([99, 99, 99])
    expect(views.map(({ resources }) => resources[ResourceType.FUEL].total)).toStrictEqual([95, 100, 95])
    const savedTurns = await server.database
      .select()
      .from(turnsTable)
      .where(eq(turnsTable.gameId, typedParse(GameIdSchema, gameId)))
    const savedNextTurn = savedTurns.find(({ turn }) => turn === required(readyViews[0]).turn + 1)
    Assert.isDefined(savedNextTurn)
    const persistedNextRngState = { generatorState: savedNextTurn.rngGeneratorState, spareNormal: savedNextTurn.rngSpareNormal }
    expect(persistedNextRngState).toStrictEqual(finalTurnInput.rngState)
    logReceipt("[C3-08 public Assault receipt]", {
      gameId,
      seed: 1,
      target: { id: target.id, name: target.name, coordinates: target.coordinates, x: target.x, y: target.y },
      homes: homes.map(({ id, name, coordinates, x, y }) => ({ id, name, coordinates, x, y })),
      distances,
      stagedForces: [35, 70, 48],
      stagedArrivalTicks: { alice: 3, carol: 10 },
      bobJourneyDistanceBeforeFinalTurn: bobJourney.distanceToEnd,
      positiveTickArrival: publicReplay.value.fleets[bobJourney.id]?.arrivedAtTick,
      loadedRngState: finalTurnInput.rngState,
      replayNextRngState: finalReplay.nextRngState,
      persistedNextRngState,
      replaySurvivors: ownerByFleet,
      persistedOwner: getPlanets(required(views[0])).find(({ id }) => id === target.id)?.ownerPlayerId,
      persistedForces: views.map((view, index) => {
        const ownerPlayerId = required(homeIdsByPlayer[index])
        const fleet = findPublicFleet(view.fleets, { ownerPlayerId, originPlanetId: target.id, stationary: true })
        return { playerId: ownerPlayerId, strength: fleet?.strength }
      }),
    })
  })

  it("should publicly prevent a dead earlier claimant and let the arriving Assault colonize", async () => {
    await using server = await ConcurrencyTestApiServer.create()
    const rulesetsRepository = new RulesetsRepository({ db: server.database, logger: Logger.get() })
    Assert.isSuccess(await rulesetsRepository.upsertRuleset(PublicColonizationFixtureRuleset))
    const alice = await server.createClient({ authenticated: true, id: "00000000-0000-4000-8000-000000000031" })
    const bob = await server.createClient({ authenticated: true, id: "00000000-0000-4000-8000-000000000032" })
    const carol = await server.createClient({ authenticated: true, id: "00000000-0000-4000-8000-000000000033" })
    const clients = [alice, bob, carol] as const
    const { createdGameId: gameId } = await alice.client.games.create.mutate({
      configuration: createGameConfigurationStub({
        rulesetId: PublicColonizationFixtureRuleset.id,
        nbSeats: 3,
        turnIntervalSeconds: Time.in(MANUAL_TURN_INTERVAL, UnitOfTime.SECONDS),
        mapGenerationSeed: 1,
      }),
    })
    await bob.client.games.join.mutate({ gameId })
    await carol.client.games.join.mutate({ gameId })
    await alice.client.games.startGame.mutate({ gameId })
    const clock = new ControlledClock({ startDate: new Date() })
    const { turnProcessor, turnsRepository } = await createTurnProcessorStub({ db: server.database, clock })

    let views = await readViews(clients, gameId)
    const aliceHome = getHome(required(views[0]))
    const bobHome = getHome(required(views[1]))
    const target = getPlanets(required(views[0])).find(({ id }) => id === "838f0f2a-3fe5-5c47-bf22-ce0d74d8653b")
    Assert.isDefined(target)
    expect({ id: aliceHome.id, name: aliceHome.name, coordinates: aliceHome.coordinates }).toStrictEqual({
      id: "2e5272ce-7a3a-545c-ab41-a924ca3bb5b5",
      name: "planet 624762",
      coordinates: "55:19:35",
    })
    expect({ id: bobHome.id, name: bobHome.name, coordinates: bobHome.coordinates }).toStrictEqual({
      id: "7262a26b-70f2-5f0b-8996-55211b146f71",
      name: "planet 483980",
      coordinates: "54:86:30",
    })
    expect({ id: target.id, name: target.name, coordinates: target.coordinates }).toStrictEqual({
      id: "838f0f2a-3fe5-5c47-bf22-ce0d74d8653b",
      name: "planet 457985",
      coordinates: "54:59:10",
    })
    const aliceDistance = Math.hypot(aliceHome.x - target.x, aliceHome.y - target.y)
    const bobDistance = Math.hypot(bobHome.x - target.x, bobHome.y - target.y)
    expect(aliceDistance).toBeCloseTo(10.679420165502142, 12)
    expect(bobDistance).toBeCloseTo(4.116999448433268, 12)
    expect(target.ownerPlayerId).toBeNull()

    await submitAction({
      client: alice.client,
      gameId,
      view: required(views[0]),
      actionDefinitionId: BuildFleet35.id,
      selectedTargets: { planet: aliceHome.id },
      selectedInputs: {},
    })
    await submitAction({
      client: bob.client,
      gameId,
      view: required(views[1]),
      actionDefinitionId: BuildFleet70.id,
      selectedTargets: { planet: bobHome.id },
      selectedInputs: {},
    })
    let stage = await processTurnWithReplay({
      server,
      clock,
      turnsRepository,
      turnProcessor,
      clients,
      gameId,
      turn: required(views[0]).turn,
    })
    views = stage.views
    const aliceSource = getFleetAt(required(views[0]), required(views[0]).player.id, aliceHome.id, 35)
    const bobSource = getFleetAt(required(views[1]), required(views[1]).player.id, bobHome.id, 70)

    const aliceMoveActionId = await submitAction({
      client: alice.client,
      gameId,
      view: required(views[0]),
      actionDefinitionId: MoveFleetExceptional.id,
      selectedTargets: { fleet: aliceSource.id, planet: target.id },
      selectedInputs: { strength: 35 },
    })
    stage = await processTurnWithReplay({ server, clock, turnsRepository, turnProcessor, clients, gameId, turn: required(views[0]).turn })
    views = stage.views
    const aliceJourney = required(views[0]).fleets.find(({ movement }) => movement?.submission.id === aliceMoveActionId)
    Assert.isDefined(aliceJourney)
    expect(aliceJourney.distanceToEnd).toBeCloseTo(5.679420165502142, 12)
    stage = await processTurnWithReplay({ server, clock, turnsRepository, turnProcessor, clients, gameId, turn: required(views[0]).turn })
    views = stage.views
    expect(required(views[0]).fleets.find(({ id }) => id === aliceJourney.id)?.distanceToEnd).toBeCloseTo(0.679420165502142, 12)
    stage = await processTurnWithReplay({ server, clock, turnsRepository, turnProcessor, clients, gameId, turn: required(views[0]).turn })
    views = stage.views
    expect(stage.resolved.fleets[aliceJourney.id]?.arrivedAtTick).toBe(3)
    const stagedAlice = getFleetAt(required(views[0]), required(views[0]).player.id, target.id, 35)
    expect(bobSource.strength).toBe(70)

    const bobAttackColonizeActionId = await submitAction({
      client: bob.client,
      gameId,
      view: required(views[1]),
      actionDefinitionId: DeadEarlierAttackColonize.id,
      selectedTargets: { fleet: bobSource.id, planet: target.id },
      selectedInputs: { strength: 70 },
    })
    stage = await processTurnWithReplay({ server, clock, turnsRepository, turnProcessor, clients, gameId, turn: required(views[0]).turn })
    views = stage.views
    const bobJourney = required(views[1]).fleets.find(({ movement }) => movement?.submission.id === bobAttackColonizeActionId)
    Assert.isDefined(bobJourney)
    expect(bobJourney.distanceToEnd).toBeCloseTo(3.116999448433268, 12)
    for (const expectedDistance of [2.116999448433268, 1.116999448433268, 0.116999448433268]) {
      stage = await processTurnWithReplay({ server, clock, turnsRepository, turnProcessor, clients, gameId, turn: required(views[0]).turn })
      views = stage.views
      expect(required(views[1]).fleets.find(({ id }) => id === bobJourney.id)?.distanceToEnd).toBeCloseTo(expectedDistance, 12)
    }
    expect(required(views[0]).fleets.find(({ id }) => id === stagedAlice.id)?.strength).toBe(35)
    expect(required(views[1]).fleets.find(({ id }) => id === bobJourney.id)?.movement).toBeDefined()

    const aliceColonizeActionId = await submitAction({
      client: alice.client,
      gameId,
      view: required(views[0]),
      actionDefinitionId: ColonizeHereTest.id,
      selectedTargets: { fleet: stagedAlice.id, planet: target.id },
      selectedInputs: {},
    })
    const finalTurn = await alice.client.gameplay.getPlayerView.query({ gameId })
    expect(finalTurn.actions.find(({ id }) => id === aliceColonizeActionId)).toMatchObject({ isInProgress: false })
    expect(finalTurn.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 495, uncommitted: 470 })

    const finalWorkerInput = await captureWorkerInput({ server, clock, turnsRepository, gameId, turn: finalTurn.turn })
    const finalReplay = replayWorkerInputWithState(finalWorkerInput)
    Assert.isSuccess(finalReplay.resolved)
    expect(finalWorkerInput.planets[target.id]?.ownerPlayerId).toBeNull()
    expect(finalWorkerInput.fleets[stagedAlice.id]?.strength).toBe(35)
    expect(finalWorkerInput.fleets[bobJourney.id]?.strength).toBe(70)
    expect(finalWorkerInput.fleets[bobJourney.id]?.distanceToEnd).toBeCloseTo(0.116999448433268, 12)
    expect(finalReplay.resolved.value.fleets[stagedAlice.id]).toBeUndefined()
    expect(finalReplay.resolved.value.fleets[bobJourney.id]?.arrivedAtTick).toBe(3)
    expect(finalReplay.resolved.value.fleets[bobJourney.id]?.strength).toBe(15)
    expect(finalReplay.resolved.value.planets[target.id]?.ownerPlayerId).toBe(playerIdFor(bob))
    expect(
      finalReplay.resolved.value.resolvedActions.find(({ submittedAction }) => submittedAction.id === aliceColonizeActionId)
        ?.actionOutcomes,
    ).toContainEqual(expect.objectContaining({ type: "PREVENTED" }))
    const bobContinuation = finalReplay.resolved.value.resolvedContinuations.find(
      ({ originatingSubmission }) => originatingSubmission.id === bobAttackColonizeActionId,
    )
    Assert.isDefined(bobContinuation)
    expect(
      bobContinuation.actionOutcomes.map((outcome) => ({
        type: outcome.type,
        text: describeOutcome(outcome),
      })),
    ).toStrictEqual([
      expect.objectContaining({ type: "RESOLVED", text: expect.stringContaining("moved") }),
      expect.objectContaining({ type: "RESOLVED", text: expect.stringContaining("arrived on Planet") }),
      expect.objectContaining({ type: "RESOLVED", text: expect.stringContaining("exchanged 35 Strength with 35 enemy Strength") }),
      expect.objectContaining({ type: "RESOLVED", text: expect.stringContaining("colonized Planet") }),
    ])
    expect(finalReplay.nextRngState).toStrictEqual(finalWorkerInput.rngState)

    expect(await turnProcessor.processNextDueTurn()).toBe("processed")
    views = await readViews(clients, gameId)
    expect(getPlanets(required(views[0])).find(({ id }) => id === target.id)?.ownerPlayerId).toBe(playerIdFor(bob))
    expect(required(views[0]).fleets.some(({ id }) => id === stagedAlice.id)).toBe(false)
    expect(getFleetAt(required(views[1]), playerIdFor(bob), target.id, 15)).toBeDefined()
    expect(views.map(({ resources }) => resources[ResourceType.COLONY].total)).toStrictEqual([0, 0, 0])
    expect(required(views[0]).resources[ResourceType.INFLUENCE].total).toBe(470)
    expect(required(views[1]).resources[ResourceType.INFLUENCE].total).toBe(493)
    expect(required(views[0]).resources[ResourceType.FUEL].total).toBe(95)
    expect(required(views[1]).resources[ResourceType.FUEL].total).toBe(99)
    const savedTurns = await server.database
      .select()
      .from(turnsTable)
      .where(eq(turnsTable.gameId, typedParse(GameIdSchema, gameId)))
    const savedNextTurn = savedTurns.find(({ turn }) => turn === finalTurn.turn + 1)
    Assert.isDefined(savedNextTurn)
    const persistedNextRngState = { generatorState: savedNextTurn.rngGeneratorState, spareNormal: savedNextTurn.rngSpareNormal }
    expect(persistedNextRngState).toStrictEqual(finalReplay.nextRngState)

    logReceipt("[C3-08 public dead-earlier Assault receipt]", {
      gameId,
      seed: 1,
      target: { id: target.id, name: target.name, coordinates: target.coordinates },
      routes: { aliceDistance, bobDistance },
      aliceTickZeroFleet: { id: stagedAlice.id, forceBeforeAssault: 35, removedAfterAssault: true },
      bobJourney: { id: bobJourney.id, forceBeforeAssault: 70, actualArrivalTick: 3, finalClaimingForce: 15 },
      assaultOutcome: bobContinuation.actionOutcomes.find((outcome) => hasResolvedResult(outcome, "exchanged 35 Strength")),
      aliceColonizeOutcome: finalReplay.resolved.value.resolvedActions.find(
        ({ submittedAction }) => submittedAction.id === aliceColonizeActionId,
      )?.actionOutcomes,
      winner: playerIdFor(bob),
      preResolutionRngState: finalWorkerInput.rngState,
      persistedNextRngState,
      persistedResources: views.map(({ player, resources }) => ({
        playerId: player.id,
        influence: resources[ResourceType.INFLUENCE].total,
        fuel: resources[ResourceType.FUEL].total,
        colony: resources[ResourceType.COLONY].total,
      })),
    })
  })

  it("should preserve arrival provenance while public ordinary and colonization arrivals merge", async () => {
    await using server = await ConcurrencyTestApiServer.create()
    const fixture = await createPublicTwoPlayerFixture(server)
    const { alice, bob, clients, gameId, clock, turnProcessor, turnsRepository, homeA, homeB, target } = fixture
    let views = fixture.views
    expect(getPlanets(required(views[0])).find(({ id }) => id === target.id)?.ownerPlayerId).toBeNull()

    await submitAction({
      client: alice.client,
      gameId,
      view: required(views[0]),
      actionDefinitionId: BuildFleet10ForStaging.id,
      selectedTargets: { planet: homeA.id },
      selectedInputs: {},
    })
    await submitAction({
      client: bob.client,
      gameId,
      view: required(views[1]),
      actionDefinitionId: BuildFleet35.id,
      selectedTargets: { planet: homeB.id },
      selectedInputs: {},
    })
    await processTurn({ clock, turnsRepository, turnProcessor, client: alice.client, gameId, turn: required(views[0]).turn })
    views = await readViews(clients, gameId)
    const stagingFleet = getFleetAt(required(views[0]), required(views[0]).player.id, homeA.id, 10)
    const bobSourceFleet = getFleetAt(required(views[1]), required(views[1]).player.id, homeB.id, 35)

    const aliceStageActionId = await submitAction({
      client: alice.client,
      gameId,
      view: required(views[0]),
      actionDefinitionId: MoveFleetExceptional.id,
      selectedTargets: { fleet: stagingFleet.id, planet: target.id },
      selectedInputs: { strength: 10 },
    })
    await submitAction({
      client: alice.client,
      gameId,
      view: required(views[0]),
      actionDefinitionId: BuildFleet50.id,
      selectedTargets: { planet: homeA.id },
      selectedInputs: {},
    })
    const bobStageActionId = await submitAction({
      client: bob.client,
      gameId,
      view: required(views[1]),
      actionDefinitionId: MoveFleetExceptional.id,
      selectedTargets: { fleet: bobSourceFleet.id, planet: homeA.id },
      selectedInputs: { strength: 35 },
    })
    let stage = await processTurnWithReplay({
      server,
      clock,
      turnsRepository,
      turnProcessor,
      clients,
      gameId,
      turn: required(views[0]).turn,
    })
    views = stage.views
    const stagedFriendlyArrival = findPublicFleet(Object.values(stage.resolved.fleets), {
      ownerPlayerId: required(views[0]).player.id,
      originPlanetId: target.id,
      strength: 10,
    })
    Assert.isDefined(stagedFriendlyArrival)
    expect(stagedFriendlyArrival.arrivedAtTick).toBe(6)
    expect(stage.resolved.removedFleetIds).toContain(stagingFleet.id)
    const bobJourney = required(views[1]).fleets.find(({ movement }) => movement?.submission.id === bobStageActionId)
    Assert.isDefined(bobJourney)
    const bobJourneyId = bobJourney.id
    expect(bobJourney.distanceToEnd).toBeCloseTo(15.111265402761585, 12)
    const stagedFriendly = getFleetAt(required(views[0]), required(views[0]).player.id, target.id, 10)
    expect(stagedFriendly.id).toBe(stagedFriendlyArrival.id)

    const bobStagingDistances = [10.111265402761585, 5.111265402761585, 0.111265402761585]
    for (const expectedDistance of bobStagingDistances) {
      stage = await processTurnWithReplay({ server, clock, turnsRepository, turnProcessor, clients, gameId, turn: required(views[0]).turn })
      views = stage.views
      const currentJourney = required(views[1]).fleets.find(({ id }) => id === bobJourneyId)
      Assert.isDefined(currentJourney)
      expect(currentJourney.distanceToEnd).toBeCloseTo(expectedDistance, 12)
    }
    stage = await processTurnWithReplay({ server, clock, turnsRepository, turnProcessor, clients, gameId, turn: required(views[0]).turn })
    views = stage.views
    expect(stage.resolved.fleets[bobJourneyId]?.arrivedAtTick).toBe(1)
    const bobAtSource = getFleetAt(required(views[1]), required(views[1]).player.id, homeA.id, 35)
    expect(bobAtSource.id).toBe(bobJourneyId)

    const aliceSource = getFleetAt(required(views[0]), required(views[0]).player.id, homeA.id, 50)
    const stagedAtDestination = getFleetAt(required(views[0]), required(views[0]).player.id, target.id, 10)
    expect(stagedAtDestination.id).toBe(stagedFriendly.id)
    const ordinaryActionId = await submitAction({
      client: alice.client,
      gameId,
      view: required(views[0]),
      actionDefinitionId: MoveFleetSpeed10.id,
      selectedTargets: { fleet: aliceSource.id, planet: target.id },
      selectedInputs: { strength: 10 },
    })
    const aliceColonizeActionId = await submitAction({
      client: alice.client,
      gameId,
      view: required(views[0]),
      actionDefinitionId: ColonizeFleetSpeed2.id,
      selectedTargets: { fleet: aliceSource.id, planet: target.id },
      selectedInputs: { strength: 20 },
    })
    const bobColonizeActionId = await submitAction({
      client: bob.client,
      gameId,
      view: required(views[1]),
      actionDefinitionId: ColonizeFleetSpeed4.id,
      selectedTargets: { fleet: bobAtSource.id, planet: target.id },
      selectedInputs: { strength: 35 },
    })
    const selectedViews = await readViews(clients, gameId)
    expect(required(selectedViews[0]).resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 493, uncommitted: 465 })
    expect(required(selectedViews[0]).resources[ResourceType.FUEL]).toStrictEqual({ total: 95, uncommitted: 90 })
    expect(required(selectedViews[1]).resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 495, uncommitted: 470 })
    expect(required(selectedViews[1]).resources[ResourceType.FUEL]).toStrictEqual({ total: 95, uncommitted: 95 })
    expect(getFleetAt(required(selectedViews[0]), required(selectedViews[0]).player.id, homeA.id, 50).id).toBe(aliceSource.id)

    const finalTurnInput = await captureWorkerInput({
      server,
      clock,
      turnsRepository,
      gameId,
      turn: required(selectedViews[0]).turn,
    })
    const finalReplay = replayWorkerInputWithState(finalTurnInput)
    const publicReplay = finalReplay.resolved
    Assert.isSuccess(publicReplay)
    const friendlyWinner = publicReplay.value.fleets[stagedFriendly.id]
    Assert.isDefined(friendlyWinner)
    expect(friendlyWinner).toMatchObject({
      id: stagedFriendly.id,
      name: stagedFriendly.name,
      ownerPlayerId: required(selectedViews[0]).player.id,
      originPlanetId: target.id,
      strength: 40,
      arrivedAtTick: 3,
    })
    const bobWinner = findPublicFleet(Object.values(publicReplay.value.fleets), {
      ownerPlayerId: required(selectedViews[1]).player.id,
      originPlanetId: target.id,
      strength: 15,
    })
    Assert.isDefined(bobWinner)
    expect(bobWinner.arrivedAtTick).toBe(7)
    expect(publicReplay.value.planets[target.id]?.ownerPlayerId).toBe(required(selectedViews[1]).player.id)
    expect(
      publicReplay.value.resolvedActions.find(({ submittedAction }) => submittedAction.id === aliceColonizeActionId)?.actionOutcomes,
    ).toContainEqual(expect.objectContaining({ type: "PREVENTED" }))
    expect(
      publicReplay.value.resolvedActions.find(({ submittedAction }) => submittedAction.id === bobColonizeActionId)?.actionOutcomes,
    ).toContainEqual(expect.objectContaining({ type: "RESOLVED" }))
    expect(
      publicReplay.value.resolvedActions.find(({ submittedAction }) => submittedAction.id === ordinaryActionId)?.actionOutcomes,
    ).toContainEqual(expect.objectContaining({ type: "RESOLVED" }))
    expect(finalReplay.nextRngState).toStrictEqual(finalTurnInput.rngState)

    expect(await turnProcessor.processNextDueTurn()).toBe("processed")
    views = await readViews(clients, gameId)
    expect(getPlanets(required(views[0])).find(({ id }) => id === target.id)?.ownerPlayerId).toBe(required(views[1]).player.id)
    const persistedFriendlyFleets = required(views[0]).fleets.filter((fleet) =>
      matchesPublicFleet(fleet, { ownerPlayerId: required(views[0]).player.id, originPlanetId: target.id, stationary: true }),
    )
    expect(persistedFriendlyFleets).toStrictEqual([
      expect.objectContaining({ id: stagedFriendly.id, name: stagedFriendly.name, strength: 40 }),
    ])
    expect(getFleetAt(required(views[1]), required(views[1]).player.id, target.id, 15)).toBeDefined()
    expect(getFleetAt(required(views[0]), required(views[0]).player.id, homeA.id, 20)).toBeDefined()
    expect(required(views[0]).resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 465, uncommitted: 465 })
    expect(required(views[0]).resources[ResourceType.FUEL]).toStrictEqual({ total: 90, uncommitted: 90 })
    expect(required(views[0]).resources[ResourceType.METAL]).toStrictEqual({ total: 98, uncommitted: 98 })
    expect(required(views[1]).resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 470, uncommitted: 470 })
    expect(required(views[1]).resources[ResourceType.FUEL]).toStrictEqual({ total: 95, uncommitted: 95 })
    expect(required(views[1]).resources[ResourceType.METAL]).toStrictEqual({ total: 99, uncommitted: 99 })
    expect(views.map(({ resources }) => resources[ResourceType.COLONY].total)).toStrictEqual([0, 0])
    for (const [view, actionIds] of [
      [required(views[0]), [ordinaryActionId, aliceColonizeActionId]],
      [required(views[1]), [bobColonizeActionId]],
    ] as const) {
      for (const actionId of actionIds) {
        expect(view.actions.find(({ id }) => id === actionId)).toMatchObject({ selectedTargets: null, isInProgress: false })
      }
    }
    const savedTurns = await server.database
      .select()
      .from(turnsTable)
      .where(eq(turnsTable.gameId, typedParse(GameIdSchema, gameId)))
    const savedNextTurn = savedTurns.find(({ turn }) => turn === required(selectedViews[0]).turn + 1)
    Assert.isDefined(savedNextTurn)
    const persistedNextRngState = { generatorState: savedNextTurn.rngGeneratorState, spareNormal: savedNextTurn.rngSpareNormal }
    expect(persistedNextRngState).toStrictEqual(finalTurnInput.rngState)
    logReceipt("[C3-12 public provenance receipt]", {
      gameId,
      seed: 1,
      players: [required(views[0]).player.id, required(views[1]).player.id],
      source: { id: homeA.id, name: homeA.name, coordinates: homeA.coordinates },
      target: { id: target.id, name: target.name, coordinates: target.coordinates },
      sourceToTargetDistance: 1.2645395167985714,
      bobHomeToSourceDistance: 20.111265402761585,
      staging: {
        ordinaryFriendly: { strength: 10, speed: 5, arrivalTick: 6, fleetId: stagedFriendly.id, fleetName: stagedFriendly.name },
        bobToSource: {
          strength: 35,
          speed: 5,
          remainingDistances: [15.111265402761585, 10.111265402761585, 5.111265402761585, 0.111265402761585],
          arrivalTick: 1,
        },
      },
      observation: {
        ordinaryFriendly: { strength: 10, speed: 10, tick: 3 },
        bobColonize: { strength: 35, speed: 4, tick: 7 },
        aliceColonize: { strength: 20, speed: 2, tick: 13 },
        aliceSourceRemainder: 20,
      },
      persistedOwner: getPlanets(required(views[0])).find(({ id }) => id === target.id)?.ownerPlayerId,
      persistedFriendly: persistedFriendlyFleets,
      persistedEnemy: required(views[1]).fleets.find((fleet) =>
        matchesPublicFleet(fleet, { ownerPlayerId: required(views[1]).player.id, originPlanetId: target.id }),
      ),
      loadedRngState: finalTurnInput.rngState,
      replayNextRngState: finalReplay.nextRngState,
      persistedNextRngState,
      actualWorkerLoadedTurn: finalTurnInput.turn,
      stagedBobSubmissionId: bobStageActionId,
      stagedAliceSubmissionId: aliceStageActionId,
    })
  })

  it("should let the earlier speed-2 claimant beat a later speed-1 arrival on the next Turn", async () => {
    await using server = await ConcurrencyTestApiServer.create()
    const fixture = await createPublicTwoPlayerFixture(server)
    const { alice, bob, clients, gameId, clock, turnProcessor, turnsRepository, homeA, target } = fixture
    const staged = await stagePublicMergeScenario(server, fixture)
    let views = staged.views
    const { stagedFriendly, bobAtSource, aliceSource } = staged

    const ordinaryActionId = await submitAction({
      client: alice.client,
      gameId,
      view: required(views[0]),
      actionDefinitionId: MoveFleetSpeed10.id,
      selectedTargets: { fleet: aliceSource.id, planet: target.id },
      selectedInputs: { strength: 10 },
    })
    const aliceColonizeActionId = await submitAction({
      client: alice.client,
      gameId,
      view: required(views[0]),
      actionDefinitionId: ColonizeFleetSpeed2.id,
      selectedTargets: { fleet: aliceSource.id, planet: target.id },
      selectedInputs: { strength: 20 },
    })
    const bobColonizeActionId = await submitAction({
      client: bob.client,
      gameId,
      view: required(views[1]),
      actionDefinitionId: ColonizePlanetTest.id,
      selectedTargets: { fleet: bobAtSource.id, planet: target.id },
      selectedInputs: { strength: 35 },
    })
    const selectedViews = await readViews(clients, gameId)
    expect(required(selectedViews[0]).resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 493, uncommitted: 465 })
    expect(required(selectedViews[1]).resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 495, uncommitted: 470 })

    const finalTurnInput = await captureWorkerInput({
      server,
      clock,
      turnsRepository,
      gameId,
      turn: required(selectedViews[0]).turn,
    })
    const firstReplay = replayWorkerInputWithState(finalTurnInput)
    Assert.isSuccess(firstReplay.resolved)
    expect(firstReplay.resolved.value.planets[target.id]?.ownerPlayerId).toBe(required(selectedViews[0]).player.id)
    expect(firstReplay.resolved.value.fleets[stagedFriendly.id]).toMatchObject({
      id: stagedFriendly.id,
      name: stagedFriendly.name,
      ownerPlayerId: required(selectedViews[0]).player.id,
      originPlanetId: target.id,
      strength: 20,
    })
    const bobJourney = Object.values(firstReplay.resolved.value.fleets).find((fleet) =>
      matchesPublicFleet(fleet, { ownerPlayerId: required(selectedViews[1]).player.id, movementSubmissionId: bobColonizeActionId }),
    )
    Assert.isDefined(bobJourney)
    const bobJourneyId = bobJourney.id
    expect(bobJourney.distanceToEnd).toBeCloseTo(0.2645395167985714, 12)
    expect(firstReplay.nextRngState).toStrictEqual(finalTurnInput.rngState)

    expect(await turnProcessor.processNextDueTurn()).toBe("processed")
    views = await readViews(clients, gameId)
    expect(getPlanets(required(views[0])).find(({ id }) => id === target.id)?.ownerPlayerId).toBe(required(views[0]).player.id)
    expect(getFleetAt(required(views[0]), required(views[0]).player.id, target.id, 20)).toMatchObject({
      id: stagedFriendly.id,
      name: stagedFriendly.name,
    })
    expect(getFleetAt(required(views[0]), required(views[0]).player.id, homeA.id, 20)).toBeDefined()
    expect(required(views[0]).resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 465, uncommitted: 465 })
    const pendingBob = required(views[1]).fleets.find(({ id }) => id === bobJourneyId)
    Assert.isDefined(pendingBob)
    expect(pendingBob.distanceToEnd).toBeCloseTo(0.2645395167985714, 12)
    expect(required(views[0]).actions.find(({ id }) => id === aliceColonizeActionId)).toMatchObject({
      selectedTargets: null,
      isInProgress: false,
    })
    expect(required(views[1]).actions.find(({ id }) => id === bobColonizeActionId)).toMatchObject({ isInProgress: true })

    const laterTurnInput = await captureWorkerInput({
      server,
      clock,
      turnsRepository,
      gameId,
      turn: required(views[0]).turn,
    })
    const laterReplay = replayWorkerInputWithState(laterTurnInput)
    Assert.isSuccess(laterReplay.resolved)
    expect(laterReplay.resolved.value.planets[target.id]?.ownerPlayerId).toBe(required(views[0]).player.id)
    expect(laterReplay.resolved.value.fleets[bobJourneyId]).toMatchObject({
      id: bobJourneyId,
      ownerPlayerId: required(views[1]).player.id,
      originPlanetId: target.id,
      strength: 35,
      arrivedAtTick: 6,
    })
    expect(
      laterReplay.resolved.value.resolvedContinuations.find(({ originatingSubmission }) => originatingSubmission.id === bobColonizeActionId)
        ?.actionOutcomes,
    ).toContainEqual(expect.objectContaining({ type: "PREVENTED" }))
    expect(laterReplay.nextRngState).toStrictEqual(laterTurnInput.rngState)

    expect(await turnProcessor.processNextDueTurn()).toBe("processed")
    views = await readViews(clients, gameId)
    expect(getPlanets(required(views[0])).find(({ id }) => id === target.id)?.ownerPlayerId).toBe(required(views[0]).player.id)
    expect(getFleetAt(required(views[0]), required(views[0]).player.id, target.id, 20)).toMatchObject({
      id: stagedFriendly.id,
      name: stagedFriendly.name,
    })
    expect(getFleetAt(required(views[1]), required(views[1]).player.id, target.id, 35)).toBeDefined()
    expect(required(views[0]).resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 465, uncommitted: 465 })
    expect(required(views[1]).resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 470, uncommitted: 470 })
    expect(required(views[0]).actions.find(({ id }) => id === ordinaryActionId)).toMatchObject({
      selectedTargets: null,
      isInProgress: false,
    })
    expect(required(views[1]).actions.find(({ id }) => id === bobColonizeActionId)).toMatchObject({
      selectedTargets: null,
      isInProgress: false,
    })
  })

  it("should resolve duplicate public colonization arrivals once after merging and preserve order invariance", async () => {
    await using server = await ConcurrencyTestApiServer.create()
    const fixture = await createPublicTwoPlayerFixture(server)
    const { alice, clients, gameId, clock, turnProcessor, turnsRepository, homeA, target } = fixture
    const staged = await stagePublicMergeScenario(server, fixture)
    let views = staged.views
    const { stagedFriendly, aliceSource } = staged

    const speed4ActionId = await submitAction({
      client: alice.client,
      gameId,
      view: required(views[0]),
      actionDefinitionId: ColonizeFleetSpeed4.id,
      selectedTargets: { fleet: aliceSource.id, planet: target.id },
      selectedInputs: { strength: 20 },
    })
    const speed2ActionId = await submitAction({
      client: alice.client,
      gameId,
      view: required(views[0]),
      actionDefinitionId: ColonizeFleetSpeed2.id,
      selectedTargets: { fleet: aliceSource.id, planet: target.id },
      selectedInputs: { strength: 20 },
    })
    const selectedViews = await readViews(clients, gameId)
    expect(required(selectedViews[0]).resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 493, uncommitted: 443 })
    expect(required(selectedViews[0]).resources[ResourceType.FUEL]).toStrictEqual({ total: 95, uncommitted: 95 })
    expect(getFleetAt(required(selectedViews[0]), required(selectedViews[0]).player.id, homeA.id, 50).id).toBe(aliceSource.id)

    const finalTurnInput = await captureWorkerInput({
      server,
      clock,
      turnsRepository,
      gameId,
      turn: required(selectedViews[0]).turn,
    })
    const finalReplay = replayWorkerInputWithState(finalTurnInput)
    const reversedReplay = replayWorkerInputWithState(finalTurnInput, true)
    Assert.isSuccess(finalReplay.resolved)
    Assert.isSuccess(reversedReplay.resolved)
    expect(canonicalizeResolvedTurn(reversedReplay.resolved.value)).toStrictEqual(canonicalizeResolvedTurn(finalReplay.resolved.value))
    expect(reversedReplay.nextRngState).toStrictEqual(finalReplay.nextRngState)
    expect(finalReplay.nextRngState).toStrictEqual(finalTurnInput.rngState)
    const publicReplay = finalReplay.resolved.value
    const firstOutcome = required(publicReplay.resolvedActions.find(({ submittedAction }) => submittedAction.id === speed4ActionId))
    const secondOutcome = required(publicReplay.resolvedActions.find(({ submittedAction }) => submittedAction.id === speed2ActionId))
    expect(firstOutcome?.actionOutcomes.at(-1)).toMatchObject({
      type: "RESOLVED",
      result: expect.stringContaining(' colonized Planet "planet 649967" with 20 Strength'),
    })
    expect(secondOutcome.actionOutcomes.at(-1)).toMatchObject({ type: "PREVENTED", reason: "Planet is already claimed" })
    for (const actionOutcomes of [firstOutcome.actionOutcomes, secondOutcome.actionOutcomes]) {
      expect(actionOutcomes.filter((outcome) => hasPreventedOrColonized(outcome))).toHaveLength(1)
    }
    const mergedFriendly = publicReplay.fleets[stagedFriendly.id]
    Assert.isDefined(mergedFriendly)
    expect(mergedFriendly).toMatchObject({
      id: stagedFriendly.id,
      name: stagedFriendly.name,
      ownerPlayerId: required(selectedViews[0]).player.id,
      originPlanetId: target.id,
      strength: 30,
    })
    expect(publicReplay.fleets[aliceSource.id]).toMatchObject({
      id: aliceSource.id,
      originPlanetId: homeA.id,
      strength: 10,
    })
    expect(publicReplay.planets[target.id]?.ownerPlayerId).toBe(required(selectedViews[0]).player.id)

    expect(await turnProcessor.processNextDueTurn()).toBe("processed")
    views = await readViews(clients, gameId)
    expect(getPlanets(required(views[0])).find(({ id }) => id === target.id)?.ownerPlayerId).toBe(required(views[0]).player.id)
    expect(getFleetAt(required(views[0]), required(views[0]).player.id, target.id, 30)).toMatchObject({
      id: stagedFriendly.id,
      name: stagedFriendly.name,
    })
    expect(getFleetAt(required(views[0]), required(views[0]).player.id, homeA.id, 10)).toMatchObject({ id: aliceSource.id, strength: 10 })
    expect(required(views[0]).resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 443, uncommitted: 443 })
    expect(required(views[0]).resources[ResourceType.FUEL]).toStrictEqual({ total: 95, uncommitted: 95 })
    expect(views.map(({ resources }) => resources[ResourceType.COLONY].total)).toStrictEqual([0, 0])
    for (const actionId of [speed4ActionId, speed2ActionId]) {
      expect(required(views[0]).actions.find(({ id }) => id === actionId)).toMatchObject({ selectedTargets: null, isInProgress: false })
    }
    const savedTurns = await server.database
      .select()
      .from(turnsTable)
      .where(eq(turnsTable.gameId, typedParse(GameIdSchema, gameId)))
    const savedNextTurn = savedTurns.find(({ turn }) => turn === required(selectedViews[0]).turn + 1)
    Assert.isDefined(savedNextTurn)
    const persistedNextRngState = { generatorState: savedNextTurn.rngGeneratorState, spareNormal: savedNextTurn.rngSpareNormal }
    expect(persistedNextRngState).toStrictEqual(finalTurnInput.rngState)
    logReceipt("[C3-13 public duplicate receipt]", {
      gameId,
      seed: 1,
      players: [required(views[0]).player.id, required(views[1]).player.id],
      source: { id: homeA.id, name: homeA.name, coordinates: homeA.coordinates },
      target: { id: target.id, name: target.name, coordinates: target.coordinates },
      routeDistance: 1.2645395167985714,
      sourceRemainder: 10,
      stagedFleet: { id: stagedFriendly.id, name: stagedFriendly.name, strength: 10, arrivalTick: 6 },
      arrivals: [
        { actionId: speed4ActionId, strength: 20, speed: 4, arrivalTick: 7, outcome: "RESOLVED" },
        { actionId: speed2ActionId, strength: 20, speed: 2, arrivalTick: 13, outcome: "PREVENTED" },
      ],
      finalFleet: mergedFriendly,
      influence: { before: 493, committed: 50, after: 443 },
      loadedRngState: finalTurnInput.rngState,
      replayNextRngState: finalReplay.nextRngState,
      reversedReplayNextRngState: reversedReplay.nextRngState,
      persistedNextRngState,
      actualWorkerLoadedTurn: finalTurnInput.turn,
    })
  })

  it("should serialize aggregate Move and stationary Colonize reservations against PostgreSQL and Turn closure", async () => {
    await using server = await ConcurrencyTestApiServer.create()
    const fixture = await createPublicTwoPlayerFixture(server)
    const { alice, bob, gameId, clock, turnProcessor, turnsRepository, homeA, target } = fixture
    const buildView = required(fixture.views[0])
    await submitAction({
      client: alice.client,
      gameId,
      view: buildView,
      actionDefinitionId: BuildFleet35.id,
      selectedTargets: { planet: homeA.id },
      selectedInputs: {},
    })
    const builtView = await processTurn({
      clock,
      turnsRepository,
      turnProcessor,
      client: alice.client,
      gameId,
      turn: buildView.turn,
    })
    const homeFleet = getFleetAt(builtView, builtView.player.id, homeA.id, 35)
    const moveToTargetId = await submitAction({
      client: alice.client,
      gameId,
      view: builtView,
      actionDefinitionId: MoveFleetExceptional.id,
      selectedTargets: { fleet: homeFleet.id, planet: target.id },
      selectedInputs: { strength: 35 },
    })
    const arrivedView = await processTurn({
      clock,
      turnsRepository,
      turnProcessor,
      client: alice.client,
      gameId,
      turn: builtView.turn,
    })
    const stationary = getFleetAt(arrivedView, arrivedView.player.id, target.id, 35)
    expect(getPlanets(arrivedView).find(({ id }) => id === target.id)?.ownerPlayerId).toBeNull()
    expect(arrivedView.actions.find(({ id }) => id === moveToTargetId)).toMatchObject({ selectedTargets: null, isInProgress: false })
    const moveAction = arrivedView.actions.find(({ actionDefinitionId }) => actionDefinitionId === MoveFleetStandard.id)
    const colonizeAction = arrivedView.actions.find(({ actionDefinitionId }) => actionDefinitionId === ColonizeHereTest.id)
    Assert.isDefined(moveAction)
    Assert.isDefined(colonizeAction)

    const raceGate = startTogether(2)
    const race = await Promise.allSettled([
      (async (): Promise<void> => {
        await raceGate()
        await alice.client.gameplay.updateActionSubmission.mutate({
          gameId,
          turn: arrivedView.turn,
          submittedActionTargets: {
            actionId: moveAction.id,
            selectedTargets: { fleet: stationary.id, planet: homeA.id },
            selectedInputs: { strength: 16 },
          },
        })
      })(),
      (async (): Promise<void> => {
        await raceGate()
        await alice.client.gameplay.updateActionSubmission.mutate({
          gameId,
          turn: arrivedView.turn,
          submittedActionTargets: {
            actionId: colonizeAction.id,
            selectedTargets: { fleet: stationary.id, planet: target.id },
            selectedInputs: {},
          },
        })
      })(),
    ])
    expect(race.filter(({ status }) => status === "fulfilled")).toHaveLength(1)
    expect(race.filter(({ status }) => status === "rejected")).toHaveLength(1)

    let selectedView = await alice.client.gameplay.getPlayerView.query({ gameId })
    const selectedMove = selectedView.actions.find(({ id }) => id === moveAction.id)
    const selectedColonize = selectedView.actions.find(({ id }) => id === colonizeAction.id)
    Assert.isDefined(selectedMove)
    Assert.isDefined(selectedColonize)
    const winningAction = required(selectedView.actions.find(isActionSelected))
    const beforeClosure = {
      influence: selectedView.resources[ResourceType.INFLUENCE],
      fuel: selectedView.resources[ResourceType.FUEL],
    }
    const raceObservation = {
      move: { selectedTargets: selectedMove.selectedTargets, selectedInputs: selectedMove.selectedInputs },
      colonize: { selectedTargets: selectedColonize.selectedTargets, selectedInputs: selectedColonize.selectedInputs },
      influenceUncommitted: beforeClosure.influence.uncommitted,
      fuelUncommitted: beforeClosure.fuel.uncommitted,
      winningActionId: winningAction.id,
    }
    expect([
      {
        move: { selectedTargets: { fleet: stationary.id, planet: homeA.id }, selectedInputs: { strength: 16 } },
        colonize: { selectedTargets: null, selectedInputs: null },
        influenceUncommitted: arrivedView.resources[ResourceType.INFLUENCE].total - 3,
        fuelUncommitted: arrivedView.resources[ResourceType.FUEL].total - 1,
        winningActionId: moveAction.id,
      },
      {
        move: { selectedTargets: null, selectedInputs: null },
        colonize: { selectedTargets: { fleet: stationary.id, planet: target.id }, selectedInputs: {} },
        influenceUncommitted: arrivedView.resources[ResourceType.INFLUENCE].total - 25,
        fuelUncommitted: arrivedView.resources[ResourceType.FUEL].total,
        winningActionId: colonizeAction.id,
      },
    ]).toContainEqual(raceObservation)
    await alice.client.gameplay.updateActionSubmission.mutate({
      gameId,
      turn: arrivedView.turn,
      submittedActionTargets: { actionId: winningAction.id, selectedTargets: null, selectedInputs: null },
    })
    const clearedViews = await readViews([alice, bob], gameId)
    selectedView = required(clearedViews[0])
    const closureColonize = selectedView.actions.find(({ id }) => id === colonizeAction.id)
    Assert.isDefined(closureColonize)
    expect(selectedView.resources[ResourceType.INFLUENCE].uncommitted).toBe(selectedView.resources[ResourceType.INFLUENCE].total)
    expect(selectedView.resources[ResourceType.FUEL].uncommitted).toBe(selectedView.resources[ResourceType.FUEL].total)

    const closureGate = startTogether(3)
    const closureRace = await Promise.allSettled([
      (async (): Promise<void> => {
        await closureGate()
        await alice.client.gameplay.updateActionSubmission.mutate({
          gameId,
          turn: selectedView.turn,
          submittedActionTargets: {
            actionId: closureColonize.id,
            selectedTargets: { fleet: stationary.id, planet: target.id },
            selectedInputs: {},
          },
        })
      })(),
      (async (): Promise<void> => {
        await closureGate()
        await alice.client.gameplay.updateReadiness.mutate({ gameId, turn: selectedView.turn, isReady: true })
      })(),
      (async (): Promise<void> => {
        await closureGate()
        await bob.client.gameplay.updateReadiness.mutate({ gameId, turn: selectedView.turn, isReady: true })
      })(),
    ])
    expect(closureRace[1]?.status).toBe("fulfilled")
    expect(closureRace[2]?.status).toBe("fulfilled")
    const closureSubmissionStatus = required(closureRace[0]).status
    const lockedView = await alice.client.gameplay.getPlayerView.query({ gameId })
    const lockedColonize = required(lockedView.actions.find(({ id }) => id === closureColonize.id))
    const lockedObservation = {
      turn: lockedView.turn,
      turnStatus: lockedView.turnStatus,
      isReady: lockedView.player.isReady,
      closureSubmissionStatus,
      selectedTargets: lockedColonize.selectedTargets,
      selectedInputs: lockedColonize.selectedInputs,
    }
    const inFlightTurnObservations = [TurnStatus.AWAITING_PROCESSING, TurnStatus.PROCESSING].flatMap((turnStatus) => [
      {
        turn: selectedView.turn,
        turnStatus,
        isReady: true,
        closureSubmissionStatus: "fulfilled",
        selectedTargets: { fleet: stationary.id, planet: target.id },
        selectedInputs: {},
      },
      {
        turn: selectedView.turn,
        turnStatus,
        isReady: true,
        closureSubmissionStatus: "rejected",
        selectedTargets: null,
        selectedInputs: null,
      },
    ])
    const completedTurnObservations = [TurnStatus.AWAITING_PROCESSING, TurnStatus.PROCESSING].map((turnStatus) => ({
      turn: selectedView.turn + 1,
      turnStatus,
      isReady: false,
      closureSubmissionStatus,
      selectedTargets: null,
      selectedInputs: null,
    }))
    expect([...inFlightTurnObservations, ...completedTurnObservations]).toContainEqual(lockedObservation)

    const processingOutcome = await turnProcessor.processNextDueTurn()
    expect(["processed", "idle"]).toContain(processingOutcome)
    let completedView = await alice.client.gameplay.getPlayerView.query({ gameId })
    await expect
      .poll(async () => (await alice.client.gameplay.getPlayerView.query({ gameId })).turn, { timeout: 20_000, interval: 25 })
      .toBe(selectedView.turn + 1)
    completedView = await alice.client.gameplay.getPlayerView.query({ gameId })
    const claimedPlanet = getPlanets(completedView).find(({ id }) => id === target.id)
    Assert.isDefined(claimedPlanet)
    const remainingAtTarget = findPublicFleet(completedView.fleets, {
      ownerPlayerId: completedView.player.id,
      originPlanetId: target.id,
      stationary: true,
    })
    const completedObservation = {
      closureSubmissionStatus,
      ownerPlayerId: claimedPlanet.ownerPlayerId,
      remainingStrength: remainingAtTarget?.strength,
      influence: completedView.resources[ResourceType.INFLUENCE].total,
    }
    expect([
      {
        closureSubmissionStatus: "fulfilled",
        ownerPlayerId: completedView.player.id,
        remainingStrength: 15,
        influence: selectedView.resources[ResourceType.INFLUENCE].total - 25,
      },
      {
        closureSubmissionStatus: "rejected",
        ownerPlayerId: null,
        remainingStrength: 35,
        influence: selectedView.resources[ResourceType.INFLUENCE].total,
      },
    ]).toContainEqual(completedObservation)
    expect(completedView.resources[ResourceType.COLONY].total).toBe(0)
    expect(completedView.actions.find(({ id }) => id === closureColonize.id)).toMatchObject({
      selectedTargets: null,
      isInProgress: false,
    })
    expect(completedView.turn).toBe(selectedView.turn + 1)
    logReceipt("[C3-18 PostgreSQL reservation and closure receipt]", {
      gameId,
      seed: 1,
      source: { id: stationary.id, strength: 35, planet: target.id },
      concurrentReservations: { move16: race[0]?.status, stationaryColonize20: race[1]?.status },
      lockedResources: beforeClosure,
      closureSubmission: closureRace[0]?.status,
      readiness: closureRace.slice(1).map(({ status }) => status),
      persistedOwner: claimedPlanet.ownerPlayerId,
      persistedFleetStrength: remainingAtTarget?.strength,
      influence: completedView.resources[ResourceType.INFLUENCE].total,
    })
  })

  it("should preserve the public 15+20 stationary Colonize budget through selection, replacement, cancellation, and the exact40 boundary", async () => {
    await using server = await ConcurrencyTestApiServer.create()
    const rulesetsRepository = new RulesetsRepository({ db: server.database, logger: Logger.get() })
    Assert.isSuccess(await rulesetsRepository.upsertRuleset(PublicColonizationBudgetRuleset))
    const player = await server.createClient({ authenticated: true, id: "00000000-0000-4000-8000-000000000091" })
    const { createdGameId: gameId } = await player.client.games.create.mutate({
      configuration: createGameConfigurationStub({
        rulesetId: PublicColonizationBudgetRuleset.id,
        nbSeats: 1,
        turnIntervalSeconds: Time.in(MANUAL_TURN_INTERVAL, UnitOfTime.SECONDS),
        mapGenerationSeed: 1234,
      }),
    })
    await player.client.games.startGame.mutate({ gameId })
    const clock = new ControlledClock({ startDate: new Date() })
    const { turnProcessor, turnsRepository } = await createTurnProcessorStub({ db: server.database, clock })
    let view = await player.client.gameplay.getPlayerView.query({ gameId })
    const home = getHome(view)
    const target = getPlanets(view).find(({ coordinates }) => coordinates === "55:07:50")
    const replacementTarget = getPlanets(view).find(({ coordinates }) => coordinates === "45:98:25")
    Assert.isDefined(target)
    Assert.isDefined(replacementTarget)
    expect({ id: home.id, name: home.name, coordinates: home.coordinates, x: home.x, y: home.y }).toStrictEqual({
      id: "78821e36-f066-5df0-adbd-19785571d245",
      name: "planet 278494",
      coordinates: "45:98:30",
      x: 58.43842436611536,
      y: 49.61917707239218,
    })
    expect({ id: target.id, name: target.name, coordinates: target.coordinates, x: target.x, y: target.y }).toStrictEqual({
      id: "a34e5eae-656c-5330-ac90-9f9a7e0afa5d",
      name: "planet 684163",
      coordinates: "55:07:50",
      x: 57.77998524757335,
      y: 50.556704120958045,
    })
    expect({
      id: replacementTarget.id,
      name: replacementTarget.name,
      coordinates: replacementTarget.coordinates,
      x: replacementTarget.x,
      y: replacementTarget.y,
    }).toStrictEqual({
      id: "3f56a5c2-d379-5b15-a6c5-1d5948724fea",
      name: "planet 499054",
      coordinates: "45:98:25",
      x: 58.43825730690875,
      y: 49.61937512280339,
    })
    expect(Math.hypot(home.x - target.x, home.y - target.y)).toBeCloseTo(1.1456435045942517, 12)
    expect(target.ownerPlayerId).toBeNull()
    expect(view.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 100, uncommitted: 100 })
    expect(view.resources[ResourceType.FUEL]).toStrictEqual({ total: 10, uncommitted: 10 })
    expect(view.resources[ResourceType.COLONY]).toStrictEqual({ total: 0, uncommitted: 0 })

    const buildAction = view.actions.find(({ id }) => id === "PUBLIC_BUDGET_BUILD35")
    Assert.isDefined(buildAction)
    await player.client.gameplay.updateActionSubmission.mutate({
      gameId,
      turn: view.turn,
      submittedActionTargets: {
        actionId: buildAction.id,
        selectedTargets: { planet: home.id },
        selectedInputs: {},
      },
    })
    view = await processTurn({ clock, turnsRepository, turnProcessor, client: player.client, gameId, turn: view.turn })
    const sourceAtHome = getFleetAt(view, view.player.id, home.id, 35)
    const stageAction = view.actions.find(({ id }) => id === "PUBLIC_BUDGET_STAGE_FLEET")
    Assert.isDefined(stageAction)
    await player.client.gameplay.updateActionSubmission.mutate({
      gameId,
      turn: view.turn,
      submittedActionTargets: {
        actionId: stageAction.id,
        selectedTargets: { fleet: sourceAtHome.id, planet: target.id },
        selectedInputs: { strength: 35 },
      },
    })
    view = await processTurn({ clock, turnsRepository, turnProcessor, client: player.client, gameId, turn: view.turn })
    const stationary = getFleetAt(view, view.player.id, target.id, 35)
    const buildThirtyAction = view.actions.find(({ id }) => id === "PUBLIC_BUDGET_BUILD30")
    Assert.isDefined(buildThirtyAction)
    await player.client.gameplay.updateActionSubmission.mutate({
      gameId,
      turn: view.turn,
      submittedActionTargets: {
        actionId: buildThirtyAction.id,
        selectedTargets: { planet: home.id },
        selectedInputs: {},
      },
    })
    view = await processTurn({ clock, turnsRepository, turnProcessor, client: player.client, gameId, turn: view.turn })
    const replacementSourceAtHome = getFleetAt(view, view.player.id, home.id, 30)
    const replacementStageAction = view.actions.find(({ id }) => id === "PUBLIC_BUDGET_STAGE_FLEET")
    Assert.isDefined(replacementStageAction)
    await player.client.gameplay.updateActionSubmission.mutate({
      gameId,
      turn: view.turn,
      submittedActionTargets: {
        actionId: replacementStageAction.id,
        selectedTargets: { fleet: replacementSourceAtHome.id, planet: replacementTarget.id },
        selectedInputs: { strength: 30 },
      },
    })
    view = await processTurn({ clock, turnsRepository, turnProcessor, client: player.client, gameId, turn: view.turn })
    const replacementSource = getFleetAt(view, view.player.id, replacementTarget.id, 30)
    expect(getFleetAt(view, view.player.id, target.id, 35).strength).toBe(35)
    expect(getPlanets(view).find(({ id }) => id === target.id)?.ownerPlayerId).toBeNull()
    expect(getPlanets(view).find(({ id }) => id === replacementTarget.id)?.ownerPlayerId).toBeNull()
    expect(view.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 100, uncommitted: 100 })
    expect(view.resources[ResourceType.FUEL]).toStrictEqual({ total: 10, uncommitted: 10 })
    expect(getPlanets(view).find(({ id }) => id === target.id)?.ownerPlayerId).toBeNull()

    const moveAction = view.actions.find((action) => isUnselectedActionWithDefinition(action, MoveFleetStandard.id))

    const colonizeActions = view.actions.filter((action) => isColonizeDefinitionId(action.actionDefinitionId))
    const colonizeAction = colonizeActions.find(({ actionDefinitionId }) => actionDefinitionId === ColonizeHereTest.id)
    const secondColonizeAction = colonizeActions.find(({ actionDefinitionId }) => actionDefinitionId === PublicBudgetSecondColonizeHere.id)
    Assert.isDefined(moveAction)
    Assert.isDefined(colonizeAction)
    Assert.isDefined(secondColonizeAction)

    const submitMove = async (strength: number): Promise<void> => {
      await player.client.gameplay.updateActionSubmission.mutate({
        gameId,
        turn: view.turn,
        submittedActionTargets: {
          actionId: moveAction.id,
          selectedTargets: { fleet: stationary.id, planet: home.id },
          selectedInputs: { strength },
        },
      })
    }
    const submitColonize = async (
      actionId: string,
      selectedFleetId: string = stationary.id,
      selectedPlanetId: string = target.id,
    ): Promise<void> => {
      await player.client.gameplay.updateActionSubmission.mutate({
        gameId,
        turn: view.turn,
        submittedActionTargets: {
          actionId,
          selectedTargets: { fleet: selectedFleetId, planet: selectedPlanetId },
          selectedInputs: {},
        },
      })
    }
    const cancelAction = async (actionId: string): Promise<void> => {
      await player.client.gameplay.updateActionSubmission.mutate({
        gameId,
        turn: view.turn,
        submittedActionTargets: { actionId, selectedTargets: null, selectedInputs: null },
      })
    }
    const currentView = async (): Promise<PlayerView> => await player.client.gameplay.getPlayerView.query({ gameId })
    const assertCombinedReservation = (selected: PlayerView): void => {
      expect(selected.actions.find(({ id }) => id === moveAction.id)).toMatchObject({
        selectedTargets: { fleet: stationary.id, planet: home.id },
        selectedInputs: { strength: 15 },
      })
      expect(selected.actions.find(({ id }) => id === colonizeAction.id)).toMatchObject({
        selectedTargets: { fleet: stationary.id, planet: target.id },
        selectedInputs: {},
      })
      expect(selected.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 100, uncommitted: 72 })
      expect(selected.resources[ResourceType.FUEL]).toStrictEqual({ total: 10, uncommitted: 9 })
      expect(selected.resources[ResourceType.COLONY]).toStrictEqual({ total: 0, uncommitted: 0 })
    }

    await submitMove(15)
    await submitColonize(colonizeAction.id)
    assertCombinedReservation(await currentView())

    await submitColonize(colonizeAction.id, replacementSource.id, replacementTarget.id)
    const sourceReplacementView = await currentView()
    expect(sourceReplacementView.actions.find(({ id }) => id === moveAction.id)).toMatchObject({
      selectedTargets: { fleet: stationary.id, planet: home.id },
      selectedInputs: { strength: 15 },
    })
    expect(sourceReplacementView.actions.find(({ id }) => id === colonizeAction.id)).toMatchObject({
      selectedTargets: { fleet: replacementSource.id, planet: replacementTarget.id },
      selectedInputs: {},
    })
    expect(sourceReplacementView.fleets.find(({ id }) => id === stationary.id)?.strength).toBe(35)
    expect(sourceReplacementView.fleets.find(({ id }) => id === replacementSource.id)?.strength).toBe(30)
    expect(sourceReplacementView.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 100, uncommitted: 72 })
    expect(sourceReplacementView.resources[ResourceType.FUEL]).toStrictEqual({ total: 10, uncommitted: 9 })
    await submitColonize(colonizeAction.id)

    await cancelAction(moveAction.id)
    await cancelAction(colonizeAction.id)
    await submitColonize(colonizeAction.id)
    await submitMove(15)
    assertCombinedReservation(await currentView())

    await submitMove(14)
    let editedView = await currentView()
    expect(editedView.actions.find(({ id }) => id === moveAction.id)).toMatchObject({
      selectedTargets: { fleet: stationary.id, planet: home.id },
      selectedInputs: { strength: 14 },
    })
    expect(editedView.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 100, uncommitted: 72 })
    expect(editedView.resources[ResourceType.FUEL]).toStrictEqual({ total: 10, uncommitted: 9 })
    await expect(submitMove(16)).rejects.toThrow("submitted Actions reserve 36")
    editedView = await currentView()
    expect(editedView.actions.find(({ id }) => id === moveAction.id)?.selectedInputs).toStrictEqual({ strength: 14 })
    expect(editedView.actions.find(({ id }) => id === colonizeAction.id)?.selectedTargets).toStrictEqual({
      fleet: stationary.id,
      planet: target.id,
    })

    await cancelAction(moveAction.id)
    let cancelledView = await currentView()
    expect(cancelledView.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 100, uncommitted: 75 })
    expect(cancelledView.resources[ResourceType.FUEL]).toStrictEqual({ total: 10, uncommitted: 10 })
    expect(cancelledView.actions.find(({ id }) => id === colonizeAction.id)?.selectedTargets).toStrictEqual({
      fleet: stationary.id,
      planet: target.id,
    })
    await cancelAction(colonizeAction.id)

    await submitMove(15)
    await submitColonize(colonizeAction.id)
    await cancelAction(colonizeAction.id)
    cancelledView = await currentView()
    expect(cancelledView.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 100, uncommitted: 97 })
    expect(cancelledView.resources[ResourceType.FUEL]).toStrictEqual({ total: 10, uncommitted: 9 })
    expect(cancelledView.actions.find(({ id }) => id === moveAction.id)?.selectedInputs).toStrictEqual({ strength: 15 })
    await cancelAction(moveAction.id)

    await submitColonize(colonizeAction.id)
    await expect(submitColonize(secondColonizeAction.id)).rejects.toThrow("submitted Actions reserve 40")
    const exact35View = await currentView()
    expect(exact35View.actions.find(({ id }) => id === colonizeAction.id)?.selectedTargets).toStrictEqual({
      fleet: stationary.id,
      planet: target.id,
    })
    expect(exact35View.actions.find(({ id }) => id === secondColonizeAction.id)?.selectedTargets).toBeNull()
    expect(exact35View.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 100, uncommitted: 75 })
    await cancelAction(colonizeAction.id)

    const buildFiveAction = exact35View.actions.find(({ id }) => id === "PUBLIC_BUDGET_BUILD5")
    Assert.isDefined(buildFiveAction)
    await player.client.gameplay.updateActionSubmission.mutate({
      gameId,
      turn: exact35View.turn,
      submittedActionTargets: {
        actionId: buildFiveAction.id,
        selectedTargets: { planet: home.id },
        selectedInputs: {},
      },
    })
    view = await processTurn({ clock, turnsRepository, turnProcessor, client: player.client, gameId, turn: exact35View.turn })
    const fiveStrengthFleet = getFleetAt(view, view.player.id, home.id, 5)
    const nextStageAction = view.actions.find(({ id }) => id === "PUBLIC_BUDGET_STAGE_FLEET")
    Assert.isDefined(nextStageAction)
    await player.client.gameplay.updateActionSubmission.mutate({
      gameId,
      turn: view.turn,
      submittedActionTargets: {
        actionId: nextStageAction.id,
        selectedTargets: { fleet: fiveStrengthFleet.id, planet: target.id },
        selectedInputs: { strength: 5 },
      },
    })
    view = await processTurn({ clock, turnsRepository, turnProcessor, client: player.client, gameId, turn: view.turn })
    const fullForce = getFleetAt(view, view.player.id, target.id, 40)
    expect(getPlanets(view).find(({ id }) => id === target.id)?.ownerPlayerId).toBeNull()
    expect(view.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 100, uncommitted: 100 })
    expect(view.resources[ResourceType.FUEL]).toStrictEqual({ total: 10, uncommitted: 10 })

    const currentColonizeActions = view.actions.filter((action) => isColonizeDefinitionId(action.actionDefinitionId))
    const fullColonizeAction = currentColonizeActions.find(({ actionDefinitionId }) => actionDefinitionId === ColonizeHereTest.id)
    const fullSecondColonizeAction = currentColonizeActions.find(
      ({ actionDefinitionId }) => actionDefinitionId === PublicBudgetSecondColonizeHere.id,
    )
    Assert.isDefined(fullColonizeAction)
    Assert.isDefined(fullSecondColonizeAction)
    await player.client.gameplay.updateActionSubmission.mutate({
      gameId,
      turn: view.turn,
      submittedActionTargets: {
        actionId: fullColonizeAction.id,
        selectedTargets: { fleet: fullForce.id, planet: target.id },
        selectedInputs: {},
      },
    })
    await player.client.gameplay.updateActionSubmission.mutate({
      gameId,
      turn: view.turn,
      submittedActionTargets: {
        actionId: fullSecondColonizeAction.id,
        selectedTargets: { fleet: fullForce.id, planet: target.id },
        selectedInputs: {},
      },
    })
    const exact40View = await currentView()
    expect(exact40View.actions.find(({ id }) => id === fullColonizeAction.id)?.selectedTargets).toStrictEqual({
      fleet: fullForce.id,
      planet: target.id,
    })
    expect(exact40View.actions.find(({ id }) => id === fullSecondColonizeAction.id)?.selectedTargets).toStrictEqual({
      fleet: fullForce.id,
      planet: target.id,
    })
    expect(exact40View.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 100, uncommitted: 50 })
    expect(exact40View.resources[ResourceType.FUEL]).toStrictEqual({ total: 10, uncommitted: 10 })
    const exact40WorkerInput = await captureWorkerInput({
      server,
      clock,
      turnsRepository,
      gameId,
      turn: exact40View.turn,
    })
    const exact40Replay = replayWorkerInputWithState(exact40WorkerInput)
    Assert.isSuccess(exact40Replay.resolved)
    expect(exact40WorkerInput.submittedActions).toHaveLength(2)
    const exact40Resolved = exact40Replay.resolved.value
    const exact40Results = [fullColonizeAction.id, fullSecondColonizeAction.id].map((actionId) => {
      const result = exact40Resolved.resolvedActions.find(({ submittedAction }) => submittedAction.id === actionId)
      Assert.isDefined(result)
      return result
    })
    const exact40ColonizeOutcomes = exact40Results.flatMap(({ actionOutcomes }) => actionOutcomes)
    expect(exact40ColonizeOutcomes.filter((outcome) => hasResolvedResult(outcome, " colonized Planet "))).toHaveLength(1)
    expect(exact40ColonizeOutcomes.filter((outcome) => outcome.type === "PREVENTED")).toHaveLength(1)
    expect(exact40Replay.resolved.value.planets[target.id]?.ownerPlayerId).toBe(exact40View.player.id)
    expect(exact40Replay.resolved.value.fleets[fullForce.id]).toMatchObject({
      id: fullForce.id,
      ownerPlayerId: exact40View.player.id,
      originPlanetId: target.id,
      strength: 20,
    })
    expect(exact40Replay.resolved.value.fleets[fullForce.id]?.movement).toBeUndefined()
    expect(await turnProcessor.processNextDueTurn()).toBe("processed")
    const exact40CompletedView = await player.client.gameplay.getPlayerView.query({ gameId })
    expect(exact40CompletedView.turn).toBe(exact40View.turn + 1)
    expect(getPlanets(exact40CompletedView).find(({ id }) => id === target.id)?.ownerPlayerId).toBe(exact40View.player.id)
    expect(getFleetAt(exact40CompletedView, exact40View.player.id, target.id, 20).id).toBe(fullForce.id)
    expect(exact40CompletedView.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 50, uncommitted: 50 })
    expect(exact40CompletedView.resources[ResourceType.FUEL]).toStrictEqual({ total: 10, uncommitted: 10 })
    for (const actionId of [fullColonizeAction.id, fullSecondColonizeAction.id]) {
      expect(exact40CompletedView.actions.find(({ id }) => id === actionId)).toMatchObject({ selectedTargets: null, isInProgress: false })
    }
    const exact40SavedTurns = await server.database
      .select()
      .from(turnsTable)
      .where(eq(turnsTable.gameId, typedParse(GameIdSchema, gameId)))
    const exact40SavedNextTurn = exact40SavedTurns.find(({ turn: candidateTurn }) => candidateTurn === exact40WorkerInput.turn + 1)
    Assert.isDefined(exact40SavedNextTurn)
    const exact40PersistedRngState = {
      generatorState: exact40SavedNextTurn.rngGeneratorState,
      spareNormal: exact40SavedNextTurn.rngSpareNormal,
    }
    expect(exact40PersistedRngState).toStrictEqual(exact40Replay.nextRngState)
    logReceipt("[C3-18 public API aggregate budget receipt]", {
      gameId,
      seed: 1234,
      route: { from: home.coordinates, to: target.coordinates, distance: 1.1456435045942517 },
      startingBalances: { influence: 100, fuel: 10, colony: 0 },
      force35: { move15PlusStationary20: { influenceUncommitted: 72, fuelUncommitted: 9 }, rejectedMove16: true },
      sourceReplacement: {
        sourceP: { planet: target.coordinates, force: stationary.strength, moveReservation: 15, remaining: 20 },
        sourceQ: {
          planet: replacementTarget.coordinates,
          force: replacementSource.strength,
          colonizeReservation: 20,
          remaining: 10,
        },
        committedResources: { influence: 28, fuel: 1 },
      },
      cancellations: {
        moveCanceled: { influenceUncommitted: 75, fuelUncommitted: 10 },
        colonizeCanceled: { influenceUncommitted: 97, fuelUncommitted: 9 },
      },
      exactBoundary: { force35SecondColonizeRejected: true, force40TwoColonizeAccepted: true, influenceUncommitted: 50 },
      worker: {
        loadedTurn: exact40WorkerInput.turn,
        loadedActions: exact40WorkerInput.submittedActions.map(({ id, selectedTargets }) => ({ id, selectedTargets })),
        outcomes: exact40ColonizeOutcomes,
        persistedOwner: getPlanets(exact40CompletedView).find(({ id }) => id === target.id)?.ownerPlayerId,
        persistedFleetStrength: getFleetAt(exact40CompletedView, exact40View.player.id, target.id, 20).strength,
        resources: {
          influence: exact40CompletedView.resources[ResourceType.INFLUENCE].total,
          fuel: exact40CompletedView.resources[ResourceType.FUEL].total,
        },
        persistedNextRngState: exact40PersistedRngState,
      },
    })
  })
})
