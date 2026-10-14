import { Assert, branded, indexBy } from "@guillaume-docquier/tools-ts"
import { typedParse } from "@guillaume-docquier/tools-ts/schemas"
import type { ActionSelectionDraft, EligibilityState } from "#shared/action-submission/evaluateActionSelection.ts"
import { GameIdSchema } from "#shared/domain/games/GameId.ts"
import { NonNegativeSafeIntegerSchema } from "#shared/domain/NonNegativeSafeInteger.ts"
import { PlayerIdSchema, type PlayerId } from "#shared/domain/players/PlayerId.ts"
import { createResourcesStub } from "#shared/domain/resources/Resources.stub.ts"
import { ResourceType } from "#shared/domain/resources/ResourceType.ts"
import { ActionDefinitionSchema, type ActionDefinition } from "#shared/domain/ruleset/action-definitions/ActionDefinition.ts"
import type { InputTag } from "#shared/domain/ruleset/action-definitions/InputTag.ts"
import { PositiveIntegerSchema } from "#shared/domain/ruleset/action-definitions/PositiveInteger.ts"
import type { TargetTag } from "#shared/domain/ruleset/action-definitions/TargetTag.ts"
import { FleetAssaultEffectDefinition } from "#shared/domain/ruleset/effect-definitions/FleetAssaultEffectDefinition.ts"
import { FleetColonizeEffectDefinition } from "#shared/domain/ruleset/effect-definitions/FleetColonizeEffectDefinition.ts"
import { FleetMoveEffectDefinition } from "#shared/domain/ruleset/effect-definitions/FleetMoveEffectDefinition.ts"
import { Ruleset } from "#shared/domain/ruleset/Ruleset.ts"
import type { TargetId } from "#shared/domain/ruleset/target-definitions/TargetId.ts"
import { createSubmittedActionStub } from "#shared/domain/turns/actions/Action.stub.ts"
import type { ActionId } from "#shared/domain/turns/actions/ActionId.ts"
import type { EffectOutcome } from "#shared/domain/turns/actions/EffectOutcome.ts"
import { createFleetStub } from "#shared/domain/world/fleets/Fleet.stub.ts"
import { FleetSchema, type Fleet } from "#shared/domain/world/fleets/Fleet.ts"
import { createPlanetStub } from "#shared/domain/world/planets/Planet.stub.ts"
import type { Planet } from "#shared/domain/world/planets/Planet.ts"
import { createSeededRng } from "#shared/testing/createSeededRng.ts"
import { ColonizeHereTest, ColonizePlanetTest } from "#shared/testing/test-ruleset/action-definitions/colonize.ts"
import { TestRuleset } from "#shared/testing/test-ruleset/TestRuleset.ts"
import { EffectPool } from "#shared/turn-resolution/effects/EffectPool.ts"
import { resolveColonizationPhase } from "#shared/turn-resolution/phases/implementations/resolveColonizationPhase.ts"
import type { ResolvedTurnState } from "#shared/turn-resolution/ResolvedTurnState.ts"
import { resolveTurn } from "#shared/turn-resolution/resolveTurn.ts"
import type { TurnContext, PendingArrivalColonizationIntent } from "#shared/turn-resolution/TurnContext.ts"
import { createTurnStateStub } from "#shared/turn-resolution/TurnState.stub.ts"

export const PLAYER_A = typedParse(PlayerIdSchema, "00000000-0000-4000-8000-000000000001")

export const PLAYER_B = typedParse(PlayerIdSchema, "00000000-0000-4000-8000-000000000002")

export const PLAYER_C = typedParse(PlayerIdSchema, "00000000-0000-4000-8000-000000000003")

export type FleetSelectionTargets = Readonly<{ fleet?: string; planet?: string }>

export type FleetSelectionInputs = Readonly<{ strength?: number }>

export function targetIdOrUndefined(targetId: string | undefined): TargetId | undefined {
  return targetId === undefined ? undefined : branded<TargetId>(targetId)
}

export function createFleetSelectionDraft(
  actionId: ActionId,
  selectedTargets: FleetSelectionTargets,
  selectedInputs: FleetSelectionInputs,
): ActionSelectionDraft {
  return {
    actionId,
    selectedTargets: {
      [branded<TargetTag>("fleet")]: targetIdOrUndefined(selectedTargets.fleet),
      [branded<TargetTag>("planet")]: targetIdOrUndefined(selectedTargets.planet),
    },
    selectedInputs: { [branded<InputTag>("strength")]: selectedInputs.strength },
  }
}

