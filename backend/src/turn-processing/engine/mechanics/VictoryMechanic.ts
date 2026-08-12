export type VictoryMechanic = {
  id: (typeof VictoryMechanic)["id"]
}

export const VictoryMechanic = {
  id: "victory-mechanic",
  create: (parameters: Omit<VictoryMechanic, "id">): VictoryMechanic => ({
    id: VictoryMechanic.id,
    ...parameters,
  }),
} as const
