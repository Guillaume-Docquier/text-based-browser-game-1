import { type RngState, Assert, indexBy } from "@guillaume-docquier/tools-ts"
import { typedParse } from "@guillaume-docquier/tools-ts/schemas"
import { expect } from "vitest"
import { type GameId, GameIdSchema } from "#shared/domain/games/GameId.ts"
import type { PlayerId } from "#shared/domain/players/PlayerId.ts"
import { createResourcesStub } from "#shared/domain/resources/Resources.stub.ts"
import { ResourceType } from "#shared/domain/resources/ResourceType.ts"
import {
  type ActionDefinition as ScenarioActionDefinition,
  ActionDefinitionSchema,
} from "#shared/domain/ruleset/action-definitions/ActionDefinition.ts"
import type { ActionDefinitionId } from "#shared/domain/ruleset/action-definitions/ActionDefinitionId.ts"
import type { InputTag } from "#shared/domain/ruleset/action-definitions/InputTag.ts"
import type { PositiveInteger } from "#shared/domain/ruleset/action-definitions/PositiveInteger.ts"
import type { TargetTag } from "#shared/domain/ruleset/action-definitions/TargetTag.ts"
import { FleetAssaultEffectDefinition } from "#shared/domain/ruleset/effect-definitions/FleetAssaultEffectDefinition.ts"
import { FleetColonizeEffectDefinition } from "#shared/domain/ruleset/effect-definitions/FleetColonizeEffectDefinition.ts"
import { FleetMoveEffectDefinition } from "#shared/domain/ruleset/effect-definitions/FleetMoveEffectDefinition.ts"
import { Ruleset } from "#shared/domain/ruleset/Ruleset.ts"
import type { TargetId } from "#shared/domain/ruleset/target-definitions/TargetId.ts"
import { createSubmittedActionStub } from "#shared/domain/turns/actions/Action.stub.ts"
import type { Action } from "#shared/domain/turns/actions/Action.ts"
import { type ActionId, ActionIdSchema } from "#shared/domain/turns/actions/ActionId.ts"
import type { createFleetStub } from "#shared/domain/world/fleets/Fleet.stub.ts"
import { FleetSchema } from "#shared/domain/world/fleets/Fleet.ts"
import type { FleetId } from "#shared/domain/world/fleets/FleetId.ts"
import type { createPlanetStub } from "#shared/domain/world/planets/Planet.stub.ts"
import type { PlanetId } from "#shared/domain/world/planets/PlanetId.ts"
import { createSeededRng } from "#shared/testing/createSeededRng.ts"
import { AttackMoveTest } from "#shared/testing/test-ruleset/action-definitions/attack-move.ts"
import { ColonizePlanetTest, SeedOutpostTest } from "#shared/testing/test-ruleset/action-definitions/colonize.ts"
import { MoveFleetStandard } from "#shared/testing/test-ruleset/action-definitions/move-fleet.ts"
import { TestRuleset } from "#shared/testing/test-ruleset/TestRuleset.ts"
import { EffectPool } from "#shared/turn-resolution/effects/EffectPool.ts"
import { resolveFleetMovementPhase } from "#shared/turn-resolution/phases/implementations/resolveFleetMovementPhase.ts"
import type { ResolvedTurnState } from "#shared/turn-resolution/ResolvedTurnState.ts"
import { resolveTurn } from "#shared/turn-resolution/resolveTurn.ts"
import type { ResolutionFleet } from "#shared/turn-resolution/state/ResolutionFleet.ts"
import type { ResolutionPlayer } from "#shared/turn-resolution/state/ResolutionPlayer.ts"
import type { TurnContext } from "#shared/turn-resolution/TurnContext.ts"
import { createTurnStateStub } from "#shared/turn-resolution/TurnState.stub.ts"
import { assertDeparture } from "./fleet-colonization.assertions-2.test-support.ts"
import {
  assertColonizeEvaluation,
  assertIncompleteForce,
  assertScenarioState2,
  assertTurnTwoJourneys,
} from "./fleet-colonization.assertions.test-support.ts"
import {
  PLAYER_A,
  PLAYER_B,
  PLAYER_C,
  findJourneyForSubmission,
  createRuleset,
  resolve,
  planet,
  fleet,
  submit,
  fleetAtPlanetForOwner,
} from "./fleet-colonization.test-support.ts"

