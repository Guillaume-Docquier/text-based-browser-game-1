import type { Mechanic } from "#lib/rules-engine/mechanics/Mechanic.ts"

type EffectFor<TMechanic extends Mechanic> = {
  // We'll include source, status, etc
  type: TMechanic["id"]
  mechanic: TMechanic
}

export type EffectOfType<TType extends Effect["type"]> = Effect & { type: TType }

export type Effect<T extends Mechanic = Mechanic> =
  // Weird type trick to make Mechanic a distributed union like MechanicDefinitions
  T extends Mechanic ? EffectFor<T> : never

export const Effect = {
  fromMechanic: <TMechanic extends Mechanic>({ mechanic }: { mechanic: TMechanic }): Effect<TMechanic> => {
    // oxlint-disable-next-line typescript/consistent-type-assertions typescript/no-unsafe-type-assertion -- This is necessary to preserve the right type discriminant
    return {
      type: mechanic.id,
      mechanic,
    } as Effect<TMechanic>
  },
}
