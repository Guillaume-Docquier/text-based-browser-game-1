import type { Action, PlayerView, Players, ActionDefinition } from "@api-types"
import { createFleetEligibilityScenario, type FleetEligibilityScenario } from "shared/action-submission/actionEligibility.stub.ts"
import { createPlanetStub } from "shared/domain/world/planets/Planet.stub.ts"
import { createStarStub } from "shared/domain/world/stars/Star.stub.ts"
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