export function createColonizeSetup(): CreateColonizeSetupResult {
  const colonize = typedParse(ActionDefinitionSchema, {
    ...ColonizePlanetTest,
    id: "TEST_I4_SPEED_TWO_COLONIZE",
    name: "I4 Speed Two Colonize",
    effects: [
      FleetMoveEffectDefinition.create({ fleetTag: "fleet", planetTag: "planet", strengthTag: "strength", speed: 2 }),
      FleetColonizeEffectDefinition.create({ fleetTag: "fleet", planetTag: "planet", strengthRequirement: 20 }),
    ],
  })
  const ordinaryMove = typedParse(ActionDefinitionSchema, {
    ...MoveFleetStandard,
    id: "TEST_I4_SPEED_TWO_MOVE",
    name: "I4 Speed Two Move",
    effects: [FleetMoveEffectDefinition.create({ fleetTag: "fleet", planetTag: "planet", strengthTag: "strength", speed: 2 })],
  })
  const attackMove = typedParse(ActionDefinitionSchema, {
    ...AttackMoveTest,
    id: "TEST_I4_SPEED_TWO_ATTACK_MOVE",
    name: "I4 Speed Two Attack Move",
    effects: [
      FleetMoveEffectDefinition.create({ fleetTag: "fleet", planetTag: "planet", strengthTag: "strength", speed: 2 }),
      FleetAssaultEffectDefinition.create({ fleetTag: "fleet", planetTag: "planet" }),
    ],
  })
  const colonizeActionId = typedParse(ActionIdSchema, "I4_COLONIZE_1")
  const moveActionId = typedParse(ActionIdSchema, "I4_MOVE_1")
  const attackActionId = typedParse(ActionIdSchema, "I4_ATTACK_MOVE_1")
  const ruleset = Ruleset.create({
    ...TestRuleset,
    actionDefinitions: {
      ...TestRuleset.actionDefinitions,
      [colonize.id]: colonize,
      [ordinaryMove.id]: ordinaryMove,
      [attackMove.id]: attackMove,
    },
    actionPool: [
      { id: colonizeActionId, actionDefinitionId: colonize.id },
      { id: moveActionId, actionDefinitionId: ordinaryMove.id },
      { id: attackActionId, actionDefinitionId: attackMove.id },
    ],
  })
  const gameId = typedParse(GameIdSchema, 74)
  const playerIds = [PLAYER_A, PLAYER_B, PLAYER_C]
  return { colonize, ordinaryMove, attackMove, colonizeActionId, moveActionId, attackActionId, ruleset, gameId, playerIds }
}

export type CreateColonizeSetupResult = {
  colonize: ScenarioActionDefinition
  ordinaryMove: ScenarioActionDefinition
  attackMove: ScenarioActionDefinition
  colonizeActionId: ActionId
  moveActionId: ActionId
  attackActionId: ActionId
  ruleset: Ruleset
  gameId: GameId
  playerIds: PlayerId[]
}

