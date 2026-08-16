import type { AbstractMechanic } from "#lib/rules-engine/ruleset-model/mechanics/Mechanic.ts"
import type { QuantityOfResource } from "#lib/rules-engine/ruleset-model/mechanics/QuantityOfResource.ts"
import { TargetDefinitionSelf } from "#lib/rules-engine/ruleset-model/mechanics/TargetDefinition.ts"

export interface ResourceLossMechanic extends AbstractMechanic, QuantityOfResource {
  readonly type: "RESOURCE_LOSS"
  readonly targets: {
    readonly player: TargetDefinitionSelf
  }
}

export const ResourceLossMechanic = {
  type: "RESOURCE_LOSS",
  create: ({ quantity, resourceType }: Omit<ResourceLossMechanic, "type" | "targets">): ResourceLossMechanic => ({
    type: ResourceLossMechanic.type,
    targets: {
      player: TargetDefinitionSelf,
    },
    quantity,
    resourceType,
  }),
} as const