export function replaceActionById(
  actions: EligibilityState["actions"],
  replacement: EligibilityState["actions"][number],
): EligibilityState["actions"] {
  const replacementById = new Map([[replacement.id, replacement]])
  return actions.map((action) => replacementById.get(action.id) ?? action)
}

export function findJourneyForSubmission(state: ResolvedTurnState, playerId: PlayerId, actionId: ActionId): Fleet {
  const journey = Object.values(state.fleets).find(
    ({ movement }) => movement?.submission.playerId === playerId && movement.submission.id === actionId,
  )
  Assert.isDefined(journey)
  return journey
}

export function findResolvedContinuation(
  state: Pick<ResolvedTurnState, "resolvedContinuations"> | Pick<TurnContext, "resolvedContinuations">,
  playerId: PlayerId,
  actionId: ActionId,
): ResolvedTurnState["resolvedContinuations"][number] {
  const continuation = state.resolvedContinuations.find(
    ({ originatingSubmission }) => originatingSubmission.playerId === playerId && originatingSubmission.id === actionId,
  )
  Assert.isDefined(continuation)
  return continuation
}

export function outcomeText(outcome: EffectOutcome): string {
  return outcome.type === "RESOLVED" ? outcome.result : outcome.reason
}

export type StandaloneColonizeScenario = {
  origin: Planet
  destination: Planet
  source: Fleet
  attacker: Fleet | undefined
  colonize: ReturnType<typeof createSubmittedActionStub>
  resolved: ResolvedTurnState
}

export function runStandaloneColonizeWithMove(withAssault: boolean): StandaloneColonizeScenario {
  const origin = planet(`deferred-origin-${withAssault}`, null, 0)
  const destination = planet(`deferred-destination-${withAssault}`, null, 1)
  const source = fleet(`deferred-source-${withAssault}`, PLAYER_A, origin, 35)
  const move = submit({
    id: "MOVE_FLEET_STANDARD_1",
    playerId: PLAYER_A,
    actionDefinitionId: "MOVE_FLEET_STANDARD",
    source,
    target: destination,
    strength: 15,
  })
  const colonize = createSubmittedActionStub({
    id: ColonizeHereTest.id + "_1",
    playerId: PLAYER_A,
    actionDefinitionId: ColonizeHereTest.id,
    selectedTargets: { fleet: source.id, planet: origin.id },
  })
  const attacker = withAssault ? fleet(`deferred-attacker-${withAssault}`, PLAYER_B, origin, 1) : undefined
  const fleets = attacker === undefined ? [source] : [source, attacker]
  const assault =
    attacker === undefined
      ? []
      : [
          createSubmittedActionStub({
            id: "TEST_STATIONARY_ASSAULT_1",
            playerId: PLAYER_B,
            actionDefinitionId: "TEST_STATIONARY_ASSAULT",
            selectedTargets: { station: attacker.id, battlePlanet: origin.id },
          }),
        ]
  const submissions = [move, colonize, ...assault]

  return { origin, destination, source, attacker, colonize, resolved: resolve({ planets: [origin, destination], fleets, submissions }) }
}

export function journeyTo(resolved: ResolvedTurnState, destinationPlanetId: string): Fleet | undefined {
  return Object.values(resolved.fleets).find(
    ({ destinationPlanetId: currentDestination, movement }) => movement !== undefined && currentDestination === destinationPlanetId,
  )
}

export type ArrivalRace = {
  planets: Planet[]
  fleets: Fleet[]
  submissions: Array<ReturnType<typeof createSubmittedActionStub>>
  target: Planet
  firstSource: Fleet
  secondSource: Fleet
  firstAction: ReturnType<typeof createSubmittedActionStub>
  secondAction: ReturnType<typeof createSubmittedActionStub>
}

