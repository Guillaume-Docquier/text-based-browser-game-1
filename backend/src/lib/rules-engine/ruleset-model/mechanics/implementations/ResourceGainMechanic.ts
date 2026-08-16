import type { AbstractMechanic } from "#lib/rules-engine/ruleset-model/mechanics/Mechanic.ts"
import type { QuantityOfResource } from "#lib/rules-engine/ruleset-model/mechanics/QuantityOfResource.ts"
import { TargetDefinitionSelf } from "#lib/rules-engine/ruleset-model/mechanics/TargetDefinition.ts"

export interface ResourceGainMechanic extends AbstractMechanic, QuantityOfResource {
  readonly type: "RESOURCE_GAIN"
  readonly targets: {
    readonly player: TargetDefinitionSelf
  }
}

export const ResourceGainMechanic = {
  type: "RESOURCE_GAIN",
  create: ({ quantity, resourceType }: Omit<ResourceGainMechanic, "type" | "targets">): ResourceGainMechanic => ({
    type: ResourceGainMechanic.type,
    targets: {
      player: TargetDefinitionSelf,
    },
    quantity,
    resourceType,
  }),
} as const