export function createInitialPlayersSetup(input: CreateInitialPlayersSetupInput): CreateInitialPlayersSetupResult {
  const initialPlayers = indexBy(
    "id",
    input.playerIds.map((id) => ({
      id,
      resources: createResourcesStub({
        [ResourceType.INFLUENCE]: 100,
        [ResourceType.METAL]: 0,
        [ResourceType.FUEL]: 10,
        [ResourceType.ENERGY]: 0,
        [ResourceType.COLONY]: 7,
      }),
    })),
  )
  const aHome = planet("i4-a-home", PLAYER_A, 0)
  const bHome = planet("i4-b-home", PLAYER_B, -0.5)
  const cHome = planet("i4-c-home", PLAYER_C, -0.25)
  const p = planet("i4-destination-p", null, 4.5)
  const q = planet("i4-destination-q", null, 5)
  const outsideRange = planet("i4-outside-range", null, 5.001)
  const planets = [aHome, bHome, cHome, p, q, outsideRange]
  const aSource = fleet("i4-a-source", PLAYER_A, aHome, 70)
  const bSource = fleet("i4-b-source", PLAYER_B, bHome, 35)
  const cSource = fleet("i4-c-source", PLAYER_C, cHome, 16)
  const fleets = [aSource, bSource, cSource]
  const aColonize = submit({
    id: input.colonizeActionId,
    playerId: PLAYER_A,
    actionDefinitionId: input.colonize.id,
    source: aSource,
    target: p,
    strength: 35,
  })
  const aMove = submit({
    id: input.moveActionId,
    playerId: PLAYER_A,
    actionDefinitionId: input.ordinaryMove.id,
    source: aSource,
    target: q,
    strength: 15,
  })
  const bColonize = submit({
    id: input.colonizeActionId,
    playerId: PLAYER_B,
    actionDefinitionId: input.colonize.id,
    source: bSource,
    target: p,
    strength: 35,
  })
  return { initialPlayers, p, q, outsideRange, planets, aSource, bSource, cSource, fleets, aColonize, aMove, bColonize }
}

export type CreateInitialPlayersSetupInput = {
  playerIds: PlayerId[]
  colonizeActionId: ActionId
  colonize: ScenarioActionDefinition
  moveActionId: ActionId
  ordinaryMove: ScenarioActionDefinition
}

export type CreateInitialPlayersSetupResult = {
  initialPlayers: Record<PlayerId, { id: PlayerId; resources: ReturnType<typeof createResourcesStub> }>
  p: ReturnType<typeof createPlanetStub>
  q: ReturnType<typeof createPlanetStub>
  outsideRange: ReturnType<typeof createPlanetStub>
  planets: Array<ReturnType<typeof createPlanetStub>>
  aSource: ReturnType<typeof createFleetStub>
  bSource: ReturnType<typeof createFleetStub>
  cSource: ReturnType<typeof createFleetStub>
  fleets: Array<ReturnType<typeof createFleetStub>>
  aColonize: Readonly<{
    id: ActionId
    playerId: PlayerId
    actionDefinitionId: ActionDefinitionId
    selectedTargets: Readonly<Record<TargetTag, TargetId>>
    selectedInputs: Readonly<Record<InputTag, PositiveInteger>>
  }>
  aMove: Readonly<{
    id: ActionId
    playerId: PlayerId
    actionDefinitionId: ActionDefinitionId
    selectedTargets: Readonly<Record<TargetTag, TargetId>>
    selectedInputs: Readonly<Record<InputTag, PositiveInteger>>
  }>
  bColonize: Readonly<{
    id: ActionId
    playerId: PlayerId
    actionDefinitionId: ActionDefinitionId
    selectedTargets: Readonly<Record<TargetTag, TargetId>>
    selectedInputs: Readonly<Record<InputTag, PositiveInteger>>
  }>
}

export function createDepartureSetup(input: CreateDepartureSetupInput): CreateDepartureSetupResult {
  const initialA = input.eligibilityState(PLAYER_A, 1, input.initialPlayers, input.planets, input.fleets)

  assertColonizeEvaluation({ ...input, initialA })

  assertIncompleteForce({ ...input, initialA })

  const firstRng = createSeededRng(1234)
  const firstResult = resolveTurn(
    createTurnStateStub({
      gameId: input.gameId,
      turn: 1,
      submittedActions: [input.aColonize, input.aMove, input.bColonize, input.cAttack],
      players: structuredClone(input.initialPlayers),
      planets: indexBy("id", structuredClone(input.planets)),
      fleets: indexBy("id", structuredClone(input.fleets)),
    }),
    input.ruleset,
    firstRng,
  )
  Assert.isSuccess(firstResult)
  const departure = firstResult.value
  const firstRngState = firstRng.getState()
  return { departure, firstRngState }
}

