/**
 * Independent cross-boundary oracle for one ordinary mixed-definition Fleet allocation.
 * Identifiers are normalized by role; these fixed coordinates match API seed 1234.
 */
export const FleetActionSelectionParity = {
  sourceStrength: 50,
  standardStrength: 20,
  improvedStrength: 30,
  origin: { x: 58.43842436611536, y: 49.61917707239218 },
  destination: { x: 57.77998524757335, y: 50.556704120958045 },
  totalResources: { INFLUENCE: 6, FUEL: 4 },
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
