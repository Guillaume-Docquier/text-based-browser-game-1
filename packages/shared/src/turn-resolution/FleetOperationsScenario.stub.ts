import { Assert, indexBy } from "@guillaume-docquier/tools-ts"
import { typedParse } from "@guillaume-docquier/tools-ts/schemas"
import type { PlayerId } from "#shared/domain/players/PlayerId.ts"
import { PlayerIdSchema } from "#shared/domain/players/PlayerId.ts"
import { createResourcesStub } from "#shared/domain/resources/Resources.stub.ts"
import { createActionDefinitionStub } from "#shared/domain/ruleset/action-definitions/ActionDefinition.stub.ts"
import { ActionDefinitionSchema, type ActionDefinition } from "#shared/domain/ruleset/action-definitions/ActionDefinition.ts"
import { AssaultEffectDefinition } from "#shared/domain/ruleset/effect-definitions/AssaultEffectDefinition.ts"
import { FleetMoveEffectDefinition } from "#shared/domain/ruleset/effect-definitions/FleetMoveEffectDefinition.ts"
import { ResourceGainEffectDefinition } from "#shared/domain/ruleset/effect-definitions/ResourceGainEffectDefinition.ts"
import { ResourceLossEffectDefinition } from "#shared/domain/ruleset/effect-definitions/ResourceLossEffectDefinition.ts"
import { createRulesetStub } from "#shared/domain/ruleset/Ruleset.stub.ts"
import type { Ruleset } from "#shared/domain/ruleset/Ruleset.ts"
import { createSubmittedActionStub } from "#shared/domain/turns/actions/Action.stub.ts"
import type { SubmittedAction } from "#shared/domain/turns/actions/Action.ts"
import { createFleetStub } from "#shared/domain/world/fleets/Fleet.stub.ts"
import { FleetIdSchema } from "#shared/domain/world/fleets/FleetId.ts"
import { createPlanetStub } from "#shared/domain/world/planets/Planet.stub.ts"
import type { Planet } from "#shared/domain/world/planets/Planet.ts"
import { createSeededRng } from "#shared/testing/createSeededRng.ts"
import { extractSuccess } from "#shared/testing/extractSuccess.ts"
import { resolveTurn } from "#shared/turn-resolution/resolveTurn.ts"
import { createTurnStateStub } from "#shared/turn-resolution/TurnState.stub.ts"
import type { TurnState } from "#shared/turn-resolution/TurnState.ts"

