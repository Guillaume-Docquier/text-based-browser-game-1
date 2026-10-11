import { branded, indexBy } from "@guillaume-docquier/tools-ts"
import type { PlayerId } from "#shared/domain/players/PlayerId.ts"
import { createResourcesStub } from "#shared/domain/resources/Resources.stub.ts"
import { createFleetMoveActionDefinitionStub } from "#shared/domain/ruleset/action-definitions/ActionDefinition.stub.ts"
import type { ActionDefinition } from "#shared/domain/ruleset/action-definitions/ActionDefinition.ts"
import { createRulesetStub } from "#shared/domain/ruleset/Ruleset.stub.ts"
import type { Ruleset } from "#shared/domain/ruleset/Ruleset.ts"
import { createSubmittedActionStub } from "#shared/domain/turns/actions/Action.stub.ts"
import type { SubmittedAction } from "#shared/domain/turns/actions/Action.ts"
import { createFleetStub } from "#shared/domain/world/fleets/Fleet.stub.ts"
import type { Fleet } from "#shared/domain/world/fleets/Fleet.ts"
import { createPlanetStub } from "#shared/domain/world/planets/Planet.stub.ts"
import type { Planet } from "#shared/domain/world/planets/Planet.ts"
import { createTurnStateStub } from "#shared/turn-resolution/TurnState.stub.ts"
import type { TurnState } from "#shared/turn-resolution/TurnState.ts"
export type FleetEligibilityScenario = {
  playerId: PlayerId
  origin: Planet
  destination: Planet
  second: Planet
  source: Fleet
  definition: ActionDefinition
  ruleset: Ruleset
  state: TurnState
  order: (id: string, amount: number, destinationId?: Planet["id"]) => SubmittedAction
}
export function createFleetEligibilityScenario({
  speed = 2,
  range = 5,
  strength = 50,
  influence = 6,
  fuel = 2,
}: { speed?: number; range?: number; strength?: number; influence?: number; fuel?: number } = {}): FleetEligibilityScenario {
  const playerId = branded<PlayerId>("00000000-0000-4000-8000-000000000001")
  const origin = createPlanetStub({ id: "origin", ownerPlayerId: playerId, x: 0, y: 0 })
  const destination = createPlanetStub({ id: "destination", x: 3, y: 4 })
  const second = createPlanetStub({ id: "second", x: -3, y: 4 })
  const source = createFleetStub({ id: "source", name: "Original", ownerPlayerId: playerId, originPlanetId: origin.id, strength })
  const definition = createFleetMoveActionDefinitionStub({ speed, range })
  const ruleset = createRulesetStub({
    actionDefinitions: { [definition.id]: definition },
    actionPool: ["X", "Y", "Z"].map((id) => ({ id, actionDefinitionId: definition.id })),
  })
  const state = createTurnStateStub({
    players: indexBy("id", [{ id: playerId, resources: createResourcesStub({ INFLUENCE: influence, FUEL: fuel }) }]),
    planets: indexBy("id", [origin, destination, second]),
    fleets: indexBy("id", [source]),
  })
  const order = (id: string, amount: number, destinationId = destination.id): SubmittedAction =>
    createSubmittedActionStub({
      id,
      playerId,
      actionDefinitionId: definition.id,
      selectedTargets: { craft: source.id, route: destinationId },
      selectedInputs: { force: amount },
    })
  return { playerId, origin, destination, second, source, definition, ruleset, state, order }
}
