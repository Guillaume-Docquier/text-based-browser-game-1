/**
 * The stable correlation key shared by a configured Mechanic and the Effect it produces.
 */
export type MechanicType = (typeof MechanicType)[keyof typeof MechanicType]
export const MechanicType = {
  COST: "COST",
  INCOME: "INCOME",
  VICTORY: "VICTORY",
} as const
