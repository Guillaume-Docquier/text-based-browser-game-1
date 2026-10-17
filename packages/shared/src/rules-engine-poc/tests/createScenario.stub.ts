import { Assert, Result, indexBy } from "@guillaume-docquier/tools-ts"
import { typedParse } from "@guillaume-docquier/tools-ts/schemas"
import { GameIdSchema } from "#shared/domain/games/GameId.ts"
import { PlayerIdSchema } from "#shared/domain/players/PlayerId.ts"
import { createResourcesStub } from "#shared/domain/resources/Resources.stub.ts"
import { ResourceType } from "#shared/domain/resources/ResourceType.ts"
import { createSubmittedActionStub } from "#shared/domain/turns/actions/Action.stub.ts"
import type { SubmittedAction } from "#shared/domain/turns/actions/Action.ts"
import { createFleetStub } from "#shared/domain/world/fleets/Fleet.stub.ts"
import type { Fleet } from "#shared/domain/world/fleets/Fleet.ts"
import { createPlanetStub } from "#shared/domain/world/planets/Planet.stub.ts"
import type { Planet } from "#shared/domain/world/planets/Planet.ts"
import type { ResolutionPlayer } from "#shared/turn-resolution/state/ResolutionPlayer.ts"
import type { CompiledRuleset } from "../compiler/CompiledRuleset.ts"
import { compileRuleset } from "../compiler/compileRuleset.ts"
import type { ActionDefinition } from "../definitions/ActionDefinition.ts"
import type { RulesetInput } from "../definitions/RulesetDefinition.ts"
import type { ExecutionState } from "../runtime/ExecutionContext.ts"

/**
 * Extracts setup results, failing immediately when a fixture is invalid.
 */
export function extractSuccess<T, E>(result: Result<T, E>): T {
  Assert.isTrue(Result.isSuccess(result))
  return result.value
}
/**
 * A deterministic domain world shared by behavior tests.
 */
export type Scenario = {
  state: ExecutionState
  actor: ResolutionPlayer
  opponent: ResolutionPlayer
  home: Planet
  destination: Planet
  foreign: Planet
  fleetA: Fleet
  fleetB: Fleet
  hostileFleet: Fleet
}
export function createScenario(): Scenario {
  const actor = {
    id: typedParse(PlayerIdSchema, "00000000-0000-4000-8000-000000000001"),
    resources: createResourcesStub({
      [ResourceType.INFLUENCE]: 100,
      [ResourceType.METAL]: 100,
      [ResourceType.FUEL]: 100,
      [ResourceType.ENERGY]: 100,
    }),
  }
  const opponent = { id: typedParse(PlayerIdSchema, "00000000-0000-4000-8000-000000000002"), resources: { ...actor.resources } }
  const home = createPlanetStub({ id: "home", ownerPlayerId: actor.id, x: 0, y: 0 })
  const destination = createPlanetStub({ id: "destination", x: 3, y: 4 })
  const foreign = createPlanetStub({ id: "foreign", ownerPlayerId: opponent.id, x: 10, y: 10 })
  const fleetA = createFleetStub({ id: "fleet-a", name: "First", ownerPlayerId: actor.id, originPlanetId: home.id, strength: 20 })
  const fleetB = createFleetStub({ id: "fleet-b", name: "Second", ownerPlayerId: actor.id, originPlanetId: home.id, strength: 30 })
  const hostileFleet = createFleetStub({ id: "hostile", ownerPlayerId: opponent.id, originPlanetId: foreign.id })
  const state: ExecutionState = {
    gameId: typedParse(GameIdSchema, 1),
    turn: 1,
    players: indexBy("id", [actor, opponent]),
    planets: indexBy("id", [home, destination, foreign]),
    fleets: indexBy("id", [fleetA, fleetB, hostileFleet]),
    winnerPlayerId: undefined,
  }
  return { state, actor, opponent, home, destination, foreign, fleetA, fleetB, hostileFleet }
}
/**
 * Compiles a small ruleset with one opportunity for each supplied action.
 */
export function compileActions(actions: readonly ActionDefinition[]): CompiledRuleset {
  return extractSuccess(compileRuleset(rulesetInput(actions)))
}
export function rulesetInput(actions: readonly ActionDefinition[]): RulesetInput {
  return {
    id: "example",
    name: "Example",
    isDefault: false,
    actionDefinitions: actions,
    actionPool: actions.map((action) => ({ id: `${action.id}_1`, actionDefinitionId: action.id })),
    startingResources: createResourcesStub(),
  }
}
export function submit(id: string, actorId: string, selectedTargets: Readonly<Record<string, string>> = {}): SubmittedAction {
  return createSubmittedActionStub({ id: `${id}_1`, actionDefinitionId: id, playerId: actorId, selectedTargets })
}
