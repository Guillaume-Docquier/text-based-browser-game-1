import type { MechanicParameterTSType, MechanicDefinitions } from "#turn-processing/engine/mechanics/MechanicDefinition.ts"

export type Mechanic<TMechanic extends MechanicDefinitions = MechanicDefinitions> = TMechanic extends MechanicDefinitions
  ? // Wierd type trick to make Mechanic a distributed union like MechanicDefinitions
    {
      /**
       * The id of the mechanic definition.
       */
      mechanicId: TMechanic["id"]
      /**
       * The values for each parameter of the defined mechanic.
       * It is expected that all parameters are defined.
       */
      resolvedParameters: ResolvedParameters<TMechanic>
    }
  : never

/**
 * Maps the MechanicDefinition parameters definition types to their runtime type
 */
type ResolvedParameters<TMechanic extends MechanicDefinitions> = {
  [Property in keyof TMechanic["parameters"]]: MechanicParameterTSType<TMechanic["parameters"][Property]>
}