export function createArrivalRace({ firstDistance, secondDistance }: { firstDistance: number; secondDistance: number }): ArrivalRace {
  const originA = planet("race-origin-a", PLAYER_A, 0)
  const target = planet("race-target", null, firstDistance)
  const firstSource = fleet("race-source-a", PLAYER_A, originA, 35)
  const originB = planet("race-origin-b", PLAYER_B, firstDistance - secondDistance)
  const secondSource = fleet("race-source-b", PLAYER_B, originB, 35)
  const firstAction = submit({
    id: ColonizePlanetTest.id + "_1",
    playerId: PLAYER_A,
    actionDefinitionId: ColonizePlanetTest.id,
    source: firstSource,
    target,
    strength: 35,
  })
  const secondAction = submit({
    id: ColonizePlanetTest.id + "_1",
    playerId: PLAYER_B,
    actionDefinitionId: ColonizePlanetTest.id,
    source: secondSource,
    target,
    strength: 35,
  })
  return {
    planets: [originA, originB, target],
    fleets: [firstSource, secondSource],
    submissions: [firstAction, secondAction],
    target,
    firstSource,
    secondSource,
    firstAction,
    secondAction,
  }
}

export function createColonizeMoveAction({
  id,
  speed,
  withAssault = false,
}: {
  id: string
  speed: number
  withAssault?: boolean
}): ActionDefinition {
  const move = FleetMoveEffectDefinition.create({ fleetTag: "fleet", planetTag: "planet", strengthTag: "strength", speed })
  const colonize = FleetColonizeEffectDefinition.create({ fleetTag: "fleet", planetTag: "planet", strengthRequirement: 20 })
  const effects: ActionDefinition["effects"] = [colonize, move]
  if (withAssault) {
    effects.push(FleetAssaultEffectDefinition.create({ fleetTag: "fleet", planetTag: "planet" }))
  }
  return typedParse(ActionDefinitionSchema, { ...ColonizePlanetTest, id, name: id, effects })
}

export function createMovementAction({ id, speed }: { id: string; speed: number }): ActionDefinition {
  return typedParse(ActionDefinitionSchema, {
    ...ColonizePlanetTest,
    id,
    name: id,
    effects: [FleetMoveEffectDefinition.create({ fleetTag: "fleet", planetTag: "planet", strengthTag: "strength", speed })],
  })
}

export function createRuleset(
  definitions: readonly ActionDefinition[],
  poolEntries: ReadonlyArray<Readonly<{ id: string; actionDefinitionId: string }>>,
): ReturnType<typeof Ruleset.create> {
  const actionDefinitions = { ...TestRuleset.actionDefinitions, ...indexBy("id", definitions) }
  return Ruleset.create({
    ...TestRuleset,
    actionDefinitions,
    actionPool: [...TestRuleset.actionPool, ...poolEntries],
  })
}

export function resolve({
  planets,
  fleets,
  submissions,
  ruleset = TestRuleset,
  rng = createSeededRng(1234),
  turn = 1,
  colonyStockpile = 0,
}: {
  planets: readonly Planet[]
  fleets: readonly Fleet[]
  submissions: Array<ReturnType<typeof createSubmittedActionStub>>
  ruleset?: ReturnType<typeof Ruleset.create>
  rng?: ReturnType<typeof createSeededRng>
  turn?: number
  colonyStockpile?: number
}): ResolvedTurnState {
  const result = resolveTurn(
    createTurnStateStub({
      gameId: typedParse(GameIdSchema, 57),
      turn,
      submittedActions: submissions,
      players: indexBy(
        "id",
        [PLAYER_A, PLAYER_B, PLAYER_C].map((id) => ({
          id,
          resources: createResourcesStub({
            [ResourceType.INFLUENCE]: 50,
            [ResourceType.METAL]: 100,
            [ResourceType.FUEL]: 100,
            [ResourceType.ENERGY]: 0,
            [ResourceType.COLONY]: colonyStockpile,
          }),
        })),
      ),
      planets: indexBy("id", structuredClone([...planets])),
      fleets: indexBy("id", structuredClone([...fleets])),
    }),
    ruleset,
    rng,
  )
  Assert.isSuccess(result)
  return result.value
}

export function resolveContinuation(
  previous: ResolvedTurnState,
  turn: number,
  rng = createSeededRng(1234),
  ruleset = TestRuleset,
): ResolvedTurnState {
  const fleets = Object.values(previous.fleets).map((fleetValue) =>
    fleetValue.movement === undefined ? fleetValue : FleetSchema.parse(JSON.parse(JSON.stringify(fleetValue))),
  )
  const result = resolveTurn(
    createTurnStateStub({
      gameId: previous.gameId,
      turn,
      players: previous.players,
      planets: previous.planets,
      fleets: indexBy("id", fleets),
    }),
    ruleset,
    rng,
  )
  Assert.isSuccess(result)
  return result.value
}

