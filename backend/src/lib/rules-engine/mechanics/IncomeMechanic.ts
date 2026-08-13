import type { QuantityOfResource } from "#lib/rules-engine/mechanics/QuantityOfResource.ts"

export type IncomeMechanic = {
  id: (typeof IncomeMechanic)["id"]
} & QuantityOfResource

export const IncomeMechanic = {
  id: "income-mechanic",
  create: ({ quantity, resourceType }: Omit<IncomeMechanic, "id">): IncomeMechanic => ({
    id: IncomeMechanic.id,
    quantity,
    resourceType,
  }),
} as const
