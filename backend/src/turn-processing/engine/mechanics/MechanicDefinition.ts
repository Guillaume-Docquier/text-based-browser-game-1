import type { Income } from "#turn-processing/engine/mechanics/Income.ts"
import type { ResourceType } from "#turn-processing/engine/mechanics/ResourceType.ts"
import type { Victory } from "#turn-processing/engine/mechanics/Victory.ts"

export type MechanicDefinition = {
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

export type MechanicDefinitions = typeof Income | typeof Victory
