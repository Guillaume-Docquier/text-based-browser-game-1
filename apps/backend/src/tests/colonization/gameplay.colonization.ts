import { noop, Assert, branded, indexBy, Logger, Time, UnitOfTime, type DeepUnbranded } from "@guillaume-docquier/tools-ts"
import { typedParse } from "@guillaume-docquier/tools-ts/schemas"
import { createGameConfigurationStub } from "shared/domain/games/GameConfiguration.stub.ts"
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
import { AttackMoveTest } from "shared/testing/test-ruleset/action-definitions/attack-move.ts"
import { BuildFleetStandard } from "shared/testing/test-ruleset/action-definitions/build-fleet.ts"
import { ColonizeHereTest, ColonizePlanetTest } from "shared/testing/test-ruleset/action-definitions/colonize.ts"
import { MoveFleetExceptional, MoveFleetStandard } from "shared/testing/test-ruleset/action-definitions/move-fleet.ts"
import { TestRuleset } from "shared/testing/test-ruleset/TestRuleset.ts"
import { expect } from "vitest"
import type { SubmittedActionTargetsDto } from "#api/gameplay/SubmittedActionTargetsDto.ts"
import type { PlayerView } from "#api/types.ts"
import { Clock } from "#lib/Clock.ts"
import { ControlledClock } from "#lib/ControlledClock.ts"
import { RulesetsRepository } from "#lib/rulesets/rulesets.repository.ts"
import type { AuthenticatedApiClient } from "#tests/ApiClient.ts"
import type { ConcurrencyTestApiServer } from "#tests/ConcurrencyTestApiServer.ts"
import { createTurnProcessorStub } from "#turn-processing/TurnProcessor.stub.ts"
import { getPlanets, getHome, getFleetAt, processTurn } from "./gameplay.colonization.scenarios.ts"

export const MANUAL_TURN_INTERVAL = Time.create(1, UnitOfTime.HOURS)

export const MANUAL_CLOCK_ADVANCE = Time.create(2, UnitOfTime.HOURS)

export const PUBLIC_COLONIZATION_FIXTURE_RULESET_ID = "test_public_colonization_routes"

export const PUBLIC_NATURAL_COLONIZATION_RULESET_ID = "test_public_natural_colonization"

