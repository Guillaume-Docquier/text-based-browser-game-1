import type { UnbrandedProperties } from "@guillaume-docquier/tools-ts"
import type { AbstractMechanic } from "#lib/rules-engine/ruleset-model/mechanics/AbstractMechanic.ts"

/**
 * Helper type for Mechanic factories
 */
export type MechanicFactoryParameters<TMechanic extends AbstractMechanic> = UnbrandedProperties<
  {
    [K in keyof TMechanic["targets"] as `${K & string}Tag`]: string
  } & TMechanic["parameters"]
>
