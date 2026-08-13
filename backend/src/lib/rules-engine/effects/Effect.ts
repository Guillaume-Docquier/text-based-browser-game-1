import type { ActionSubmission } from "#lib/rules-engine/actions/ActionSubmission.ts"
import type { Mechanic } from "#lib/rules-engine/mechanics/Mechanic.ts"

type EffectFor<TMechanic extends Mechanic> = {
  readonly type: TMechanic["type"]
  readonly mechanic: TMechanic
  /**
   * Expected to contain all the necessary targets for the mechanic
   */
  readonly targets: Readonly<ActionSubmission["targets"]>
}

export type EffectOfType<TType extends Effect["type"]> = Effect & { type: TType }

export type Effect<T extends Mechanic = Mechanic> =
  // Weird type trick to make Mechanic a distributed union like MechanicDefinitions
  T extends Mechanic ? EffectFor<T> : never

export const Effect = {
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
