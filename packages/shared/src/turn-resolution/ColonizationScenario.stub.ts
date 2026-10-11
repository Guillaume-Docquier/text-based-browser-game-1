import { Assert, branded, indexBy } from "@guillaume-docquier/tools-ts"
import { typedParse } from "@guillaume-docquier/tools-ts/schemas"
import { PlayerIdSchema } from "#shared/domain/players/PlayerId.ts"
import { ActionDefinitionSchema } from "#shared/domain/ruleset/action-definitions/ActionDefinition.ts"
import type { TargetTag } from "#shared/domain/ruleset/action-definitions/TargetTag.ts"
import { ColonizeEffectDefinition } from "#shared/domain/ruleset/effect-definitions/ColonizeEffectDefinition.ts"
import { ResourceLossEffectDefinition } from "#shared/domain/ruleset/effect-definitions/ResourceLossEffectDefinition.ts"
import { createSubmittedActionStub } from "#shared/domain/turns/actions/Action.stub.ts"
import { createFleetOperationsScenario } from "#shared/turn-resolution/FleetOperationsScenario.stub.ts"
import type { TurnState } from "#shared/turn-resolution/TurnState.ts"

/** Literal shared geometry and valid original departures, independent of public generated routes. */
export function createColonizationScenario({
  requiredStrength = 20,
  stationary = false,
  ...options
}: Parameters<typeof createFleetOperationsScenario>[0] & { requiredStrength?: number; stationary?: boolean } = {}): ReturnType<
  typeof createFleetOperationsScenario
> {
  const fixture = createFleetOperationsScenario(options)
  const definitions = Object.values(fixture.ruleset.actionDefinitions).map((definition) =>
    typedParse(ActionDefinitionSchema, {
      ...definition,
      inputs: stationary ? {} : definition.inputs,
      targets: {
        ...definition.targets,
        route: {
          targetType: "PLANET",
          constraints: stationary
            ? [{ type: "UNCLAIMED_PLANET" }, { type: "AT_FLEET_PLANET", fleetTargetTag: "craft" }]
            : [...(definition.targets[branded<TargetTag>("route")]?.constraints ?? []), { type: "UNCLAIMED_PLANET" }],
        },
      },
      costs: [ResourceLossEffectDefinition.create({ quantity: 25, resourceType: "INFLUENCE" })],
      effects: [
        ...(stationary ? [] : definition.effects),
        ColonizeEffectDefinition.create({ fleetTag: "craft", planetTag: "route", requiredStrength }),
      ],
    }),
  )
  fixture.ruleset = { ...fixture.ruleset, actionDefinitions: indexBy("id", definitions) }
  fixture.submissions = fixture.submissions.map((action) =>
    createSubmittedActionStub({ ...action, selectedInputs: stationary ? {} : action.selectedInputs }),
  )
  fixture.state = { ...fixture.state, submittedActions: fixture.submissions }
  if (stationary) for (const fleet of Object.values(fixture.state.fleets)) fleet.originPlanetId = fixture.destination.id
  return fixture
}
/** Clear all current submissions after a real departure, preserving saved journey bindings. */
export function nextColonizationTurn(fixture: ReturnType<typeof createColonizationScenario>): TurnState {
  return { ...structuredClone(fixture.state), turn: fixture.state.turn + 1, submittedActions: [] }
}

export function enumerateColonizationState(state: TurnState, reverse: boolean): TurnState {
  if (!reverse) return state
  return {
    ...state,
    fleets: Object.fromEntries(Object.entries(state.fleets).toReversed()),
    planets: Object.fromEntries(Object.entries(state.planets).toReversed()),
    players: Object.fromEntries(Object.entries(state.players).toReversed()),
  }
}

/** Put the fourth competitor before the three literal UUID owners before its genuine departure. */
export function positionFourthColonizationOwner(fixture: ReturnType<typeof createColonizationScenario>, firstPosition: boolean): void {
  if (!firstPosition) return
  const previous = fixture.owners[3]
  Assert.isDefined(previous)
  const first = typedParse(PlayerIdSchema, "00000000-0000-4000-8000-000000000000")
  const player = fixture.state.players[previous]
  Assert.isDefined(player)
  const players = { ...fixture.state.players, [first]: { ...player, id: first } }
  Reflect.deleteProperty(players, previous)
  fixture.owners[3] = first
  fixture.submissions = fixture.submissions.map((action) =>
    action.playerId === previous ? createSubmittedActionStub({ ...action, playerId: first }) : action,
  )
  fixture.state = {
    ...fixture.state,
    players,
    submittedActions: fixture.submissions,
    fleets: Object.fromEntries(
      Object.entries(fixture.state.fleets).map(([id, fleet]) => [
        id,
        fleet.ownerPlayerId === previous ? { ...fleet, ownerPlayerId: first } : fleet,
      ]),
    ),
  }
}
