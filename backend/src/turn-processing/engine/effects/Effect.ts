import type { MechanicParameterTSType, Mechanics } from "#turn-processing/engine/effects/Mechanic.ts"

export type Effect<TMechanic extends Mechanics = Mechanics> = TMechanic extends Mechanics
  ? // Wierd type trick to make Effect a distributed union like Mechanics
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
 * Maps the Mechanic parameters definition types to their runtime type
 */
type ResolvedParameters<TMechanic extends Mechanics> = {
  [Property in keyof TMechanic["parameters"]]: MechanicParameterTSType<TMechanic["parameters"][Property]>
}
