import type { Mechanic } from "#lib/rules-engine/mechanics/Mechanic.ts"
import { MechanicType } from "#lib/rules-engine/mechanics/MechanicType.ts"
import { Phase } from "#lib/rules-engine/phases/Phase.ts"

/**
 * Engine-owned metadata for one supported Mechanic type.
 */
export type MechanicDefinition<TType extends Mechanic["type"] = Mechanic["type"]> = {
  readonly type: TType
  readonly phase: Phase
  /**
   * The deterministic order of this Mechanic type relative to other types in the same Phase.
   */
  readonly order: number
}

type MechanicDefinitionMap = {
  readonly [TType in Mechanic["type"]]: MechanicDefinition<TType>
}

/**
 * All Mechanic types known by the Rules Engine.
 */
export const MechanicDefinitions = {
  [MechanicType.COST]: {
    type: MechanicType.COST,
    phase: Phase.PAY_COSTS,
    order: 0,
  },
  [MechanicType.INCOME]: {
    type: MechanicType.INCOME,
    phase: Phase.INCOME,
    order: 0,
  },
  [MechanicType.VICTORY]: {
    type: MechanicType.VICTORY,
    phase: Phase.CHECK_VICTORY,
    order: 0,
  },
} as const satisfies MechanicDefinitionMap
