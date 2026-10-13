import type { Action, PlayerView, Players, ActionDefinition } from "@api-types"
import { typedParse } from "@guillaume-docquier/tools-ts/schemas"
import { createFleetEligibilityScenario, type FleetEligibilityScenario } from "shared/action-submission/actionEligibility.stub.ts"
import { ActionDefinitionSchema } from "shared/domain/ruleset/action-definitions/ActionDefinition.ts"
import { createPlanetStub } from "shared/domain/world/planets/Planet.stub.ts"
import { createStarStub } from "shared/domain/world/stars/Star.stub.ts"
import { AttackMoveStandard } from "shared/testing/test-ruleset/action-definitions/attack-move.ts"
import { ColonizePlanetStandard, ColonizeStationedPlanetStandard } from "shared/testing/test-ruleset/action-definitions/colonize-planet.ts"
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

/** Actual data-driven Colonize controls with renamed mappings and independent threshold. */
export function createColonizeActionCardScenario({
  requiredStrength = 20,
  stationary = false,
  strength = 50,
}: { requiredStrength?: number; stationary?: boolean; strength?: number } = {}): ReturnType<typeof createFleetActionCardScenario> {
  const fixture = createFleetActionCardScenario()
  const base = stationary ? ColonizeStationedPlanetStandard : ColonizePlanetStandard
  const definition = typedParse(ActionDefinitionSchema, {
    ...base,
    id: "SETTLE",
    name: "Settle",
    tier: "BASIC",
    inputs: stationary ? {} : { force: { type: "FLEET_STRENGTH", fleetTargetTag: "craft" } },
    targets: {
      craft: {
        targetType: "FLEET",
        constraints: [{ type: "OWNED_BY_SUBMITTING_PLAYER", references: {}, parameters: {} }, { type: "STATIONARY_FLEET" }],
      },
      route: {
        targetType: "PLANET",
        constraints: stationary
          ? [{ type: "UNCLAIMED_PLANET" }, { type: "AT_FLEET_PLANET", fleetTargetTag: "craft" }]
          : [{ type: "UNCLAIMED_PLANET" }, { type: "WITHIN_FLEET_RANGE", fleetTargetTag: "craft", maximumDistance: 25 }],
      },
    },
    effects: base.effects.map((effect) =>
      effect.type === "COLONIZE"
        ? {
            ...effect,
            targets: {
              fleet: { targetType: "FLEET" as const, actionTargetTag: "craft" },
              planet: { targetType: "PLANET" as const, actionTargetTag: "route" },
            },
            parameters: { requiredStrength },
          }
        : effect.type === "FLEET_MOVE"
          ? {
              ...effect,
              targets: {
                fleet: { targetType: "FLEET" as const, actionTargetTag: "craft" },
                planet: { targetType: "PLANET" as const, actionTargetTag: "route" },
              },
              inputs: { strength: { actionInputTag: "force" } },
            }
          : effect,
    ),
  })
  const entry = { id: fixture.scenario.order("Y", 20).id, actionDefinitionId: definition.id }
  return {
    ...fixture,
    definition,
    view: {
      ...fixture.view,
      ruleset: {
        ...fixture.view.ruleset,
        actionDefinitions: { ...fixture.view.ruleset.actionDefinitions, [definition.id]: definition },
        actionPool: [...fixture.view.ruleset.actionPool.filter((entry) => entry.id !== "Y"), entry],
      },
      actions: [
        { ...entry, status: "AVAILABLE", selectedTargets: null, selectedInputs: null, canAffordResources: true, isEligible: false },
      ],
      fleets: [{ ...fixture.scenario.source, strength, ...(stationary ? { originPlanetId: fixture.scenario.destination.id } : {}) }],
      resources: { ...fixture.view.resources, INFLUENCE: { total: 75, uncommitted: 75 } },
    },
  }
}

/**
 * Claimed destinations are distinct from the source and equally in range as the unclaimed option.
 * With source50, no submitted reservations and Influence75, ownership is the only candidate difference.
 */
export function createColonizeOwnershipScenario(): ReturnType<typeof createFleetActionCardScenario> {
  const fixture = createColonizeActionCardScenario()
  const enemy = createPlayerStub({ id: "00000000-0000-4000-8000-000000000002", alias: "Bob" })
  return {
    ...fixture,
    players: [...fixture.players, enemy],
    view: {
      ...fixture.view,
      opponents: { [enemy.id]: { id: enemy.id, color: enemy.color, isReady: false } },
      galaxy: {
        systems: fixture.view.galaxy.systems.map((system) => ({
          ...system,
          planets: [
            createPlanetStub({ ...fixture.scenario.origin, name: "Origin" }),
            createPlanetStub({ ...fixture.scenario.destination, name: "Unclaimed destination" }),
            createPlanetStub({ id: "owned-destination", name: "Owned destination", ownerPlayerId: fixture.view.player.id, x: 3, y: 4 }),
            createPlanetStub({ id: "enemy-destination", name: "Enemy destination", ownerPlayerId: enemy.id, x: -3, y: 4 }),
          ],
        })),
      },
    },
  }
}
