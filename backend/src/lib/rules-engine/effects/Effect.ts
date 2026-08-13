import type { ActionSubmission } from "#lib/rules-engine/actions/ActionSubmission.ts"
import type { EffectResolver } from "#lib/rules-engine/effects/EffectResolver.ts"
import { resolveCostEffect } from "#lib/rules-engine/effects/resolvers/resolveCostEffect.ts"
import { resolveIncomeEffect } from "#lib/rules-engine/effects/resolvers/resolveIncomeEffect.ts"
import { resolveVictoryEffect } from "#lib/rules-engine/effects/resolvers/resolveVictoryEffect.ts"
import { CostMechanic } from "#lib/rules-engine/mechanics/CostMechanic.ts"
import { IncomeMechanic } from "#lib/rules-engine/mechanics/IncomeMechanic.ts"
import type { Mechanic } from "#lib/rules-engine/mechanics/Mechanic.ts"
import { VictoryMechanic } from "#lib/rules-engine/mechanics/VictoryMechanic.ts"

type EffectFor<TMechanic extends Mechanic> = {
  readonly type: TMechanic["type"]
  readonly mechanic: TMechanic
  /**
   * Expected to contain all the necessary targets for the mechanic
   */
  readonly targets: Readonly<ActionSubmission["targets"]>
  readonly resolve: EffectResolver
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
      resolve: (context) => {
        EffectResolvers[mechanic.type](context, effect)
      },
    }

    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Needed to make calling Effect.fromMechanic with a generic mechanic work fine
    return effect as Effect<TMechanic>
  },
}

const EffectResolvers: Record<Mechanic["type"], EffectResolver> = {
  [CostMechanic.type]: resolveCostEffect,
  [IncomeMechanic.type]: resolveIncomeEffect,
  [VictoryMechanic.type]: resolveVictoryEffect,
}
