import type { AbstractMechanic } from "#lib/rules-engine/ruleset-model/mechanics/AbstractMechanic.ts"

/**
 * Helper type for Mechanic factories
 */
export type MechanicFactoryParameters<TMechanic extends AbstractMechanic> = {
  [K in keyof TMechanic["targets"] as `${K & string}Tag`]: string
} & TMechanic["parameters"]
