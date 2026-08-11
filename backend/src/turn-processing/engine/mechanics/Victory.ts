import type { MechanicDefinition } from "#turn-processing/engine/mechanics/MechanicDefinition.ts"

export const Victory = {
  id: "victory-mechanic",
  name: "Win the game",
  descriptionTemplate: "Win the game this turn",
  parameters: {},
} as const satisfies MechanicDefinition
