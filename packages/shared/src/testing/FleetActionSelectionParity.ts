import { MoveFleetStandard } from "#shared/testing/test-ruleset/action-definitions/move-fleet.ts"
import { TestRuleset } from "#shared/testing/test-ruleset/TestRuleset.ts"

/**
 * Independent cross-boundary oracle for one ordinary mixed-definition Fleet allocation.
 * Identifiers are normalized by role; these fixed coordinates match API seed 1234.
 */
export const FleetActionSelectionParityActionPool = [
  ...TestRuleset.actionPool,
  { id: "MOVE_FLEET_STANDARD_2", actionDefinitionId: MoveFleetStandard.id },
]

const improvedActionId = "MOVE_FLEET_IMPROVED_1"
const authorizedActions = FleetActionSelectionParityActionPool.map(({ id, actionDefinitionId }) => ({ id, actionDefinitionId })).toSorted(
  (first, second) => (first.id < second.id ? -1 : first.id > second.id ? 1 : 0),
)

export const FleetActionSelectionParity = {
  sourceStrength: 50,
  standardStrength: 20,
  improvedStrength: 30,
  origin: { x: 58.43842436611536, y: 49.61917707239218 },
  destination: { x: 57.77998524757335, y: 50.556704120958045 },
  totalResources: { INFLUENCE: 6, METAL: 0, FUEL: 4, ENERGY: 0, COLONY: 0 },
  normalizedInput: {
    resources: {
      total: { INFLUENCE: 6, METAL: 0, FUEL: 4, ENERGY: 0, COLONY: 0 },
      uncommitted: { INFLUENCE: 3, METAL: 0, FUEL: 1, ENERGY: 0, COLONY: 0 },
    },
    source: {
      role: "source",
      owner: "player",
      strength: 50,
      origin: "origin",
      movement: null,
    },
    planets: [
      { role: "origin", owner: "player", x: 58.43842436611536, y: 49.61917707239218 },
      { role: "destination", owner: null, x: 57.77998524757335, y: 50.556704120958045 },
    ],
    authorizedActions,
    currentActions: authorizedActions.map(({ id, actionDefinitionId }) => ({
      id,
      actionDefinitionId,
      selectedTargets: id === improvedActionId ? { fleet: "source", planet: "destination" } : null,
      selectedInputs: id === improvedActionId ? { strength: 30 } : null,
      isInProgress: false,
    })),
    candidate: {
      id: "MOVE_FLEET_STANDARD_1",
      actionDefinitionId: "MOVE_FLEET_STANDARD",
      selectedTargets: { fleet: "source", planet: "destination" },
      selectedInputs: { strength: 20 },
    },
  },
  lockedNormalizedInput: {
    resources: {
      total: { INFLUENCE: 6, METAL: 0, FUEL: 4, ENERGY: 0, COLONY: 0 },
      uncommitted: { INFLUENCE: 0, METAL: 0, FUEL: 0, ENERGY: 0, COLONY: 0 },
    },
    source: {
      role: "source",
      owner: "player",
      strength: 50,
      origin: "origin",
      movement: null,
    },
    planets: [
      { role: "origin", owner: "player", x: 58.43842436611536, y: 49.61917707239218 },
      { role: "destination", owner: null, x: 57.77998524757335, y: 50.556704120958045 },
    ],
    authorizedActions,
    currentActions: authorizedActions.map(({ id, actionDefinitionId }) => ({
      id,
      actionDefinitionId,
      selectedTargets: id === improvedActionId || id === "MOVE_FLEET_STANDARD_1" ? { fleet: "source", planet: "destination" } : null,
      selectedInputs: id === improvedActionId ? { strength: 30 } : id === "MOVE_FLEET_STANDARD_1" ? { strength: 20 } : null,
      isInProgress: false,
    })),
  },
  expected: {
    status: "ELIGIBLE",
    issues: [],
    missingTargets: [],
    missingInputs: [],
    strengthCommitment: 50,
    remainingStrength: 0,
    resourceCommitments: { INFLUENCE: 6, METAL: 0, FUEL: 4, ENERGY: 0, COLONY: 0 },
  },
  partialExpected: {
    status: "INCOMPLETE",
    missingTargets: ["planet"],
    missingInputs: [],
  },
} as const