/** Canonical owner aliases a/b/c are UUID suffixes 001/002/003. */
export function createFleetOperationsScenario({
  orders = [{ owner: 1, strength: 30, distance: 1, assault: true }],
  defenders = [{ owner: 2, strength: 20, id: "defender-a" }],
  speed = 2,
  assaultCount = 1,
  turn = 1,
}: {
  orders?: Array<{ owner: number; strength: number; distance: number; assault: boolean }>
  defenders?: Array<{ owner: number; strength: number; id: string }>
  speed?: number
  assaultCount?: number
  turn?: number
} = {}): { state: TurnState; ruleset: Ruleset; owners: PlayerId[]; destination: Planet; submissions: SubmittedAction[] } {
  const owners = [1, 2, 3].map((n) => typedParse(PlayerIdSchema, `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`))
  const ownerAt = (n: number): PlayerId => {
    const id = owners[n - 1]
    if (id === undefined) throw new Error("Invalid fixture owner")
    return id
  }
  const destination = createPlanetStub({ id: "destination", name: "Destination", x: 0, y: 0 })
  const origins = orders.map((order, index) =>
    createPlanetStub({ id: `origin-${index}`, x: order.distance, y: 0, ownerPlayerId: ownerAt(order.owner) }),
  )
  const sources = orders.map((order, index) =>
    createFleetStub({
      id: `source-${index}`,
      name: `Source ${index}`,
      ownerPlayerId: ownerAt(order.owner),
      originPlanetId: origins[index]?.id ?? "missing",
      strength: order.strength,
    }),
  )
  const definitions = orders.map((order, index) =>
    createActionDefinitionStub({
      id: `TRAVEL-${index}`,
      name: `Travel ${index}`,
      type: "DIRECTIVE",
      tier: "STANDARD",
      inputs: { force: { type: "FLEET_STRENGTH", fleetTargetTag: "craft" } },
      targets: {
        craft: {
          targetType: "FLEET",
          constraints: [{ type: "OWNED_BY_SUBMITTING_PLAYER", parameters: {}, references: {} }, { type: "STATIONARY_FLEET" }],
        },
        route: { targetType: "PLANET", constraints: [{ type: "WITHIN_FLEET_RANGE", fleetTargetTag: "craft", maximumDistance: 25 }] },
      },
      costs: [
        ResourceLossEffectDefinition.create({ quantity: 5, resourceType: "INFLUENCE" }),
        ResourceLossEffectDefinition.create({ quantity: 1, resourceType: "FUEL" }),
      ],
      effects: [
        FleetMoveEffectDefinition.create({ fleetTag: "craft", planetTag: "route", strengthTag: "force", speed }),
        ...(order.assault
          ? Array.from({ length: assaultCount }, () => AssaultEffectDefinition.create({ fleetTag: "craft", planetTag: "route" }))
          : []),
      ],
    }),
  )
  const submissions = orders.map((order, index) =>
    createSubmittedActionStub({
      id: `ORDER-${index}`,
      actionDefinitionId: definitions[index]?.id ?? "missing",
      playerId: ownerAt(order.owner),
      selectedTargets: { craft: sources[index]?.id ?? "missing", route: destination.id },
      selectedInputs: { force: order.strength },
    }),
  )
  const ruleset = createRulesetStub({
    actionDefinitions: indexBy("id", definitions),
    actionPool: submissions.map((action) => ({ id: action.id, actionDefinitionId: action.actionDefinitionId })),
  })
  const state = createTurnStateStub({
    turn,
    players: indexBy(
      "id",
      owners.map((id) => ({ id, resources: createResourcesStub({ INFLUENCE: 100, FUEL: 100 }) })),
    ),
    planets: indexBy("id", [destination, ...origins]),
    fleets: indexBy("id", [
      ...sources,
      ...defenders.map((defender) =>
        createFleetStub({ ...defender, ownerPlayerId: ownerAt(defender.owner), originPlanetId: destination.id }),
      ),
    ]),
    submittedActions: submissions,
  })
  return { state, ruleset, owners, destination, submissions }
}