export const SeedOutpost: ActionDefinition = typedParse(ActionDefinitionSchema, {
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

export const SeedOutpostHere: ActionDefinition = typedParse(ActionDefinitionSchema, {
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

export const BuildFleet20ForExactColonize = createFixtureBuildFleetAction({ id: "FIXTURE_BUILD20_EXACT", strength: 20 })

export const PublicNaturalColonizationRuleset = Ruleset.create({
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

export const PublicBudgetBuild35: ActionDefinition = typedParse(ActionDefinitionSchema, {
  ...BuildFleetStandard,
  id: "FIXTURE_PUBLIC_BUDGET_BUILD35",
  name: "Public Budget Build 35",
  costs: [],
  effects: [FleetBuildEffectDefinition.create({ planetTag: "planet", strength: 35 })],
})

export const PublicBudgetBuild5: ActionDefinition = typedParse(ActionDefinitionSchema, {
  ...BuildFleetStandard,
  id: "FIXTURE_PUBLIC_BUDGET_BUILD5",
  name: "Public Budget Build 5",
  costs: [],
  effects: [FleetBuildEffectDefinition.create({ planetTag: "planet", strength: 5 })],
})

export const PublicBudgetBuild30: ActionDefinition = typedParse(ActionDefinitionSchema, {
  ...BuildFleetStandard,
  id: "FIXTURE_PUBLIC_BUDGET_BUILD30",
  name: "Public Budget Build 30",
  costs: [],
  effects: [FleetBuildEffectDefinition.create({ planetTag: "planet", strength: 30 })],
})

export const PublicBudgetStageFleet: ActionDefinition = typedParse(ActionDefinitionSchema, {
  ...MoveFleetStandard,
  id: "FIXTURE_PUBLIC_BUDGET_STAGE_FLEET",
  name: "Public Budget Stage Fleet",
  costs: [],
  effects: [FleetMoveEffectDefinition.create({ fleetTag: "fleet", planetTag: "planet", strengthTag: "strength", speed: 10 })],
})

export const PublicBudgetSecondColonizeHere: ActionDefinition = typedParse(ActionDefinitionSchema, {
  ...ColonizeHereTest,
  id: "FIXTURE_BUDGET_COLONIZE_HERE_2",
  name: "Public Budget Colonize Here 2",
})

export const PublicColonizationBudgetRuleset = Ruleset.create({
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

export const PublicStationarySeedOutpostRuleset = Ruleset.create({
  ...PublicColonizationBudgetRuleset,
  id: "test_public_stationary_seed_outpost",
  name: "Public Stationary Seed Outpost Fixture",
  actionDefinitions: indexBy("id", [...Object.values(PublicColonizationBudgetRuleset.actionDefinitions), SeedOutpostHere]),
  actionPool: [...PublicColonizationBudgetRuleset.actionPool, { id: "TEST_SEED_OUTPOST_HERE_1", actionDefinitionId: SeedOutpostHere.id }],
})

export function createFixtureBuildFleetAction(input: { id: string; strength: number }): ActionDefinition {
  return typedParse(ActionDefinitionSchema, {
    ...BuildFleetStandard,
    id: input.id,
    name: `Fixture Build ${input.strength}`,
    effects: [FleetBuildEffectDefinition.create({ planetTag: "planet", strength: input.strength })],
  })
}

export function createFixtureMoveFleetAction(input: { id: string; speed: number }): ActionDefinition {
  return typedParse(ActionDefinitionSchema, {
    ...MoveFleetExceptional,
    id: input.id,
    name: `Fixture Move ${input.speed}`,
    effects: [FleetMoveEffectDefinition.create({ fleetTag: "fleet", planetTag: "planet", strengthTag: "strength", speed: input.speed })],
  })
}

export function createFixtureColonizeAction(input: { id: string; speed: number }): ActionDefinition {
  return typedParse(ActionDefinitionSchema, {
    ...ColonizePlanetTest,
    id: input.id,
    name: `Fixture Colonize ${input.speed}`,
    effects: [
      FleetMoveEffectDefinition.create({ fleetTag: "fleet", planetTag: "planet", strengthTag: "strength", speed: input.speed }),
      FleetColonizeEffectDefinition.create({ fleetTag: "fleet", planetTag: "planet", strengthRequirement: 20 }),
    ],
  })
}

export const BuildFleet10ForStaging = createFixtureBuildFleetAction({ id: "FIXTURE_BUILD_FLEET_10_STAGING", strength: 10 })

export const BuildFleet16ForStaging = createFixtureBuildFleetAction({ id: "FIXTURE_BUILD_FLEET_16_STAGING", strength: 16 })

export const BuildFleet10ForRoute = createFixtureBuildFleetAction({ id: "FIXTURE_BUILD_FLEET_10_ROUTE", strength: 10 })

export const BuildFleet35 = createFixtureBuildFleetAction({ id: "FIXTURE_BUILD_FLEET_35", strength: 35 })

export const BuildFleet48 = createFixtureBuildFleetAction({ id: "FIXTURE_BUILD_FLEET_48", strength: 48 })

export const BuildFleet50 = createFixtureBuildFleetAction({ id: "FIXTURE_BUILD_FLEET_50", strength: 50 })

export const BuildFleet70 = createFixtureBuildFleetAction({ id: "FIXTURE_BUILD_FLEET_70", strength: 70 })

export const MoveFleetSpeed10 = createFixtureMoveFleetAction({ id: "FIXTURE_MOVE_FLEET_SPEED_10", speed: 10 })

export const ColonizeFleetSpeed2 = createFixtureColonizeAction({ id: "FIXTURE_COLONIZE_FLEET_SPEED_2", speed: 2 })

export const ColonizeFleetSpeed4 = createFixtureColonizeAction({ id: "FIXTURE_COLONIZE_FLEET_SPEED_4", speed: 4 })

export const ColonizeFleetSpeed01 = createFixtureColonizeAction({ id: "FIXTURE_COLONIZE_FLEET_SPEED_01", speed: 0.1 })

export const ColonizeFarFleetSpeed5: ActionDefinition = typedParse(ActionDefinitionSchema, {
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

export const deadEarlierAttackPlanetTarget = required(AttackMoveTest.targets[branded<TargetTag>("planet")])

export const DeadEarlierAttackColonize: ActionDefinition = typedParse(ActionDefinitionSchema, {
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

export const ComposedSuccessAttackColonize: ActionDefinition = typedParse(ActionDefinitionSchema, {
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

export const DeadFarAttackColonize: ActionDefinition = typedParse(ActionDefinitionSchema, {
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

export const publicColonizationFixtureActions = [
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

export const PublicColonizationFixtureRuleset = Ruleset.create({
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

export type PublicClient = AuthenticatedApiClient

export function logReceipt(label: string, receipt: unknown): void {
  Logger.get().info(`${label} ${JSON.stringify(receipt)}`)
}

export function required<T>(value: T | null | undefined): T {
  Assert.isDefined(value)
  return value
}

export function playerIdFor(client: AuthenticatedApiClient): PlayerId {
  return typedParse(PlayerIdSchema, client.account.id)
}

export type PublicPlanet = PlayerView["galaxy"]["systems"][number]["planets"][number]

export type PublicFleet = PlayerView["fleets"][number]

export type PublicFleetMatchView = {
  id: string
  ownerPlayerId: string
  originPlanetId: string
  destinationPlanetId?: string | undefined
  strength: number
  movement?: { submission: { id: string } } | undefined
  arrivedAtTick?: number | undefined
}

export type PublicFleetMatch = Readonly<{
  fleetId?: PublicFleet["id"]
  ownerPlayerId?: PlayerId
  originPlanetId?: PublicPlanet["id"]
  destinationPlanetId?: PublicPlanet["id"]
  strength?: number
  movementSubmissionId?: string
  arrivedAtTick?: number
  stationary?: boolean
}>

export function matchesPublicFleet(fleet: PublicFleetMatchView, match: PublicFleetMatch): boolean {
  const fields: ReadonlyArray<readonly [unknown, unknown]> = [
    [match.fleetId, fleet.id],
    [match.ownerPlayerId, fleet.ownerPlayerId],
    [match.originPlanetId, fleet.originPlanetId],
    [match.destinationPlanetId, fleet.destinationPlanetId],
    [match.strength, fleet.strength],
    [match.movementSubmissionId, fleet.movement?.submission.id],
    [match.arrivedAtTick, fleet.arrivedAtTick],
  ]
  return (
    fields.every(([expected, actual]) => expected === undefined || expected === actual) &&
    (match.stationary !== true || fleet.movement === undefined)
  )
}

export function findPublicFleet<T extends PublicFleetMatchView>(fleets: readonly T[], match: PublicFleetMatch): T | undefined {
  return fleets.find((fleet) => matchesPublicFleet(fleet, match))
}

export function hasResolvedResult(outcome: EffectOutcome, phrase: string): boolean {
  return outcome.type === "RESOLVED" && outcome.result.includes(phrase)
}

export function hasPreventedReason(outcome: EffectOutcome, phrase: string): boolean {
  return outcome.type === "PREVENTED" && outcome.reason.includes(phrase)
}

export function describeOutcome(outcome: EffectOutcome): string {
  return outcome.type === "RESOLVED" ? outcome.result : outcome.reason
}

export function findPlayerAction<T extends { id: string; playerId: PlayerId }>(
  actions: readonly T[],
  actionId: string,
  playerId: PlayerId,
): T | undefined {
  return actions.find((action) => action.id === actionId && action.playerId === playerId)
}

export function isColonizeDefinitionId(actionDefinitionId: ActionDefinitionId): boolean {
  return actionDefinitionId === ColonizeHereTest.id || actionDefinitionId === PublicBudgetSecondColonizeHere.id
}

export function hasPreventedOrColonized(outcome: EffectOutcome): boolean {
  return outcome.type === "PREVENTED" || hasResolvedResult(outcome, " colonized Planet ")
}

export function findResolvedAction<T extends { submittedAction: { id: string; playerId: PlayerId } }>(
  actions: readonly T[],
  actionId: string,
  playerId: PlayerId,
): T | undefined {
  return actions.find(({ submittedAction }) => submittedAction.id === actionId && submittedAction.playerId === playerId)
}

export function describeOutcomeRecord(outcome: EffectOutcome): EffectOutcome {
  return outcome.type === "RESOLVED" ? { type: outcome.type, result: outcome.result } : { type: outcome.type, reason: outcome.reason }
}

export function isUnselectedActionWithDefinition(
  action: IsUnselectedActionWithDefinitionInput1,
  actionDefinitionId: ActionDefinitionId,
): boolean {
  return action.actionDefinitionId === actionDefinitionId && action.selectedTargets === null
}

export function isActionSelected(action: IsActionSelectedInput): boolean {
  return action.selectedTargets !== null
}

export function startTogether(parties: number): () => Promise<void> {
  let release: () => void = noop
  const released = new Promise<void>((resolve) => {
    release = resolve
  })
  let arrivals = 0
  return async (): Promise<void> => {
    arrivals += 1
    if (arrivals === parties) {
      release()
    }
    await released
  }
}

export type PublicTurnProcessor = Awaited<ReturnType<typeof createTurnProcessorStub>>

export type PublicNaturalRouteFixture = {
  player: PublicClient
  gameId: number
  clock: ControlledClock
  turnProcessor: PublicTurnProcessor["turnProcessor"]
  turnsRepository: PublicTurnProcessor["turnsRepository"]
  view: PlayerView
  home: PublicPlanet
  target: PublicPlanet
}

export type PublicTwoPlayerFixture = {
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

export async function submitAction(input: SubmitActionInput): Promise<string> {
  const action = input.view.actions.find(({ actionDefinitionId: candidate }) => candidate === input.actionDefinitionId)
  Assert.isDefined(action)
  await input.client.gameplay.updateActionSubmission.mutate({
    gameId: input.gameId,
    turn: input.view.turn,
    submittedActionTargets: { actionId: action.id, selectedTargets: input.selectedTargets, selectedInputs: input.selectedInputs },
  })
  return action.id
}

export async function readViews(clients: readonly PublicClient[], gameId: number): Promise<PlayerView[]> {
  return await Promise.all(clients.map(async ({ client }) => await client.gameplay.getPlayerView.query({ gameId })))
}

export async function createPublicTwoPlayerFixture(server: ConcurrencyTestApiServer): Promise<PublicTwoPlayerFixture> {
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
  const clock = new ControlledClock({ startDate: Clock.now() })
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

export async function createPublicNaturalRouteFixture(
  server: ConcurrencyTestApiServer,
  accountId: string,
): Promise<PublicNaturalRouteFixture> {
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
  const clock = new ControlledClock({ startDate: Clock.now() })
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

export async function publiclyBuildFleetToFifty(fixture: PublicNaturalRouteFixture): Promise<PubliclyBuildFleetToFiftyResult> {
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

export type PublicStagedMergeScenario = {
  fixture: PublicTwoPlayerFixture
  views: PlayerView[]
  stagedFriendly: PublicFleet
  bobAtSource: PublicFleet
  aliceSource: PublicFleet
  bobStageActionId: string
}

type IsUnselectedActionWithDefinitionInput1 = { actionDefinitionId: ActionDefinitionId; selectedTargets: unknown }

type IsActionSelectedInput = { selectedTargets: unknown }

type SubmitActionInput = {
  client: AuthenticatedApiClient["client"]
  gameId: number
  view: PlayerView
  actionDefinitionId: ActionDefinitionId
  selectedTargets: DeepUnbranded<SubmittedActionTargetsDto["selectedTargets"]>
  selectedInputs: DeepUnbranded<SubmittedActionTargetsDto["selectedInputs"]>
}

type PubliclyBuildFleetToFiftyResult = { view: PlayerView; fleet: PublicFleet }