export type CreateDepartureSetupInput = {
  eligibilityState: EligibilityStateCallback
  initialPlayers: Record<PlayerId, { id: PlayerId; resources: ReturnType<typeof createResourcesStub> }>
  planets: Array<ReturnType<typeof createPlanetStub>>
  fleets: Array<ReturnType<typeof createFleetStub>>
  ruleset: Ruleset
  colonizeActionId: ActionId
  aSource: ReturnType<typeof createFleetStub>
  p: ReturnType<typeof createPlanetStub>
  aColonize: Readonly<{
    id: ActionId
    playerId: PlayerId
    actionDefinitionId: ActionDefinitionId
    selectedTargets: Readonly<Record<TargetTag, TargetId>>
    selectedInputs: Readonly<Record<InputTag, PositiveInteger>>
  }>
  moveActionId: ActionId
  q: ReturnType<typeof createPlanetStub>
  outsideRange: ReturnType<typeof createPlanetStub>
  aMove: Readonly<{
    id: ActionId
    playerId: PlayerId
    actionDefinitionId: ActionDefinitionId
    selectedTargets: Readonly<Record<TargetTag, TargetId>>
    selectedInputs: Readonly<Record<InputTag, PositiveInteger>>
  }>
  ordinaryMove: ScenarioActionDefinition
  bColonize: Readonly<{
    id: ActionId
    playerId: PlayerId
    actionDefinitionId: ActionDefinitionId
    selectedTargets: Readonly<Record<TargetTag, TargetId>>
    selectedInputs: Readonly<Record<InputTag, PositiveInteger>>
  }>
  cAttack: Readonly<{
    id: ActionId
    playerId: PlayerId
    actionDefinitionId: ActionDefinitionId
    selectedTargets: Readonly<Record<TargetTag, TargetId>>
    selectedInputs: Readonly<Record<InputTag, PositiveInteger>>
  }>
  gameId: GameId
}

export type CreateDepartureSetupResult = { departure: ResolvedTurnState; firstRngState: RngState<unknown> }

export function createAColonizeJourneySetup(input: CreateAColonizeJourneySetupInput): CreateAColonizeJourneySetupResult {
  const aColonizeJourney = findJourneyForSubmission(input.departure, PLAYER_A, input.colonizeActionId)
  const aMoveJourney = findJourneyForSubmission(input.departure, PLAYER_A, input.moveActionId)
  const bColonizeJourney = findJourneyForSubmission(input.departure, PLAYER_B, input.colonizeActionId)
  const cAttackJourney = findJourneyForSubmission(input.departure, PLAYER_C, input.attackActionId)

  assertScenarioState2({ ...input, aColonizeJourney, aMoveJourney, bColonizeJourney, cAttackJourney })

  const turnTwoJourneys = [
    findJourneyForSubmission(input.turnTwo, PLAYER_A, input.colonizeActionId),
    findJourneyForSubmission(input.turnTwo, PLAYER_A, input.moveActionId),
    findJourneyForSubmission(input.turnTwo, PLAYER_B, input.colonizeActionId),
    findJourneyForSubmission(input.turnTwo, PLAYER_C, input.attackActionId),
  ]
  const journeyActionBindings = [
    { playerId: PLAYER_A, actionId: input.colonizeActionId, freeMoveActionId: input.attackActionId },
    { playerId: PLAYER_A, actionId: input.moveActionId, freeMoveActionId: input.attackActionId },
    { playerId: PLAYER_B, actionId: input.colonizeActionId, freeMoveActionId: input.moveActionId },
    { playerId: PLAYER_C, actionId: input.attackActionId, freeMoveActionId: input.colonizeActionId },
  ]
  expect(turnTwoJourneys.map(({ strength, distanceToEnd }) => ({ strength, distanceToEnd }))).toStrictEqual([
    { strength: 35, distanceToEnd: 0.5 },
    { strength: 15, distanceToEnd: 1 },
    { strength: 35, distanceToEnd: 1 },
    { strength: 16, distanceToEnd: 0.75 },
  ])
  const preCombatState = createTurnStateStub({
    gameId: input.turnTwo.gameId,
    turn: 3,
    players: structuredClone(input.turnTwo.players),
    planets: structuredClone(input.turnTwo.planets),
    fleets: indexBy(
      "id",
      Object.values(input.turnTwo.fleets).map((fleetValue) => FleetSchema.parse(JSON.parse(JSON.stringify(fleetValue)))),
    ),
  })
  return { aColonizeJourney, bColonizeJourney, cAttackJourney, turnTwoJourneys, journeyActionBindings, preCombatState }
}

