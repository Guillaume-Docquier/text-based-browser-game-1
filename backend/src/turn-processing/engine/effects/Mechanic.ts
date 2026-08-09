import type { Income } from "#turn-processing/engine/effects/mechanics/Income.ts"
import type { Victory } from "#turn-processing/engine/effects/mechanics/Victory.ts"
import type { ResourceType } from "#turn-processing/engine/effects/ResourceType.ts"

export type Mechanic = {
  /**
   * The unique id of the mechanic
   */
  id: string
  /**
   * The display name of this mechanic
   */
  name: string
  /**
   * Description template of this mechanic, including every parameter with placeholder values
   */
  descriptionTemplate: string
  /**
   * Variable parameters for this mechanic.
   */
  parameters: Record<`P_${string}`, "string" | "number" | "resource-type">
}

export type MechanicParameterTSType<TMechanicParameterType> = TMechanicParameterType extends "string"
  ? string
  : TMechanicParameterType extends "number"
    ? number
    : TMechanicParameterType extends "resource-type"
      ? ResourceType
      : never

export type Mechanics = typeof Income | typeof Victory
