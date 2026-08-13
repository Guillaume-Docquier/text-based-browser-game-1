import type { QuantityOfResource } from "#lib/rules-engine/mechanics/QuantityOfResource.ts"

export type CostMechanic = {
  id: (typeof CostMechanic)["id"]
} & QuantityOfResource

export const CostMechanic = {
  id: "cost-mechanic",
  create: ({ quantity, resourceType }: Omit<CostMechanic, "id">): CostMechanic => ({
    id: CostMechanic.id,
    quantity,
    resourceType,
  }),
} as const