export function resolveColonizeOnly({
  planets,
  fleets,
  intents,
  rng,
}: {
  planets: readonly Planet[]
  fleets: readonly Fleet[]
  intents: PendingArrivalColonizationIntent[]
  rng: ReturnType<typeof createSeededRng>
}): { context: TurnContext } {
  const state = createTurnStateStub({
    gameId: typedParse(GameIdSchema, 58),
    turn: 2,
    players: indexBy(
      "id",
      [PLAYER_A, PLAYER_B].map((id) => ({
        id,
        resources: createResourcesStub({ [ResourceType.INFLUENCE]: 100 }),
      })),
    ),
    planets: indexBy("id", planets),
    fleets: indexBy("id", fleets),
  })
  const context: TurnContext = {
    rng,
    turnState: state,
    effectPool: new EffectPool([]),
    ruleset: TestRuleset,
    previousJourneyFleetIds: [],
    newDepartureFleetIds: new Set(),
    removedFleetIds: new Set(),
    changedPlanetIds: new Set(),
    resolvedContinuations: [],
    pendingArrivalAssaults: [],
    pendingArrivalColonizations: intents,
    fleetIdRebindings: new Map(),
  }
  const result = resolveColonizationPhase(context)
  Assert.isSuccess(result)
  return { context }
}

export function intent({
  fleet: targetFleet,
  action,
  target,
  tick,
  colonizeDefinition,
}: {
  fleet: Fleet
  action: ReturnType<typeof createSubmittedActionStub>
  target: Planet
  tick: number
  colonizeDefinition: ReturnType<typeof FleetColonizeEffectDefinition.create>
}): PendingArrivalColonizationIntent {
  return {
    effectDefinition: colonizeDefinition,
    definitionOrdinal: typedParse(NonNegativeSafeIntegerSchema, 2),
    submittedAction: action,
    departureTurn: typedParse(PositiveIntegerSchema, 1),
    initiatingJourneyId: targetFleet.id,
    actualFleetId: targetFleet.id,
    planetId: target.id,
    tick,
    actionOutcomes: [],
  }
}

export function planet(id: string, ownerPlayerId: PlayerId | null, x: number): Planet {
  return createPlanetStub({ id, ownerPlayerId, name: id, x, y: 0 })
}

export function fleet(id: string, ownerPlayerId: PlayerId, origin: Planet, strength: number): Fleet {
  return createFleetStub({ id, ownerPlayerId, originPlanetId: origin.id, name: id, strength })
}

export function submit({
  id,
  playerId,
  actionDefinitionId,
  source,
  target,
  strength,
}: {
  id: string
  playerId: PlayerId
  actionDefinitionId: string
  source: Fleet
  target: Planet
  strength: number
}): ReturnType<typeof createSubmittedActionStub> {
  return createSubmittedActionStub({
    id,
    playerId,
    actionDefinitionId,
    selectedTargets: { fleet: source.id, planet: target.id },
    selectedInputs: { strength },
  })
}

export function outcomeFor(result: ResolvedTurnState, playerId: PlayerId, actionId: string): EffectOutcome {
  const action = result.resolvedActions.find(
    ({ submittedAction }) => submittedAction.playerId === playerId && submittedAction.id === actionId,
  )
  const outcome = action?.actionOutcomes.at(-1)
  if (outcome === undefined) {
    throw new Error(`Expected an outcome for ${playerId}/${actionId}`)
  }
  return outcome
}

export function outcomesFor(result: ResolvedTurnState, playerId: PlayerId, actionId: string): readonly EffectOutcome[] {
  return (
    result.resolvedActions.find(({ submittedAction }) => submittedAction.playerId === playerId && submittedAction.id === actionId)
      ?.actionOutcomes ?? []
  )
}

export function fleetAtPlanetForOwner(result: ResolvedTurnState, planetId: string, ownerPlayerId: PlayerId): Fleet | undefined {
  return Object.values(result.fleets).find(
    ({ originPlanetId, ownerPlayerId: currentOwnerId }) => originPlanetId === planetId && currentOwnerId === ownerPlayerId,
  )
}

export function fleetStrengthForOwner(result: ResolvedTurnState, ownerPlayerId: PlayerId): number | undefined {
  const strengths = Object.values(result.fleets)
    .filter(({ ownerPlayerId: fleetOwnerId }) => fleetOwnerId === ownerPlayerId)
    .map(({ strength }) => strength)
  return strengths.length === 1 ? strengths[0] : undefined
}
