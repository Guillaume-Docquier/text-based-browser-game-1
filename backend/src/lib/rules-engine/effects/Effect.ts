import { Assert } from "@guillaume-docquier/tools-ts"
import type { ActionDefinition } from "#lib/rules-engine/actions/ActionDefinition.ts"
import type { ActionSubmission } from "#lib/rules-engine/actions/ActionSubmission.ts"
import type { ResolvedTargets } from "#lib/rules-engine/actions/ResolvedTargets.ts"
import type { CostMechanic } from "#lib/rules-engine/mechanics/implementations/CostMechanic.ts"
import type { IncomeMechanic } from "#lib/rules-engine/mechanics/implementations/IncomeMechanic.ts"
import type { Mechanic } from "#lib/rules-engine/mechanics/Mechanic.ts"
import { MechanicDefinitions } from "#lib/rules-engine/mechanics/MechanicDefinition.ts"
import type { MechanicTarget } from "#lib/rules-engine/mechanics/MechanicTarget.ts"
import { MechanicType } from "#lib/rules-engine/mechanics/MechanicType.ts"
import type { Phase } from "#lib/rules-engine/phases/Phase.ts"

type EffectOrigin = {
  readonly actionDefinitionId: ActionDefinition["id"]
  readonly actionSubmissionId: ActionSubmission["id"]
  readonly mechanicIndex: number
  readonly mechanicPosition: "COST" | "MECHANIC"
}

type EffectBase<TType extends Mechanic["type"], TTargets> = {
  readonly id: string
  readonly type: TType
  readonly phase: Phase
  readonly mechanicOrder: number
  readonly origin: EffectOrigin
  readonly targets: TTargets
}

export type CostEffect = EffectBase<typeof MechanicType.COST, { readonly player: string }> & Pick<CostMechanic, "quantity" | "resourceType">

export type IncomeEffect = EffectBase<typeof MechanicType.INCOME, { readonly player: string }> &
  Pick<IncomeMechanic, "quantity" | "resourceType">

export type VictoryEffect = EffectBase<typeof MechanicType.VICTORY, { readonly player: string }>

/**
 * A concrete, ordered state change compiled from a configured Mechanic.
 */
export type Effect = CostEffect | IncomeEffect | VictoryEffect

export type EffectOfType<TType extends Effect["type"]> = Extract<Effect, { type: TType }>
export type NonCostEffect = Exclude<Effect, CostEffect>

export const Effect = {
  fromMechanic: ({
    actionDefinitionId,
    actionSubmissionId,
    mechanic,
    mechanicIndex,
    mechanicPosition,
    targets,
  }: {
    readonly actionDefinitionId: ActionDefinition["id"]
    readonly actionSubmissionId: ActionSubmission["id"]
    readonly mechanic: Mechanic
    readonly mechanicIndex: number
    readonly mechanicPosition: EffectOrigin["mechanicPosition"]
    readonly targets: ResolvedTargets
  }): Effect => {
    const definition = MechanicDefinitions[mechanic.type]
    const effectBase = {
      id: actionSubmissionId + ":" + mechanicPosition + ":" + mechanicIndex,
      phase: definition.phase,
      mechanicOrder: definition.order,
      origin: {
        actionDefinitionId,
        actionSubmissionId,
        mechanicIndex,
        mechanicPosition,
      },
    }

    switch (mechanic.type) {
      case MechanicType.COST:
        return {
          ...effectBase,
          type: MechanicType.COST,
          quantity: mechanic.quantity,
          resourceType: mechanic.resourceType,
          targets: {
            player: resolveTarget(mechanic.targets.player, targets),
          },
        }
      case MechanicType.INCOME:
        return {
          ...effectBase,
          type: MechanicType.INCOME,
          quantity: mechanic.quantity,
          resourceType: mechanic.resourceType,
          targets: {
            player: resolveTarget(mechanic.targets.player, targets),
          },
        }
      case MechanicType.VICTORY:
        return {
          ...effectBase,
          type: MechanicType.VICTORY,
          targets: {
            player: resolveTarget(mechanic.targets.player, targets),
          },
        }
      default:
        Assert.isExhausted(mechanic)
        return mechanic
    }
  },
}

function resolveTarget(target: MechanicTarget, targets: ResolvedTargets): string {
  const resolvedTarget = targets[target.tag]
  Assert.isDefined(resolvedTarget)
  return resolvedTarget
}
