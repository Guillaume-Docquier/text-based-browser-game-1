import type { Action, PlayerView, Players, ActionDefinition } from "@api-types"
import { createFleetEligibilityScenario, type FleetEligibilityScenario } from "shared/action-submission/actionEligibility.stub.ts"
import { createPlanetStub } from "shared/domain/world/planets/Planet.stub.ts"
import { createStarStub } from "shared/domain/world/stars/Star.stub.ts"
import { AttackMoveStandard } from "shared/testing/test-ruleset/action-definitions/attack-move.ts"
import { TestRuleset } from "shared/testing/test-ruleset/TestRuleset.ts"
import { createPlayerStub } from "@/lib/api/Player.stub.ts"
export function createFleetActionCardScenario(): {
  view: PlayerView
  players: Players
  definition: ActionDefinition
  scenario: FleetEligibilityScenario
} {
  const scenario = createFleetEligibilityScenario()
  const player = createPlayerStub({ id: scenario.playerId, alias: "Alice" })
  const x = scenario.order("X", 20)
  const actions: Action[] = [
    {
      id: x.id,
      actionDefinitionId: x.actionDefinitionId,
      selectedTargets: x.selectedTargets,
      selectedInputs: x.selectedInputs,
      status: "SUBMITTED",
      canAffordResources: true,
      isEligible: true,
    },
    ...scenario.ruleset.actionPool
      .filter((entry) => entry.id !== x.id)
      .map((entry) => ({
        ...entry,
        selectedTargets: null,
        selectedInputs: null,
        status: "AVAILABLE" as const,
        canAffordResources: true,
        isEligible: false,
      })),
  ]
  const view: PlayerView = {
    gameId: scenario.state.gameId,
    player: { id: player.id, color: player.color, isReady: false },
    opponents: {},
    galaxy: {
      systems: [
        {
          star: createStarStub({ id: "star", name: "Home" }),
          planets: [
            createPlanetStub({ ...scenario.origin, name: "Origin" }),
            createPlanetStub({ ...scenario.destination, name: "Boundary" }),
            createPlanetStub({ ...scenario.second, name: "Other" }),
          ],
        },
      ],
    },
    fleets: [scenario.source],
    turn: 1,
    turnStatus: "COLLECTING_ACTIONS",
    turnEndsAt: new Date("2099-01-01").toISOString(),
    ruleset: scenario.ruleset,
    actions,
    resources: {
      INFLUENCE: { total: 6, uncommitted: 3 },
      FUEL: { total: 2, uncommitted: 1 },
      METAL: { total: 0, uncommitted: 0 },
      ENERGY: { total: 0, uncommitted: 0 },
      COLONY: { total: 0, uncommitted: 0 },
    },
  }
  return { view, players: [player], definition: scenario.definition, scenario }
}

/** Test Attack composition with a sibling ordinary Move reservation. */
export function createAttackActionCardScenario(): ReturnType<typeof createFleetActionCardScenario> {
  const fixture = createFleetActionCardScenario()
  const definition = AttackMoveStandard
  const actions: Action[] = [
    fixture.view.actions[0] ?? {
      id: fixture.scenario.order("X", 20).id,
      actionDefinitionId: fixture.scenario.definition.id,
      status: "AVAILABLE",
      selectedTargets: null,
      selectedInputs: null,
      canAffordResources: true,
      isEligible: false,
    },
    ...TestRuleset.actionPool
      .filter((entry) => entry.actionDefinitionId === definition.id)
      .map((entry) => ({
        ...entry,
        status: "AVAILABLE" as const,
        selectedTargets: null,
        selectedInputs: null,
        canAffordResources: true,
        isEligible: false,
      })),
  ]
  return {
    ...fixture,
    definition,
    view: {
      ...fixture.view,
      actions,
      ruleset: {
        ...fixture.view.ruleset,
        actionDefinitions: { ...fixture.view.ruleset.actionDefinitions, [definition.id]: definition },
        actionPool: [
          ...fixture.view.ruleset.actionPool,
          ...TestRuleset.actionPool.filter((entry) => entry.actionDefinitionId === definition.id),
        ],
      },
      resources: { ...fixture.view.resources, INFLUENCE: { total: 20, uncommitted: 17 } },
    },
  }
}