export function createDefenderFixtures(strengths: number[]): Array<{ owner: number; strength: number; id: string }> {
  return strengths.map((strength, index) => ({
    owner: index === 0 ? 2 : 3,
    strength,
    id: ["defender-a", "defender-b", "defender-c"][index] ?? "missing",
  }))
}
export function reverseFleetOperationsState(state: TurnState, reverse: boolean): TurnState {
  return reverse
    ? {
        ...state,
        submittedActions: [...state.submittedActions].toReversed(),
        fleets: Object.fromEntries(Object.entries(state.fleets).toReversed()),
      }
    : state
}
export function createMergeDefenders(station: boolean): Array<{ owner: number; strength: number; id: string }> {
  return [...(station ? [{ owner: 1, strength: 7, id: "station" }] : []), { owner: 2, strength: station ? 27 : 20, id: "enemy" }]
}
export function changeMoveSpeed(ruleset: Ruleset, speed: number): Ruleset {
  return {
    ...ruleset,
    actionDefinitions: Object.fromEntries(
      Object.values(ruleset.actionDefinitions).map((definition) => [
        definition.id,
        typedParse(ActionDefinitionSchema, {
          ...definition,
          effects: definition.effects.map((effect) => (effect.type === "FLEET_MOVE" ? { ...effect, parameters: { speed } } : effect)),
        }),
      ]),
    ),
  }
}
export function createCorruptFleetOperationsScenario(corruption: string): { state: TurnState; ruleset: Ruleset } {
  const fixture = createFleetOperationsScenario({ orders: [{ owner: 1, strength: 30, distance: 5, assault: true }] })
  extractSuccess(resolveTurn(fixture.state, fixture.ruleset, createSeededRng()))
  const state: TurnState = { ...structuredClone(fixture.state), turn: 2, submittedActions: [] }
  const journey = Object.values(state.fleets).find((fleet) => fleet.movement !== undefined)
  Assert.isDefined(journey)
  Assert.isDefined(journey.movement)
  let ruleset = fixture.ruleset
  if (corruption === "missing-pending") journey.movement.pendingArrivalEffects = undefined
  if (corruption === "duplicate-index") journey.movement.pendingArrivalEffects?.push(...journey.movement.pendingArrivalEffects)
  if (corruption === "fractional-strength") journey.strength = 1.5
  if (corruption === "forged-child") {
    Reflect.deleteProperty(state.fleets, journey.id)
    const forged = typedParse(FleetIdSchema, "forged")
    state.fleets[forged] = { ...journey, id: forged }
  }
  if (corruption === "negative-strength") journey.strength = -1
  if (corruption === "missing-player") Reflect.deleteProperty(state.players, journey.ownerPlayerId)
  if (corruption === "missing-planet") Reflect.deleteProperty(state.planets, journey.destinationPlanetId ?? "missing")
  if (corruption === "owner-mismatch") journey.ownerPlayerId = fixture.owners[1] ?? journey.ownerPlayerId
  if (corruption === "impossible-progress") Reflect.set(journey, "distanceToEnd", 4)
  if (corruption === "duplicate-occupancy") {
    const duplicate = structuredClone(journey)
    duplicate.id = typedParse(FleetIdSchema, "duplicate-journey")
    state.fleets[duplicate.id] = duplicate
  }
  const pending = journey.movement.pendingArrivalEffects?.[0]
  if (pending !== undefined) {
    if (corruption === "wrong-type") Reflect.set(pending, "type", "SURPRISE")
    if (corruption === "wrong-index") Reflect.set(pending, "effectIndex", 0)
    if (corruption === "wrong-role") Reflect.set(pending.definition.targets.fleet, "actionTargetTag", "route")
    if (corruption === "unsupported-parameter") Reflect.set(pending.definition.parameters, "rounds", 2)
  }
  if (corruption === "changed-composition")
    ruleset = {
      ...ruleset,
      actionDefinitions: Object.fromEntries(
        Object.values(ruleset.actionDefinitions).map((definition) => [
          definition.id,
          typedParse(ActionDefinitionSchema, { ...definition, effects: definition.effects.filter((effect) => effect.type !== "ASSAULT") }),
        ]),
      ),
    }
  const payable = createActionDefinitionStub({
    id: "PAYABLE",
    costs: [ResourceLossEffectDefinition.create({ quantity: 5, resourceType: "INFLUENCE" })],
    effects: [ResourceGainEffectDefinition.create({ quantity: 5, resourceType: "METAL" })],
  })
  const paymentOwner = fixture.owners[2]
  Assert.isDefined(paymentOwner)
  const paymentAction = createSubmittedActionStub({ id: "PAYABLE-1", actionDefinitionId: payable.id, playerId: paymentOwner })
  ruleset = {
    ...ruleset,
    actionDefinitions: { ...ruleset.actionDefinitions, [payable.id]: payable },
    actionPool: [...ruleset.actionPool, { id: paymentAction.id, actionDefinitionId: payable.id }],
  }
  return { state: { ...state, submittedActions: [paymentAction] }, ruleset }
}

export function createMalformedAssaultDefinition(malformation: string): ActionDefinition {
  const fixture = createFleetOperationsScenario()
  const definition = structuredClone(Object.values(fixture.ruleset.actionDefinitions)[0])
  Assert.isDefined(definition)
  const assault = definition.effects.find((effect) => effect.type === "ASSAULT")
  Assert.isDefined(assault)
  if (malformation === "missing-move") Reflect.set(definition, "effects", [assault])
  if (malformation === "wrong-fleet-role") Reflect.set(assault.targets.fleet, "actionTargetTag", "route")
  if (malformation === "wrong-planet-role") Reflect.set(assault.targets.planet, "actionTargetTag", "craft")
  if (malformation === "wrong-type") Reflect.set(assault.targets.fleet, "targetType", "PLANET")
  if (malformation === "extra-role") Reflect.set(assault.targets, "extra", assault.targets.fleet)
  if (malformation === "unsupported-parameters") Reflect.set(assault.parameters, "rounds", 2)
  return definition
}
