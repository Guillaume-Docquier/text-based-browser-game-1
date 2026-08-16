import type { ActionSubmission } from "#lib/rules-engine/action-submission/ActionSubmission.ts"
import type { Mechanic } from "#lib/rules-engine/ruleset/mechanics/Mechanic.ts"

type EffectFor<TMechanic extends Mechanic> = {
  readonly type: TMechanic["type"]
  readonly mechanic: TMechanic
  /**
   * Expected to contain at least all the necessary targets for the mechanic. (it might contain more since it is scoped to the action)
   */
  readonly targets: Readonly<ActionSubmission["targets"]>
}

export type EffectOfType<TType extends Effect["type"]> = Effect & { type: TType }

export type Effect<T extends Mechanic = Mechanic> =
  // Weird type trick to make Mechanic a distributed union like MechanicDefinitions
  T extends Mechanic ? EffectFor<T> : never

export const Effect = {
  /**
   * A type guard builder to check that an effect is of a certain type.
   */
  isOfType:
    <TType extends Effect["type"]>(effectType: TType) =>
    (effect: Effect): effect is EffectOfType<TType> => {
      return effect.type === effectType
    },
  /**
   * Creates an effect for a mechanic
   */
  fromMechanic: <TMechanic extends Mechanic>({
    mechanic,
    targets,
  }: {
    mechanic: TMechanic
    targets: ActionSubmission["targets"]
  }): Effect<TMechanic> => {
    const effect: EffectFor<TMechanic> = {
      type: mechanic.type,
      mechanic,
      targets,
    }

    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Needed to make calling Effect.fromMechanic with a generic mechanic work fine
    return effect as Effect<TMechanic>
  },
}