export type CreateAColonizeJourneySetupInput = {
  departure: ResolvedTurnState
  colonizeActionId: ActionId
  moveActionId: ActionId
  attackActionId: ActionId
  aSource: ReturnType<typeof createFleetStub>
  bSource: ReturnType<typeof createFleetStub>
  cSource: ReturnType<typeof createFleetStub>
  strengthTotal: (state: ResolvedTurnState) => number
  turnTwo: ResolvedTurnState
}

export type CreateAColonizeJourneySetupResult = {
  aColonizeJourney: ReturnType<typeof createFleetStub>
  bColonizeJourney: ReturnType<typeof createFleetStub>
  cAttackJourney: ReturnType<typeof createFleetStub>
  turnTwoJourneys: Array<ReturnType<typeof createFleetStub>>
  journeyActionBindings: Array<{ playerId: PlayerId; actionId: ActionId; freeMoveActionId: ActionId }>
  preCombatState: ReturnType<typeof createTurnStateStub>
}

export function createAAtPSetup(input: CreateAAtPSetupInput): CreateAAtPSetupResult {
  const preCombatContext: TurnContext = {
    rng: createSeededRng(1234),
    turnState: input.preCombatState,
    effectPool: new EffectPool([]),
    ruleset: input.ruleset,
    previousJourneyFleetIds: input.turnTwoJourneys.map(({ id }) => id),
    newDepartureFleetIds: new Set(),
    removedFleetIds: new Set(),
    changedPlanetIds: new Set(),
    resolvedContinuations: [],
    pendingArrivalAssaults: [],
    pendingArrivalColonizations: [],
    fleetIdRebindings: new Map(),
  }
  Assert.isSuccess(resolveFleetMovementPhase(preCombatContext))

  assertTurnTwoJourneys({ ...input, preCombatContext })

  const aAtP = fleetAtPlanetForOwner(input.afterArrival, input.p.id, PLAYER_A)
  const aAtQ = fleetAtPlanetForOwner(input.afterArrival, input.q.id, PLAYER_A)
  const bAtP = fleetAtPlanetForOwner(input.afterArrival, input.p.id, PLAYER_B)
  Assert.isDefined(aAtP)
  Assert.isDefined(aAtQ)
  Assert.isDefined(bAtP)
  return { aAtP, aAtQ, bAtP }
}

export type CreateAAtPSetupInput = {
  preCombatState: ReturnType<typeof createTurnStateStub>
  ruleset: Ruleset
  turnTwoJourneys: Array<ReturnType<typeof createFleetStub>>
  cAttackJourney: ReturnType<typeof createFleetStub>
  p: ReturnType<typeof createPlanetStub>
  attackActionId: ActionId
  strengthTotal: (state: ResolvedTurnState) => number
  turnTwo: ResolvedTurnState
  departure: ResolvedTurnState
  journeyActionBindings: Array<{ playerId: PlayerId; actionId: ActionId; freeMoveActionId: ActionId }>
  eligibilityState: EligibilityStateCallback
  aSource: ReturnType<typeof createFleetStub>
  afterArrival: ResolvedTurnState
  q: ReturnType<typeof createPlanetStub>
}

export type CreateAAtPSetupResult = {
  aAtP: ReturnType<typeof createFleetStub>
  aAtQ: ReturnType<typeof createFleetStub>
  bAtP: ReturnType<typeof createFleetStub>
}

