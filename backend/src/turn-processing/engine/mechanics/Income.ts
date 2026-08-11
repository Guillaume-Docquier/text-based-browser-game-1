import type { MechanicDefinition } from "#turn-processing/engine/mechanics/MechanicDefinition.ts"

export const Income = {
  id: "income-mechanic",
  name: "Income",
  descriptionTemplate: "Gain P_RESOURCE_COUNT P_RESOURCE_TYPE",
  parameters: {
    P_RESOURCE_COUNT: "number",
    P_RESOURCE_TYPE: "resource-type",
  },
} as const satisfies MechanicDefinition