export function createRulesetSetup(): CreateRulesetSetupResult {
  const ruleset = createRuleset(
    [SeedOutpostTest],
    [
      { id: "SEED_OUTPOST_FULL_1", actionDefinitionId: SeedOutpostTest.id },
      { id: "SEED_OUTPOST_EDGE_1", actionDefinitionId: SeedOutpostTest.id },
    ],
  )
  const origin = planet("seed-outpost-origin", PLAYER_A, 0)
  const target = planet("seed-outpost-site", null, 2.5)
  const source = fleet("seed-outpost-force", PLAYER_A, origin, 50)
  const action = createSubmittedActionStub({
    id: "SEED_OUTPOST_FULL_1",
    playerId: PLAYER_A,
    actionDefinitionId: SeedOutpostTest.id,
    selectedTargets: { force: source.id, site: target.id },
    selectedInputs: { quota: 45 },
  })
  const departure = resolve({ planets: [origin, target], fleets: [source], submissions: [action], ruleset })
  const journey = Object.values(departure.fleets).find(({ movement }) => movement !== undefined)
  Assert.isDefined(journey)

  assertDeparture({ departure, target, source, journey, ruleset })

  const edgeOrigin = planet("seed-outpost-edge-origin", PLAYER_A, 0)
  const edgeSite = planet("seed-outpost-range-edge", null, 3)
  const edgeSource = fleet("seed-outpost-edge-force", PLAYER_A, edgeOrigin, 30)
  const edgeAction = createSubmittedActionStub({
    id: "SEED_OUTPOST_EDGE_1",
    playerId: PLAYER_A,
    actionDefinitionId: SeedOutpostTest.id,
    selectedTargets: { force: edgeSource.id, site: edgeSite.id },
    selectedInputs: { quota: 30 },
  })
  const edgeDeparture = resolve({
    planets: [edgeOrigin, edgeSite],
    fleets: [edgeSource],
    submissions: [edgeAction],
    ruleset,
  })
  const edgeJourney = Object.values(edgeDeparture.fleets).find(({ movement }) => movement !== undefined)
  Assert.isDefined(edgeJourney)
  expect(edgeDeparture.planets[edgeSite.id]?.ownerPlayerId).toBeNull()
  expect(edgeDeparture.fleets[edgeSource.id]).toBeUndefined()
  expect(edgeJourney).toMatchObject({ strength: 30, distanceToEnd: 1, movement: { speed: 2, departureTurn: 1 } })
  expect(edgeDeparture.players[PLAYER_A]?.resources).toMatchObject({
    [ResourceType.INFLUENCE]: 43,
    [ResourceType.FUEL]: 98,
  })
  return { ruleset, edgeSite, edgeDeparture, edgeJourney }
}

export type CreateRulesetSetupResult = {
  ruleset: Ruleset
  edgeSite: ReturnType<typeof createPlanetStub>
  edgeDeparture: ResolvedTurnState
  edgeJourney: ResolutionFleet
}

type EligibilityStateCallback = (
  playerId: PlayerId,
  turn: number,
  players: Readonly<Record<PlayerId, ResolutionPlayer>>,
  currentPlanets: ReadonlyArray<Pick<ReturnType<typeof createPlanetStub>, "id" | "ownerPlayerId" | "x" | "y">>,
  currentFleets: ReadonlyArray<ReturnType<typeof createFleetStub>>,
) => Readonly<{
  gameId: GameId
  turn: number
  submittingPlayerId: PlayerId
  resources: Readonly<ReturnType<typeof createResourcesStub>>
  players: Readonly<Record<PlayerId, Readonly<{ id: PlayerId; ownerPlayerId: PlayerId }>>>
  planets: Readonly<Record<PlanetId, Readonly<{ id: PlanetId; ownerPlayerId: null | PlayerId; x: number; y: number }>>>
  fleets: Readonly<Record<FleetId, ReturnType<typeof createFleetStub>>>
  actions: readonly Action[]
}>
